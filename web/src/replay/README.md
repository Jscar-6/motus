# replay

Plays a saved recording back through the same live store the patient session writes to (F11), so the physician's arm viewer, pose canvas, alert tint and coach context need no replay-specific code.

| File | Role |
| --- | --- |
| `usePlaybackFeed.ts` | On every presented video frame (`requestVideoFrameCallback`, else rAF while playing) and on `seeked`, pushes the timeline sample, sleeve frame and newly crossed flags into `live/store` and `arm/armInput`, rebased to `performance.now()` |
| `useTimeline.ts` | Downloads a ready recording's timeline JSON once and caches it |

Timeline times are milliseconds since recording start, on the video's clock (`currentTime * 1000`). Samples only exist after the rest pose was captured, so playback sets `restCaptured` (the alert tint and cues need it) and restores it afterwards. The store is reset on a new recording, on any backward or long forward jump (flags up to the new time are re-pushed), and on unmount.
