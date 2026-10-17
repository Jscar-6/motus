// Madgwick IMU (gyro + accel) orientation filter, after S. Madgwick 2010. Same update as Adafruit AHRS updateIMU.
// Quaternion q = (w, x, y, z) rotates sensor-frame vectors into the earth frame (z up).
#pragma once
#include <math.h>

struct Madgwick {
  float w = 1, x = 0, y = 0, z = 0;
  float beta = 0.1f;  // gyro-vs-accel trust; 0.1 is the common default at ~100 Hz

  /** Sets roll and pitch from gravity alone and heading to 0 (the sensor's x axis defines earth x). */
  void resetFromAccel(float ax, float ay, float az) {
    float roll = atan2f(ay, az);
    float pitch = atan2f(-ax, sqrtf(ay * ay + az * az));
    float cr = cosf(roll / 2), sr = sinf(roll / 2), cp = cosf(pitch / 2), sp = sinf(pitch / 2);
    w = cr * cp; x = sr * cp; y = cr * sp; z = -sr * sp;
  }

  /** One filter step: gyro in rad/s, accel in any unit, dt in seconds. */
  void update(float gx, float gy, float gz, float ax, float ay, float az, float dt) {
    float qDotW = 0.5f * (-x * gx - y * gy - z * gz);
    float qDotX = 0.5f * (w * gx + y * gz - z * gy);
    float qDotY = 0.5f * (w * gy - x * gz + z * gx);
    float qDotZ = 0.5f * (w * gz + x * gy - y * gx);

    float n = sqrtf(ax * ax + ay * ay + az * az);
    if (n > 0) {
      ax /= n; ay /= n; az /= n;
      // Gradient-descent step toward the orientation where predicted gravity matches the accelerometer.
      float _2w = 2 * w, _2x = 2 * x, _2y = 2 * y, _2z = 2 * z;
      float _4w = 4 * w, _4x = 4 * x, _4y = 4 * y, _8x = 8 * x, _8y = 8 * y;
      float ww = w * w, xx = x * x, yy = y * y, zz = z * z;
      float sW = _4w * yy + _2y * ax + _4w * xx - _2x * ay;
      float sX = _4x * zz - _2z * ax + 4 * ww * x - _2w * ay - _4x + _8x * xx + _8x * yy + _4x * az;
      float sY = 4 * ww * y + _2w * ax + _4y * zz - _2z * ay - _4y + _8y * xx + _8y * yy + _4y * az;
      float sZ = 4 * xx * z - _2x * ax + 4 * yy * z - _2y * ay;
      float sn = sqrtf(sW * sW + sX * sX + sY * sY + sZ * sZ);
      if (sn > 0) {
        qDotW -= beta * sW / sn; qDotX -= beta * sX / sn;
        qDotY -= beta * sY / sn; qDotZ -= beta * sZ / sn;
      }
    }
    w += qDotW * dt; x += qDotX * dt; y += qDotY * dt; z += qDotZ * dt;
    float qn = sqrtf(w * w + x * x + y * y + z * z);
    w /= qn; x /= qn; y /= qn; z /= qn;
  }
};
