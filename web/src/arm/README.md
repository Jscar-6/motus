# arm

Daniel's 3D arm model (F7): a stippled "PLEASE PUT SLEEVE ON" that morphs into a dotted, bone-rigged arm. `ArmViewer` fills its parent and is mounted inside `ArmSlot` on the patient view and the therapist card. The canvas is transparent, so it sits on the paper or white card. Visual constants are hand-tuned in `armConfig.ts`.

| File | Role |
| --- | --- |
| `ArmViewer.tsx` | React component: renderer, camera, orbit, morph loop, toggle button, sleeve status, `window.truereachArm` |
| `ArmRig.ts` | Bone hierarchy, surface sampler, idle motion, `applyPose` |
| `particles.ts` | Dot geometry and the morph shaders (GPU bone skinning) |
| `textSampler.ts` | Stipples the message into dots using the Tanker display font |
| `PoseFusion.ts` | Blends sleeve IMUs with camera angles into an `ArmPose` since calibration |
| `VisionFollow.ts` | Smoothed side-view upper arm and forearm angles from the camera, so the arm copies the video with no calibration |
| `armInput.ts` | `pushSensorFrame`, sensor status, `toThreeQuat`, and the 2D camera angle estimate |
| `simSensor.ts` | `STUB(A3)`: simulated 50 Hz sleeve frames |

## How live data plugs in

- Sleeve: S1's serial reader should call `pushSensorFrame(frame)` for each `D,` line (`STUB(S1)`). Status goes `offline`, `streaming`, `stale` (after `staleAfterMs`).
- Camera: nothing to wire. The viewer reads `useLive.getState().latest.pose` and `.aspect`, which works on both pages and never opens a second webcam. The moment the arm is visible, the words morph into the arm, which then copies the video's side view (`ArmRig.followImage`): same image-plane angles, turned ~17° toward the viewer, mirrored for a left-side view. It holds the last pose when the arm drops out of view.
- Sleeve-to-body mapping is `remapSensorQuat` in `armInput.ts` (`STUB(S2)`), currently identity.
- The sleeve only drives the arm after `setDrive(true)` and a `calibrate()` (rest pose for IMUs and camera angles); otherwise the camera drives it.

## Window API

`window.truereachArm` exists while a viewer is mounted: `morphTo('arm' | 'text')`, `setDrive(on)`, `calibrate()`, `startSim()`, `stopSim()`, `pushSensorFrame(frame)`. Calls apply to every mounted viewer.

## Open TODOs

- Implement `remapSensorQuat` once the IMU mounting is known (S2).
- Morph to the arm automatically when the sleeve starts streaming.
- Validate the drive mapping (axes and signs) against the real sleeve and camera, then consider turning drive on by default.
