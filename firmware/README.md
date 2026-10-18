# firmware

ESP32 sleeve firmware (PlatformIO): 3 IMUs → Madgwick quaternions over USB serial at 100 Hz, plus vibration motors. Owner: Jack (B1–B4). Protocol: PLAN.md §16. How the angles are computed: `docs/sleeve.md`.

```bash
cd firmware
pio run -t upload       # flash (~25 s at 115200 upload baud)
pio device monitor      # 921600 baud; type G, P or V,1,1 + Enter to test
```

| Line | Meaning |
|---|---|
| `D,ms,uw,ux,uy,uz,fw,fx,fy,fz,cw,cx,cy,cz` | 100 Hz quaternions: upper arm, forearm, chest |
| `S,READY` / `S,IMU_FAIL,<1-3>` / `S,IMU_OK,<1-3>` / `S,PONG` | status (IMU numbers follow the D order). A lost IMU is retried every second and reports `IMU_OK` when it's back |
| `S,ZERO_OK` / `S,ZERO_MOVED` | reply to `G` (2 s gyro-bias + shared heading reset) |
| `V,<motor>,<pattern>[,<percent>]` (in) | motor 1 = chest, 3 = upper arm; pattern 0 off, 1 pulse, 2 double, 3 on; optional strength 0–100 (default 100) |

- **Sensors:** our GY-521 boards are MPU6500-compatible clones, so the firmware talks to the registers directly instead of using Adafruit_MPU6050.
- **Upload speed:** 115200, because the default 460800 failed on the ELEGOO board.
- `tools/wear_test.py`: worn-sleeve check (ping, stream health, gyro zero while sitting still, both motors at 75%, each IMU responds to movement).
