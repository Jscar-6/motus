// Patient-tab session: plain webcam, relayed to the therapist tab as JPEG frames. Analysis is not run here;
// when it exists it plugs in by pushing samples and flags into the live store from this session.
import { useEffect, useState, type RefObject } from 'react';
import { startCamera, stopCamera } from '../vision/pose';
import { openLiveChannel } from './channel';
import { resetLive, useLive } from './store';

const PRESENCE_MS = 1000;
const VIDEO_INTERVAL_MS = 80;
const VIDEO_WIDTH = 640;
const JPEG_QUALITY = 0.72;

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
}

interface SessionState {
  status: 'starting' | 'running' | 'error';
  error?: string;
}

/** Run the patient's live session while the calling component is mounted. */
export function usePatientSession({ videoRef }: Options): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'starting' });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let stopLoop = () => {};
    let canvas: OffscreenCanvas | null = null;
    let ctx: OffscreenCanvasRenderingContext2D | null = null;
    let relayPending = false;
    let lastRelay = 0;

    const channel = openLiveChannel((m) => {
      if (m.type === 'presence' && m.role === 'doctor') announce();
    });

    /** Tell the therapist tab this patient tab is alive. */
    function announce(): void {
      channel.post({ type: 'presence', role: 'patient', source: useLive.getState().source });
    }

    /** Stop the frame loop and the camera (safe to call twice). */
    const release = () => {
      stopLoop();
      stopLoop = () => {};
      if (stream) stopCamera(stream);
      stream = null;
    };

    /** Downscale the current video frame to a JPEG and send it, skipping frames while an encode is pending. */
    const relayVideo = (video: HTMLVideoElement, aspect: number) => {
      const now = performance.now();
      if (relayPending || now - lastRelay < VIDEO_INTERVAL_MS) return;
      const h = Math.round(VIDEO_WIDTH / aspect);
      if (!canvas) {
        canvas = new OffscreenCanvas(VIDEO_WIDTH, h);
        ctx = canvas.getContext('2d');
      }
      if (!ctx) return;
      if (canvas.height !== h) canvas.height = h;
      lastRelay = now;
      ctx.drawImage(video, 0, 0, VIDEO_WIDTH, h);
      relayPending = true;
      canvas
        .convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
        .then((frame) => {
          if (!cancelled) channel.post({ type: 'video', frame, w: VIDEO_WIDTH, h });
        })
        .catch(() => undefined) // a failed encode only drops one preview frame
        .then(() => {
          relayPending = false;
        });
    };

    /** Call `tick` on every presented video frame (animation frames where that is unsupported). */
    const loop = (video: HTMLVideoElement, tick: () => void): (() => void) => {
      let handle = 0;
      if ('requestVideoFrameCallback' in video) {
        const next = () => {
          handle = video.requestVideoFrameCallback(() => {
            tick();
            next();
          });
        };
        next();
        return () => video.cancelVideoFrameCallback(handle);
      }
      const next = () => {
        handle = requestAnimationFrame(() => {
          tick();
          next();
        });
      };
      next();
      return () => cancelAnimationFrame(handle);
    };

    /** Start the webcam and begin relaying its frames. */
    const begin = async () => {
      try {
        const video = videoRef.current;
        if (!video) throw new Error('The video element is not ready');
        stream = await startCamera(video);
        if (cancelled) return release();
        stopLoop = loop(video, () => relayVideo(video, video.videoWidth / video.videoHeight));
        useLive.setState({ source: 'camera' });
        announce();
        setState({ status: 'running' });
      } catch (e) {
        release();
        if (!cancelled) setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    };

    resetLive();
    useLive.setState({ source: 'none', restCaptured: false });
    const presenceTimer = window.setInterval(announce, PRESENCE_MS);
    // Deferred one tick so React StrictMode's mount-unmount-mount never opens the camera twice.
    const startTimer = window.setTimeout(begin, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearInterval(presenceTimer);
      release();
      channel.close();
      resetLive();
      useLive.setState({ source: 'none', restCaptured: false });
    };
  }, [videoRef]);

  return state;
}
