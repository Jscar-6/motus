# sensor_test

Bench test for the sleeve (B1). Checks that the ESP32 talks over USB, scans both I2C buses, prints live readings from all three IMUs, and runs a guided check of each IMU and motor. It's not the real firmware: B2 replaces it with quaternions over serial (PLAN.md §16).

## Hardware it expects (as wired)
| Part | Bus / pin | Address |
|---|---|---|
| Upper-arm IMU | `Wire`: SDA 21, SCL 22 | 0x68 |
| Forearm IMU | `Wire`: SDA 21, SCL 22 (AD0 → 3V3) | 0x69 |
| Chest IMU | `Wire1`: SDA 33, SCL 32 | 0x68 |
| Motor 1 (chest) | GPIO 25 | — |
| Motor 3 (upper arm) | GPIO 27 | — |

All IMUs run on 3V3, the motors on VIN (5V), with grounds shared. Our GY-521 boards report chip ID `0x70` (an MPU6500-compatible clone). The test talks to the registers directly, so genuine and clone chips both work.

## Run it
Plug the ESP32 in over USB (data cable), then from the repo root:
```bash
cd firmware/sensor_test
pio run -t upload          # build + flash (~25 s at 115200 baud)
pio device monitor         # live output; type keys here. Ctrl+C to quit
```
Close the monitor before uploading again, since only one program can hold the port. In VS Code, run these in the integrated terminal.

## Test procedure
1. **Boot check:** the monitor should show
   - `ESP32 is alive`
   - the I2C scan `Wire : 0x68 0x69` / `Wire1: 0x68`
   - three `OK` lines under IMU init

   Missing address → check that sensor's VCC/GND/SDA/SCL. Forearm showing up at 0x68 instead of 0x69 → its AD0 wire isn't on 3V3.
2. **Live readings:** lay the sensors still.
   - `|a|` should be about 9.8 (10–11 is fine on these clones).
   - Tilt each sensor and watch its pitch/roll change.
   - Shake one and its gyro numbers jump.
3. **Guided test (press `t`):**
   - Each IMU: lay everything flat and press a key, then tilt only the named sensor. It passes if that sensor moved, and fails if a different one moved (labels or wires swapped).
   - Each motor: press a key, feel 3 pulses then 25% / 50% / 100% strength, and answer `y`/`n`.
   - A PASS/FAIL summary prints at the end.
4. **Single motors:** `1` buzzes the chest motor, `3` buzzes the upper-arm motor.
5. **Motor stuck on?** If a motor buzzes nonstop from boot, its input is active-low: press `i`.

## What the readings mean
| Column | Unit | Meaning |
|---|---|---|
| accel x/y/z | m/s² | Gravity plus motion along the sensor's own axes (arrows on the board) |
| \|a\| | m/s² | Total acceleration. About 9.8 when still, whatever the angle |
| pitch / roll | deg | Tilt computed from gravity; valid only while still |
| gyro x/y/z | deg/s | Rotation speed. Near 0 when still; these clones show a constant offset of up to ~30 deg/s that B2's gyro-bias zeroing (`G`) removes |
| temp | °C | Chip temperature |
| `---` | | Sensor not responding |

## Keys
`t` guided test · `1` / `3` buzz a motor · `p` pause/resume · `s` rescan + re-init · `i` invert motor polarity · `l` legend · `h` help

## Notes
- `upload_speed = 115200`: the default 460800 failed on our ELEGOO board.
- Ranges: ±4 g accel, ±500 deg/s gyro, ~20 Hz on-chip low-pass filter. I2C at 100 kHz (PLAN.md §12).
