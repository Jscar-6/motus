// Visual constants for the 3D arm (F7). All hand-tuned by eye for looks and feel; none are compensation thresholds.

export const armConfig = {
  particleCount: 2600,                          // dots shared by the text and the arm
  textLines: ['PLEASE PUT', 'SLEEVE ON'],       // stippled message, one entry per line
  textWorldWidth: 9.5,                          // width of the text block in world units
  morphDuration: 2.6,                           // seconds for a full text <-> arm transition
  reducedMorphDuration: 0.4,                    // same, when the user prefers reduced motion
  dotSize: 2.3,                                 // base dot size; hand-tuned so the text stays stippled on a 260px box
  staleAfterMs: 1500,                           // sleeve is "stale" after this long without a frame
  visionWeight: 0.6,                            // per second, how strongly the camera pulls the IMU pose (0 = IMU only)
  poseSmoothing: 18,                            // per second, higher = snappier pose response
  visionMinConfidence: 0.5,                     // ignore camera angles when the arm landmarks are less visible than this
  relaxedCurl: 0.15,                            // fixed finger curl, since the sleeve has no flex sensors
  colors: {
    ink: '#2b1a12',                             // text dots (app ink)
    dark: '#3a2016',                            // arm shadow tone
    light: '#d9a07e',                           // arm lit tone
    rim: '#b5382b',                             // arm rim light
  },
} as const;
