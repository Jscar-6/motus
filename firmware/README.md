# firmware

ESP32 sleeve firmware (PlatformIO): 3× MPU6050 → Madgwick quaternions over USB serial, 3 vibration motors. Owner: Jack (B1–B4). Serial protocol: PLAN.md §16.

- `sensor_test/`: B1 bench test (I2C scan, live IMU readings, guided IMU + motor check). See its README.
