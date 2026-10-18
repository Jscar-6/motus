# arm

Daniel's 3D arm model (F7): a stippled "PLEASE PUT SLEEVE ON" that morphs into a dotted, bone-rigged arm. `ArmViewer` fills its parent and is mounted inside `ArmSlot` on the patient view and the therapist card. The canvas is transparent, so it sits on the paper or white card. Visual constants are hand-tuned in `armConfig.ts`.

| File | Role |
| --- | --- |
| `ArmViewer.tsx` | React component: renderer, camera, orbit, morph loop, toggle button, sleeve status, `window.truereachArm` |
| `ArmRig.ts` | Bone hierarchy, surface sampler, idle motion, `applyPose` |
| `particles.ts` | Dot geometry and the morph shaders (GPU bone skinning) |
| `textSampler.ts` | Stipples the message into dots using the Tanker display font |
| `PoseFusion.ts` | Blends sleeve IMUs with camera angles into an `ArmPose` since calibration |
| `armInput.ts` | `pushSensorFrame`, sensor status, `toThreeQuat`, and the 2D camera angle estimate |
| `simSensor.ts` | Demo sleeve: connects the A3 fake sleeve through `sleeve/sleeveSession` |

## How live data plugs in

- Sleeve: `sleeve/sleeveSession` calls `pushSensorFrame(frame)` for each `D,` line. Status goes `offline`, `streaming`, `stale` (after `staleAfterMs`).
- Camera: nothing to wire. The viewer reads `useLive.getState().latest.pose` and `.aspect`, which works on both pages and never opens a second webcam.
- Sleeve-to-body mapping: with a sleeve rest pose, `PoseFusion` uses `sleeveBodyRotations()` (S2, `lib/orientation.ts`). Without one (e.g. replay), it falls back to rotation since its own calibration, through `remapSensorQuat` (identity).
- The arm only follows live data after `setDrive(true)` and a `calibrate()` (rest pose for IMUs and camera angles). Camera-only works without the sleeve.

## Window API

`window.truereachArm` exists while a viewer is mounted: `morphTo('arm' | 'text')`, `setDrive(on)`, `calibrate()`, `startSim()`, `stopSim()`, `pushSensorFrame(frame)`. Calls apply to every mounted viewer.

## Open TODOs

- Implement `remapSensorQuat` once the IMU mounting is known (S2).
- Morph to the arm automatically when the sleeve starts streaming.
- Validate the drive mapping (axes and signs) against the real sleeve and camera, then consider turning drive on by default.
