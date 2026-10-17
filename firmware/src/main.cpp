// TrueReach sleeve firmware (B2 + B3): reads 3 IMUs at 100 Hz, runs a Madgwick filter per sensor, streams
// quaternions over USB serial, and plays vibration patterns on command. Serial protocol: PLAN.md §16.
#include <Arduino.h>
#include <Wire.h>
#include "madgwick.h"

// Wiring as built (hw-notes/B1-as-wired.md); I2C pins and speed per PLAN.md §12.
constexpr int SDA0 = 21, SCL0 = 22;  // Wire: upper arm 0x68, forearm 0x69
constexpr int SDA1 = 33, SCL1 = 32;  // Wire1: chest 0x68
constexpr uint32_t I2C_HZ = 100000;
constexpr uint32_t BAUD = 921600;    // PLAN.md §16; fall back to 115200 + 50 Hz if lines get corrupted
constexpr uint32_t PERIOD_US = 10000;  // 100 Hz
constexpr uint32_t ZERO_MS = 2000;   // `G`: hold still this long while the gyro bias is measured
// SOURCE: hand-set for our clone IMUs (bench test: still-sensor noise ~0.1 deg/s, bias up to ~30 deg/s).
// A zero window counts as "moved" if any gyro axis spans more than this.
constexpr float ZERO_MAX_SPAN_DPS = 3.0f;

// MPU6050 registers (same on MPU6500-family clones; ours report WHO_AM_I 0x70).
constexpr uint8_t REG_CONFIG = 0x1A, REG_GYRO_CONFIG = 0x1B, REG_ACCEL_CONFIG = 0x1C;
constexpr uint8_t REG_DATA = 0x3B, REG_PWR_MGMT_1 = 0x6B;
constexpr float ACCEL_LSB_PER_G = 8192.0f;  // +-4 g
constexpr float GYRO_LSB_PER_DPS = 65.5f;   // +-500 deg/s

struct Imu {
  TwoWire *bus;
  uint8_t addr;
  bool ok = false;
  float bias[3] = {0, 0, 0};  // gyro bias, deg/s
  float a[3] = {0, 0, 1};     // latest accel, g
  float g[3] = {0, 0, 0};     // latest gyro, deg/s (raw, bias not removed)
  Madgwick filt;
};
// Order matches the D line: upper arm, forearm, chest (IMU_FAIL numbers them 1, 2, 3).
Imu imus[3] = {{&Wire, 0x68}, {&Wire, 0x69}, {&Wire1, 0x68}};

// Motor IDs from the V command (PLAN.md §16). As wired: 1 = chest, 3 = upper arm; 2 has no motor.
struct Motor { int id; int pin; int pattern = 0; uint32_t startMs = 0; bool on = true; };
Motor motors[] = {{1, 25}, {3, 27}};

/** Write one byte to a sensor register; false if it didn't acknowledge. */
bool writeReg(Imu &s, uint8_t reg, uint8_t val) {
  s.bus->beginTransmission(s.addr);
  s.bus->write(reg);
  s.bus->write(val);
  return s.bus->endTransmission() == 0;
}

/** Wake a sensor and set +-4 g, +-500 deg/s and the ~20 Hz on-chip low-pass filter. */
bool initImu(Imu &s) {
  return writeReg(s, REG_PWR_MGMT_1, 0x01) && writeReg(s, REG_CONFIG, 0x04) &&
         writeReg(s, REG_GYRO_CONFIG, 0x08) && writeReg(s, REG_ACCEL_CONFIG, 0x08);
}

/** Read accel (g) and gyro (deg/s) into the sensor's latest fields; false on a bus error. */
bool readImu(Imu &s) {
  s.bus->beginTransmission(s.addr);
  s.bus->write(REG_DATA);
  if (s.bus->endTransmission(false) != 0 || s.bus->requestFrom(s.addr, (uint8_t)14) != 14) return false;
  uint8_t b[14];
  for (uint8_t &v : b) v = s.bus->read();
  int16_t r[7];
  for (int k = 0; k < 7; k++) r[k] = (int16_t)((b[2 * k] << 8) | b[2 * k + 1]);
  for (int k = 0; k < 3; k++) {
    s.a[k] = r[k] / ACCEL_LSB_PER_G;
    s.g[k] = r[k + 4] / GYRO_LSB_PER_DPS;  // r[3] is temperature
  }
  return true;
}

/**
 * `G`: average the gyro for ZERO_MS as the new bias, then reset every filter to heading 0. Lay all sensors flat
 * with their printed X arrows pointing the same way, so all three filters share one heading reference.
 * Replies S,ZERO_OK, or S,ZERO_MOVED (old bias kept) if anything moved.
 */
void zeroSensors() {
  float sum[3][3] = {}, lo[3][3], hi[3][3], acc[3][3] = {};
  for (int i = 0; i < 3; i++)
    for (int k = 0; k < 3; k++) { lo[i][k] = 1e9f; hi[i][k] = -1e9f; }
  int n = 0;
  uint32_t start = millis();
  while (millis() - start < ZERO_MS) {
    for (int i = 0; i < 3; i++) {
      if (!imus[i].ok || !readImu(imus[i])) continue;
      for (int k = 0; k < 3; k++) {
        sum[i][k] += imus[i].g[k];
        acc[i][k] += imus[i].a[k];
        lo[i][k] = min(lo[i][k], imus[i].g[k]);
        hi[i][k] = max(hi[i][k], imus[i].g[k]);
      }
    }
    n++;
    delay(5);
  }
  bool moved = false;
  for (int i = 0; i < 3; i++)
    for (int k = 0; k < 3; k++)
      if (imus[i].ok && hi[i][k] - lo[i][k] > ZERO_MAX_SPAN_DPS) moved = true;
  if (moved || n == 0) {
    Serial.println("S,ZERO_MOVED");
    return;
  }
  for (Imu &s : imus) {
    if (!s.ok) continue;
    int i = &s - imus;
    for (int k = 0; k < 3; k++) s.bias[k] = sum[i][k] / n;
    s.filt.resetFromAccel(acc[i][0], acc[i][1], acc[i][2]);
  }
  Serial.println("S,ZERO_OK");
}

/** Start or stop a motor pattern: 0 off, 1 pulse 150 ms, 2 double pulse, 3 on until 0. */
void setMotor(int id, int pattern) {
  for (Motor &m : motors)
    if (m.id == id) { m.pattern = pattern; m.startMs = millis(); }
}

/** Drive each motor pin from its pattern and the time since it started. */
void updateMotors() {
  uint32_t now = millis();
  for (Motor &m : motors) {
    uint32_t e = now - m.startMs;
    bool on = (m.pattern == 1 && e < 150) || (m.pattern == 2 && (e < 150 || (e >= 250 && e < 400))) || m.pattern == 3;
    if ((m.pattern == 1 && e >= 150) || (m.pattern == 2 && e >= 400)) m.pattern = 0;
    if (on != m.on) analogWrite(m.pin, on ? 255 : 0);
    m.on = on;
  }
}

/** Handle one command line from the browser: G, P, or V,<motor>,<pattern>. */
void handleCommand(const String &line) {
  if (line == "G") zeroSensors();
  else if (line == "P") Serial.println("S,PONG");
  else if (line.startsWith("V,")) {
    int comma = line.indexOf(',', 2);
    if (comma > 0) setMotor(line.substring(2, comma).toInt(), line.substring(comma + 1).toInt());
  }
}

/** Collect serial input into lines and run each complete one. */
void pollSerial() {
  static String buf;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length()) handleCommand(buf);
      buf = "";
    } else if (buf.length() < 32) {
      buf += c;
    }
  }
}

/** Read every sensor, step its filter, and print one D line. */
void sampleAndSend(float dt) {
  char line[160];
  int len = snprintf(line, sizeof line, "D,%lu", (unsigned long)millis());
  for (Imu &s : imus) {
    if (s.ok && readImu(s)) {
      constexpr float D2R = PI / 180.0f;
      s.filt.update((s.g[0] - s.bias[0]) * D2R, (s.g[1] - s.bias[1]) * D2R, (s.g[2] - s.bias[2]) * D2R,
                    s.a[0], s.a[1], s.a[2], dt);
    }
    len += snprintf(line + len, sizeof line - len, ",%.4f,%.4f,%.4f,%.4f", s.filt.w, s.filt.x, s.filt.y, s.filt.z);
  }
  Serial.println(line);
}

void setup() {
  Serial.begin(BAUD);
  updateMotors();  // all patterns start at 0: drive every motor pin low
  Wire.begin(SDA0, SCL0, I2C_HZ);
  Wire1.begin(SDA1, SCL1, I2C_HZ);
  delay(100);
  for (int i = 0; i < 3; i++) {
    imus[i].ok = initImu(imus[i]);
    if (!imus[i].ok) Serial.printf("S,IMU_FAIL,%d\n", i + 1);
  }
  delay(100);
  for (Imu &s : imus)
    if (s.ok && readImu(s)) s.filt.resetFromAccel(s.a[0], s.a[1], s.a[2]);  // start level, not at identity
  zeroSensors();
  Serial.println("S,READY");
}

void loop() {
  static uint32_t last = micros();
  pollSerial();
  updateMotors();
  uint32_t now = micros();
  if (now - last >= 5 * PERIOD_US) last = now - PERIOD_US;  // after a blocking G, resume without a huge dt step
  if (now - last >= PERIOD_US) {
    float dt = (now - last) / 1e6f;
    last = now;
    sampleAndSend(dt);
  }
}
