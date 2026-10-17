# vision

Camera input: MediaPipe pose (`pose.ts`, C1), target click + touch (`target.ts`, C3), `CameraView.tsx`.

- **`pose.ts`**: starts the webcam and runs MediaPipe PoseLandmarker (lite) on each new video frame, returning a `PoseFrame` (ear, shoulder, elbow, wrist, hip on the chosen side; normalized 0–1 with visibility). `runPoseLoop` smooths the points with a One Euro filter, so they hold steady at rest but still follow a fast reach. The model (`web/public/models/`) and WASM (`web/public/mediapipe-wasm/`, copied from `node_modules` by `npm install`) are served locally, so tracking works offline.
- **`CameraView.tsx`**: React component showing the live webcam. Pass `onPose` to receive every `PoseFrame` (or `null` when no one is in view); `debug` draws the tracked points (red = below `visMin`).
- **`target.ts`**: turns a click on the video into a `Target` (near/far + normalized point) and checks for a touch: the elbow→wrist line extended to mid-hand, where a grasped object sits (the wrist alone stops short of it) within `touchRadius` of the target.
- **Pose check page**: run `npm run dev` and open http://localhost:5173/pose-debug.html to see tracking, the frame rate, rest capture, live features, target touch, and the raw `PoseFrame` without the app shell.
