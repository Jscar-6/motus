// Patient-tab session: webcam (or fake poses) → pipeline → store, broadcast to the therapist tab.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Side } from '../lib/types';
import { PoseTracker, runPoseLoop, startCamera, stopCamera } from '../vision/pose';
import { listenForActions, registerLocalPipeline } from './actions';
import { openLiveChannel } from './channel';
import { startDemoLoop } from './demoLoop';
import { createPipeline } from './pipeline';
import { resetLive, useLive } from './store';

const PRESENCE_MS = 1000;
const VIDEO_INTERVAL_MS = 80;
const VIDEO_WIDTH = 640;
const JPEG_QUALITY = 0.72;

interface Options {
  side: Side;
  videoRef: RefObject<HTMLVideoElement | null>;
  demo?: boolean;
}

interface SessionState {
  status: 'starting' | 'running' | 'demo' | 'error';
  error?: string;
}

/** Run the patient's live session while the calling component is mounted. */
export function usePatientSession({ side, videoRef, demo = false }: Options): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'starting' });
  const sideRef = useRef(side);
  sideRef.current = side;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let tracker: PoseTracker | null = null;
    let stopLoop = () => {};
    let canvas: OffscreenCanvas | null = null;
    let ctx: OffscreenCanvasRenderingContext2D | null = null;
    let relayPending = false;
    let lastRelay = 0;

    const pipeline = createPipeline();
    const channel = openLiveChannel((m) => {
      if (m.type === 'presence' && m.role === 'doctor') announce();
    });

    /** Tell the therapist tab this patient tab is alive. */
    function announce(): void {
      channel.post({ type: 'presence', role: 'patient', source: useLive.getState().source });
    }

    /** Stop the pose loop, the pose model and the camera (safe to call twice). */
    const release = () => {
      stopLoop();
      stopLoop = () => {};
      tracker?.close();
      tracker = null;
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

    /** Fall back to fake poses (on request, or because the camera or model failed). */
    const beginDemo = (error?: string) => {
      useLive.setState({ source: 'demo' });
      announce();
      stopLoop = startDemoLoop(
        () => sideRef.current,
        pipeline,
        (sample) => channel.post({ type: 'sample', sample }),
      );
      setState(error ? { status: 'demo', error } : { status: 'demo' });
    };

    /** Start the webcam and pose model, falling back to the demo on failure. */
    const begin = async () => {
      if (demo) return beginDemo();
      try {
        const video = videoRef.current;
        if (!video) throw new Error('The video element is not ready');
        stream = await startCamera(video);
        tracker = await PoseTracker.create();
        if (cancelled) return release();
        stopLoop = runPoseLoop(
          video,
          tracker,
          () => sideRef.current,
          (pose) => {
            const aspect = video.videoWidth / video.videoHeight;
            channel.post({ type: 'sample', sample: pipeline.process(pose, aspect) });
            relayVideo(video, aspect);
          },
        );
        useLive.setState({ source: 'camera' });
        announce();
        setState({ status: 'running' });
      } catch (e) {
        release();
        if (!cancelled) beginDemo(e instanceof Error ? e.message : String(e));
      }
    };

    resetLive();
    useLive.setState({ source: 'none', restCaptured: false });
    registerLocalPipeline(pipeline);
    listenForActions();
    const unsubscribeFlags = useLive.subscribe((s, prev) => {
      const event = s.flags[0];
      if (event && event !== prev.flags[0]) channel.post({ type: 'flag', event });
    });
    const presenceTimer = window.setInterval(announce, PRESENCE_MS);
    // Deferred one tick so React StrictMode's mount-unmount-mount never opens the camera twice.
    const startTimer = window.setTimeout(begin, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearInterval(presenceTimer);
      unsubscribeFlags();
      release();
      channel.close();
      registerLocalPipeline(null);
      resetLive();
      useLive.setState({ source: 'none', restCaptured: false });
    };
  }, [demo, videoRef]);

  return state;
}
