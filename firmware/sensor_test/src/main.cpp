// TrueReach B1 bench test: checks every IMU and motor on the sleeve and prints readable readings.
// Not the real firmware; B2 (quaternions over serial, PLAN.md §16) replaces it.
#include <Arduino.h>
#include <Wire.h>

// Wiring as built (hw-notes/B1-as-wired.md); I2C pins and speed per PLAN.md §12.
constexpr int SDA0 = 21, SCL0 = 22;  // Wire: upper arm 0x68, forearm 0x69
constexpr int SDA1 = 33, SCL1 = 32;  // Wire1: chest 0x68
constexpr uint32_t I2C_HZ = 100000;

struct ImuInfo { const char *name; TwoWire *bus; const char *busName; uint8_t addr; };
const ImuInfo IMUS[] = {
  {"UPPER", &Wire, "Wire", 0x68},
  {"FORE", &Wire, "Wire", 0x69},
  {"CHEST", &Wire1, "Wire1", 0x68},
};
constexpr int N_IMU = sizeof(IMUS) / sizeof(IMUS[0]);
bool imuOk[N_IMU];
uint8_t imuWhoAmI[N_IMU];

// MPU6050 registers (same on MPU6500-family clones). Talking to registers directly also accepts
// clone chips that the Adafruit library rejects because of their WHO_AM_I value.
constexpr uint8_t REG_CONFIG = 0x1A, REG_GYRO_CONFIG = 0x1B, REG_ACCEL_CONFIG = 0x1C;
constexpr uint8_t REG_DATA = 0x3B, REG_PWR_MGMT_1 = 0x6B, REG_WHO_AM_I = 0x75;
constexpr float ACCEL_LSB_PER_G = 8192.0f;   // +-4 g range
constexpr float GYRO_LSB_PER_DPS = 65.5f;    // +-500 deg/s range

struct Motor { int id; const char *where; int pin; };
const Motor MOTORS[] = {{1, "chest", 25}, {3, "upper arm", 27}};
constexpr int N_MOTOR = sizeof(MOTORS) / sizeof(MOTORS[0]);
bool motorActiveLow = false;  // flip with 'i' if a motor buzzes when it should be off

struct Reading { float ax, ay, az, gx, gy, gz, tempC; };

bool streaming = true;
int rowsSinceHeader = 0;

/** Drive one motor at a duty from 0 (off) to 255 (full), honoring the polarity setting. */
void motorSet(const Motor &m, int duty) {
  analogWrite(m.pin, motorActiveLow ? 255 - duty : duty);
}

/** Buzz one motor: three full pulses, then 25% / 50% / 100% strength steps. */
void motorBuzz(const Motor &m) {
  Serial.printf("Motor %d (%s, GPIO %d): 3 pulses, then 25%% / 50%% / 100%%\n", m.id, m.where, m.pin);
  for (int i = 0; i < 3; i++) {
    motorSet(m, 255); delay(250);
    motorSet(m, 0); delay(250);
  }
  for (int duty : {64, 128, 255}) {
    Serial.printf("  %d%%\n", duty * 100 / 255);
    motorSet(m, duty); delay(700);
    motorSet(m, 0); delay(300);
  }
}

/** Block until a key arrives on serial, then discard any trailing newline characters. */
char waitKey() {
  while (!Serial.available()) delay(10);
  char c = Serial.read();
  delay(20);
  while (Serial.available()) Serial.read();
  return c;
}

/** Write one byte to a sensor register; false if the sensor didn't acknowledge. */
bool writeReg(const ImuInfo &imu, uint8_t reg, uint8_t val) {
  imu.bus->beginTransmission(imu.addr);
  imu.bus->write(reg);
  imu.bus->write(val);
  return imu.bus->endTransmission() == 0;
}

/** Read n bytes starting at a sensor register; false on any bus error. */
bool readRegs(const ImuInfo &imu, uint8_t reg, uint8_t *buf, uint8_t n) {
  imu.bus->beginTransmission(imu.addr);
  imu.bus->write(reg);
  if (imu.bus->endTransmission(false) != 0) return false;
  if (imu.bus->requestFrom(imu.addr, n) != n) return false;
  for (uint8_t k = 0; k < n; k++) buf[k] = imu.bus->read();
  return true;
}

/** Name the chip behind a WHO_AM_I value. */
const char *chipName(uint8_t id) {
  switch (id) {
    case 0x68: return "MPU6050";
    case 0x70: return "MPU6500 (clone-compatible)";
    case 0x71: return "MPU9250";
    case 0x73: return "MPU9255";
    default: return "unknown compatible";
  }
}

/** Read one IMU in friendly units (m/s^2, deg/s, deg C); false if it isn't working. */
bool readImu(int i, Reading &r) {
  uint8_t b[14];
  if (!imuOk[i] || !readRegs(IMUS[i], REG_DATA, b, 14)) return false;
  auto raw = [&](int k) { return (int16_t)((b[k] << 8) | b[k + 1]); };
  constexpr float G = 9.80665f;
  float t = imuWhoAmI[i] == 0x68 ? raw(6) / 340.0f + 36.53f : raw(6) / 333.87f + 21.0f;  // datasheet formulas
  r = {raw(0) / ACCEL_LSB_PER_G * G, raw(2) / ACCEL_LSB_PER_G * G, raw(4) / ACCEL_LSB_PER_G * G,
       raw(8) / GYRO_LSB_PER_DPS, raw(10) / GYRO_LSB_PER_DPS, raw(12) / GYRO_LSB_PER_DPS, t};
  return true;
}

/** Angle in degrees between two acceleration vectors (how far a still sensor was tilted). */
float angleBetween(const Reading &p, const Reading &q) {
  float dot = p.ax * q.ax + p.ay * q.ay + p.az * q.az;
  float mags = sqrtf(p.ax * p.ax + p.ay * p.ay + p.az * p.az) * sqrtf(q.ax * q.ax + q.ay * q.ay + q.az * q.az);
  if (mags < 1e-3f) return 0;
  return acosf(constrain(dot / mags, -1.0f, 1.0f)) * RAD_TO_DEG;
}

/** List every address that answers on one I2C bus. */
void scanBus(TwoWire &bus, const char *name) {
  Serial.printf("  %-5s:", name);
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    bus.beginTransmission(addr);
    if (bus.endTransmission() == 0) { Serial.printf(" 0x%02X", addr); found++; }
  }
  Serial.println(found ? "" : " (nothing)");
}

/** Scan both buses and print what we expect to see. */
void scanAll() {
  Serial.println("\nI2C scan (expected: Wire 0x68 0x69, Wire1 0x68)");
  scanBus(Wire, "Wire");
  scanBus(Wire1, "Wire1");
}

/** Wake each IMU, set +-4 g / +-500 deg/s / ~20 Hz filter, and report its chip ID. */
void initImus() {
  Serial.println("\nIMU init");
  for (int i = 0; i < N_IMU; i++) {
    const ImuInfo &imu = IMUS[i];
    imuOk[i] = readRegs(imu, REG_WHO_AM_I, &imuWhoAmI[i], 1)
               && writeReg(imu, REG_PWR_MGMT_1, 0x01)     // wake, gyro-referenced clock
               && writeReg(imu, REG_CONFIG, 0x04)         // digital low-pass ~20 Hz
               && writeReg(imu, REG_GYRO_CONFIG, 0x08)    // +-500 deg/s
               && writeReg(imu, REG_ACCEL_CONFIG, 0x08);  // +-4 g
    if (imuOk[i])
      Serial.printf("  %-5s %s 0x%02X  OK   chip id 0x%02X = %s\n", imu.name, imu.busName, imu.addr,
                    imuWhoAmI[i], chipName(imuWhoAmI[i]));
    else
      Serial.printf("  %-5s %s 0x%02X  FAIL (check VCC/GND/SDA/SCL and AD0)\n", imu.name, imu.busName, imu.addr);
  }
  delay(100);  // let the sensors settle after waking
}

/** Explain what every column of the live readout means. */
void printLegend() {
  Serial.println(
    "\nWhat the numbers mean\n"
    "  accel x/y/z  m/s^2  Gravity + motion along the sensor's own axes (arrows printed on the board).\n"
    "  |a|          m/s^2  Total acceleration. Still sensor = about 9.8 (gravity), whatever the angle.\n"
    "                      Far from 9.8 while still = bad reading or loose wire.\n"
    "  pitch/roll   deg    Tilt computed from gravity. Flat = about 0 / 0. Only valid while still.\n"
    "  gyro x/y/z   deg/s  Rotation speed. Still = near 0 (a few deg/s of offset is normal; B2 removes it).\n"
    "  temp         C      Chip temperature. Room temp to about 35 is normal.\n"
    "  ---          the sensor isn't responding.");
}

/** Show the keyboard commands. */
void printHelp() {
  Serial.println(
    "\nKeys (type in the serial monitor, no Enter needed)\n"
    "  t  guided test: each IMU, then each motor, with PASS/FAIL summary\n"
    "  1  buzz motor 1 (chest)      3  buzz motor 3 (upper arm)\n"
    "  p  pause / resume live readout\n"
    "  s  rescan I2C + re-init IMUs (after fixing a wire)\n"
    "  i  invert motor polarity (if a motor buzzes nonstop)\n"
    "  l  legend    h  this help");
}

/** Print one line of live readings per IMU, with a header every few rows. */
void printReadings() {
  if (rowsSinceHeader == 0) {
    Serial.println("\n       ----- accel m/s^2 -----    |a|   - tilt deg -   ----- gyro deg/s -----   temp");
    Serial.println("name        x       y       z            pitch   roll        x       y       z      C");
  }
  for (int i = 0; i < N_IMU; i++) {
    Reading r;
    if (!readImu(i, r)) { Serial.printf("%-5s  ---\n", IMUS[i].name); continue; }
    float mag = sqrtf(r.ax * r.ax + r.ay * r.ay + r.az * r.az);
    float pitch = atan2f(-r.ax, sqrtf(r.ay * r.ay + r.az * r.az)) * RAD_TO_DEG;
    float roll = atan2f(r.ay, r.az) * RAD_TO_DEG;
    Serial.printf("%-5s  %+7.2f %+7.2f %+7.2f  %6.2f  %+6.1f %+6.1f  %+7.1f %+7.1f %+7.1f  %5.1f\n",
                  IMUS[i].name, r.ax, r.ay, r.az, mag, pitch, roll, r.gx, r.gy, r.gz, r.tempC);
  }
  Serial.println();
  rowsSinceHeader = (rowsSinceHeader + 1) % 8;
}

/** Ask the user to tilt one IMU and confirm that it, and only it, moved. */
bool testImu(int target) {
  Serial.printf("\n[IMU %s] Lay ALL sensors flat and still, then press any key.\n", IMUS[target].name);
  waitKey();
  Reading base[N_IMU];
  bool have[N_IMU];
  for (int i = 0; i < N_IMU; i++) have[i] = readImu(i, base[i]);
  if (!have[target]) { Serial.println("  FAIL: not responding."); return false; }

  Serial.printf("  Now tilt ONLY the %s sensor about 45 degrees (15 s)...\n", IMUS[target].name);
  unsigned long start = millis();
  while (millis() - start < 15000) {
    for (int i = 0; i < N_IMU; i++) {
      Reading r;
      if (!have[i] || !readImu(i, r) || angleBetween(base[i], r) < 30) continue;
      if (i == target) { Serial.printf("  PASS: %s moved.\n", IMUS[i].name); return true; }
      Serial.printf("  FAIL: %s moved instead. Labels or wires swapped?\n", IMUS[i].name);
      return false;
    }
    delay(20);
  }
  Serial.println("  FAIL: no tilt detected in 15 s.");
  return false;
}

/** Buzz one motor and ask the user whether they felt it. */
bool testMotor(const Motor &m) {
  Serial.printf("\n[Motor %d] Hold the %s motor. Press any key to buzz it.\n", m.id, m.where);
  waitKey();
  motorBuzz(m);
  Serial.println("  Did it vibrate, getting stronger at each step? (y/n)");
  bool ok = tolower(waitKey()) == 'y';
  Serial.println(ok ? "  PASS" : "  FAIL: check IN wire, 5V (VIN) and GND. If it buzzed nonstop at boot, press 'i'.");
  return ok;
}

/** Run every check in order and print a summary table. */
void guidedTest() {
  Serial.println("\n===== Guided test =====");
  bool imuPass[N_IMU], motorPass[N_MOTOR];
  for (int i = 0; i < N_IMU; i++) imuPass[i] = testImu(i);
  for (int m = 0; m < N_MOTOR; m++) motorPass[m] = testMotor(MOTORS[m]);

  Serial.println("\n===== Summary =====");
  for (int i = 0; i < N_IMU; i++) Serial.printf("  IMU %-5s     %s\n", IMUS[i].name, imuPass[i] ? "PASS" : "FAIL");
  for (int m = 0; m < N_MOTOR; m++)
    Serial.printf("  Motor %d %-9s %s\n", MOTORS[m].id, MOTORS[m].where, motorPass[m] ? "PASS" : "FAIL");
  Serial.println("Press p to resume the live readout.");
  streaming = false;
  rowsSinceHeader = 0;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  for (int m = 0; m < N_MOTOR; m++) motorSet(MOTORS[m], 0);
  Wire.begin(SDA0, SCL0, I2C_HZ);
  Wire1.begin(SDA1, SCL1, I2C_HZ);

  Serial.println("\n\n===== TrueReach sleeve bench test (B1) =====");
  Serial.println("ESP32 is alive and talking over USB serial.");
  scanAll();
  initImus();
  printLegend();
  printHelp();
}

void loop() {
  if (Serial.available()) {
    char c = tolower(waitKey());
    switch (c) {
      case 't': guidedTest(); break;
      case '1': motorBuzz(MOTORS[0]); break;
      case '3': motorBuzz(MOTORS[1]); break;
      case 'p': streaming = !streaming; rowsSinceHeader = 0; break;
      case 's': scanAll(); initImus(); break;
      case 'i':
        motorActiveLow = !motorActiveLow;
        for (int m = 0; m < N_MOTOR; m++) motorSet(MOTORS[m], 0);
        Serial.printf("\nMotor polarity: active-%s\n", motorActiveLow ? "LOW" : "HIGH");
        break;
      case 'l': printLegend(); break;
      case 'h': printHelp(); break;
    }
  }
  static unsigned long last = 0;
  if (streaming && millis() - last >= 500) {
    last = millis();
    printReadings();
  }
}
