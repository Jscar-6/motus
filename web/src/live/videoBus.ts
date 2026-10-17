// Latest-frame bus for the patient video relayed to the therapist tab. Only the newest bitmap is kept.

type Listener = (bmp: ImageBitmap) => void;

const listeners = new Set<Listener>();
let latest: ImageBitmap | null = null;

/** Publish a new frame; the previous bitmap is closed, so subscribers must draw it synchronously or keep only the latest. */
export function publishVideoFrame(bmp: ImageBitmap): void {
  latest?.close();
  latest = bmp;
  listeners.forEach((cb) => cb(bmp));
}

/** Subscribe to frames (the current frame is replayed at once); returns the unsubscribe function. */
export function subscribeVideo(cb: (bmp: ImageBitmap) => void): () => void {
  listeners.add(cb);
  if (latest) cb(latest);
  return () => {
    listeners.delete(cb);
  };
}

/** Drop the current frame, e.g. when the patient leaves, so a stale picture is not replayed. */
export function clearVideoFrame(): void {
  latest?.close();
  latest = null;
}
