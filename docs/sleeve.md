# The sleeve: how three IMUs become body angles

Owner: Jack (B2, B3, A3, S1–S3). Code: `firmware/` and `web/src/lib/{serial,orientation,fakeSensor,sleeveBuzz}.ts`.

## What each sensor actually measures
Each MPU6050-class sensor measures two things:
- **acceleration**: gravity, plus motion
- **rotation speed** (gyro)

On the ESP32, a **Madgwick filter** fuses the two 100 times a second:
1. Integrate the gyro to track orientation. This is smooth and fast, but it slowly drifts.
2. Use gravity from the accelerometer to pull tilt back to the truth, so tilt doesn't drift.

The output is one **quaternion per sensor**: the sensor's 3D orientation in an earth frame (z up). It's orientation only, **not position**. The sleeve knows which way each segment points, not where it is in the room.

Heading (rotation about vertical) has no gravity reference, so it's held only by the gyro. That's why `G` measures the gyro bias, and why rotation is measured relative to the last rest capture.

## From sensor orientation to body angles
A sensor strapped to the arm doesn't know which of its axes runs along the bone. Two calibration poses solve that, so the exact mounting angle doesn't matter:

| Step | Pose | What it fixes |
|---|---|---|
| `G`: Zero sensors (§9.2 C1) | **Worn, sitting still** for 2 s (breathing is fine) | Each gyro's bias. Headings are never shared between sensors (the sleeve is sewn in), so no feature compares them |
| Rest capture (§9.2 C3) | Sitting upright, arm hanging straight down | Each segment's long axis = straight down (arm) or up (trunk) in that sensor's frame, read from gravity. The chest sensor's face gives "forward". |

Then, every frame:
1. Rotate each segment's long axis by its current quaternion, giving three direction vectors in the shared frame.
2. Measure angles between those vectors and the rest directions:

| Feature | How | Why it beats the camera |
|---|---|---|
| `leanDeg` | Trunk axis tilt toward the patient's forward direction | No dependence on the laptop being level or the 2D camera angle |
| `rotDeg` | Change in the chest's forward heading about vertical | The side camera can't see trunk rotation at all |
| `elbowDeg` | 180° − difference between the upper arm's and forearm's elevation from vertical (side-view plane, like the camera and TRSP) | Works when the elbow is hidden from the camera; no heading alignment needed |

Shoulder hike, shoulder flexion and visibility stay with the camera (PLAN.md §6.1).

`bodyRotationsSinceRest()` gives the same data as rotations in the 3D arm's frame (x forward, y up, z = x × y), for `web/src/arm`.

## Mounting rules
- **Chest sensor:** on the front of the chest, **component side facing out**, so its +Z points forward. If it sits more than 60° off, `chestUpright` is false and the app should warn.
  - It must move with the **rib cage, not the shoulder**. Put it high on the chest, just below the collarbone, on the side **opposite the reaching arm** (upper-left for a right-arm reach), and keep it off the chest muscle near the armpit.
  - The chest's curve angles the face a little to the side. At 20° off, forward lean reads about 6% low (cos 20°); rotation is unaffected.
  - Keep the strap snug, so breathing doesn't shift it.
- **Arm sensors:** any rotation around the limb is fine, because rest capture reads each bone's direction from gravity. They must not slip; re-capture rest after any adjustment. Never mount on a joint (§12).
- **Rest capture quality sets the zero:** the elbow must be truly straight and the trunk upright. A 15° bend at capture puts every elbow reading about 15° off.

## How accurate is it?
- **Measured on our hardware** (sensors still on a table, after `G`, 16 s): lean noise ±0.3°, elbow ±0.6°, rotation drift about 0.06° (roughly 0.2°/min).
- **Math check:** on simulated reaches with known angles plus 0.3° sensor noise, max error is under 0.5° for lean and rotation and under 0.8° for the elbow, on both arm sides, at any facing direction (`fakeFrameAt()` provides the ground truth).
- **What we have NOT measured:** accuracy on a moving body. Expect a few degrees from strap slip and soft tissue moving under the sensor, plus heading drift if rest isn't recaptured for a long time. Improvement I5 (phone inclinometer next to the chest IMU) would put a number on lean. Until then, don't claim an angle accuracy.
- **Our IMUs are MPU6500-compatible clones** (WHO_AM_I 0x70). Gyro bias is up to ~30°/s, which `G` removes. The accelerometers read 3–14% high. That doesn't matter for these features, because only directions are used, never magnitudes.

## Serial protocol additions (need a §20 entry before merge)
- `G` now replies `S,ZERO_OK`, or `S,ZERO_MOVED` (bias kept) if anything moved during the 2 s.
- Motors as wired: `V,1,…` = chest, `V,3,…` = upper arm, `V,2,…` is ignored (no forearm motor).
- `V,<motor>,<pattern>,<percent>`: optional strength 0–100. Without it, strength is 100, so existing commands are unchanged.

## Integration (done)
- `web/src/sleeve/sleeveSession.ts`: one shared connection, USB or demo.
- The vision model captures the sleeve rest pose together with the camera's, merges sleeve features (`withSleeve`), and buzzes on flags.
- `PoseFusion` uses `sleeveBodyRotations()`.
- The Session camera panel has a **Sleeve** pill: connect, Zero, and status.

Session order:
1. Connect (the board restarts when the port opens).
2. Zero: after a 5 s countdown to get into position, sit still for 2 s with the sleeve on.
3. Put the sleeve on.
4. Capture rest pose.
