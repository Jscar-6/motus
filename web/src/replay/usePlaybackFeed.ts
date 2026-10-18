// Replays a recording's timeline into the live store in step with a <video>, so the arm, pose canvas, tint and coach context all follow playback.
import { useEffect } from 'react';
import { pushSensorFrame } from '../arm/armInput';
import type { RecordingTimeline } from '../db/types';
import { pushFlag, pushSample, resetLive, useLive } from '../live/store';

const JUMP_MS = 1500;
const HAS_FRAME_CALLBACK = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

/** Index of the last item whose `t` is at or before `t`, or -1 when none is. Items must be sorted by `t`. */
export function indexAt(items: readonly { t: number }[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** While mounted, pushes the sample, sleeve frame and crossed flags for the video's current time into the live store; resets the store on a new recording, a seek, and unmount. */
export function usePlaybackFeed(video: HTMLVideoElement | null, timeline: RecordingTimeline | null): void {
  useEffect(() => {
    resetLive();
    if (!video || !timeline) return undefined;
    const { samples, sensor, flags } = timeline;
    const restWas = useLive.getState().restCaptured;
    useLive.setState({ restCaptured: true });
    let lastT = -1;
    let raf = 0;
    let frameCallback = 0;

    /** Push the sample and sleeve frame for `ms`; flags crossed since the last call, or all flags so far after a jump. */
    const emit = (ms: number, forceReset: boolean) => {
      const jumped = forceReset || ms < lastT || ms - lastT > JUMP_MS;
      if (jumped) {
        resetLive();
        for (const f of flags) if (f.t <= ms) pushFlag({ ...f, t: performance.now() });
      } else {
        for (const f of flags) if (f.t > lastT && f.t <= ms) pushFlag({ ...f, t: performance.now() });
      }
      lastT = ms;
      const now = performance.now();
      const s = samples[indexAt(samples, ms)];
      if (s) pushSample({ ...s, t: now });
      const q = sensor[indexAt(sensor, ms)];
      if (q) pushSensorFrame({ t: now, upper: q.upper, fore: q.fore, chest: q.chest });
    };

    /** Frame callback loop: one emit per presented video frame. */
    const onVideoFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      emit(meta.mediaTime * 1000, false);
      frameCallback = video.requestVideoFrameCallback(onVideoFrame);
    };
    /** rAF fallback for browsers without requestVideoFrameCallback: emit while playing. */
    const onRaf = () => {
      emit(video.currentTime * 1000, false);
      raf = video.paused ? 0 : requestAnimationFrame(onRaf);
    };
    const onPlay = () => {
      if (!raf) raf = requestAnimationFrame(onRaf);
    };
    const onSeeked = () => emit(video.currentTime * 1000, true);
    const onLoaded = () => emit(video.currentTime * 1000, true);

    if (HAS_FRAME_CALLBACK) frameCallback = video.requestVideoFrameCallback(onVideoFrame);
    else video.addEventListener('play', onPlay);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadeddata', onLoaded);
    if (video.readyState >= 2) onLoaded();

    return () => {
      if (HAS_FRAME_CALLBACK) video.cancelVideoFrameCallback(frameCallback);
      cancelAnimationFrame(raf);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadeddata', onLoaded);
      useLive.setState({ restCaptured: restWas });
      resetLive();
    };
  }, [video, timeline]);
}
