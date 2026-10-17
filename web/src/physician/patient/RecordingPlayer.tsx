// The recording playback panel: video with the replayed skeleton on top, state messages, and glass controls with flag ticks on the scrubber.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { publicUrl } from '../../db/supabase';
import type { RecordingRow, RecordingTimeline } from '../../db/types';
import PoseCanvas from '../../patient/PoseCanvas';
import { duration, stamp } from '../format';

const CHIP = 'inline-flex h-7 items-center rounded-full bg-black/35 px-3 font-display text-[0.7rem] tracking-[0.08em] text-white/90 uppercase backdrop-blur-md';
const SEEK_STEP_S = 5;

/** WebM from MediaRecorder reports an infinite duration until the end is seen once; seek there and back. */
function fixDuration(v: HTMLVideoElement): void {
  if (v.duration !== Infinity) return;
  const back = () => {
    v.removeEventListener('timeupdate', back);
    v.currentTime = 0;
  };
  v.addEventListener('timeupdate', back);
  v.currentTime = 1e7;
}

/** Centred message on the dark panel; `pulse` adds a breathing dot. */
function Message({ children, pulse }: { children: ReactNode; pulse?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="absolute inset-0 grid place-items-center p-8 text-center">
      <p role="status" className="flex max-w-sm items-center gap-3 font-serif text-[1.125rem] leading-snug text-white/80">
        {pulse && (
          <motion.span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full bg-bad"
            animate={reduced ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {children}
      </p>
    </div>
  );
}

interface SurfaceProps {
  recording: RecordingRow | null;
  patientName: string;
  configured: boolean;
  onVideo: (el: HTMLVideoElement) => void;
}

/** What fills the panel for one recording: its video, or a calm message for the other states. */
function Layer({ recording, patientName, configured, onVideo }: SurfaceProps) {
  if (!configured) return <Message>Database not configured: add the Supabase keys to web/.env.local.</Message>;
  if (!recording) return <Message>No recordings yet: they appear here the moment {patientName} finishes one</Message>;
  if (recording.status === 'recording') return <Message pulse>Recording now…</Message>;
  if (recording.status === 'uploading') return <Message pulse>Uploading…</Message>;
  if (recording.status === 'failed') return <Message>This recording did not finish uploading.</Message>;
  const src = publicUrl(recording.video_path);
  if (!src) return <Message>Sample recording: there is no video to play.</Message>;
  return (
    <video
      ref={(el) => {
        if (el) onVideo(el);
      }}
      src={src}
      data-rid={recording.id}
      playsInline
      muted
      preload="auto"
      onLoadedMetadata={(e) => fixDuration(e.currentTarget)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

/** Panel content under the focus button: the recording layer (cross-faded between recordings) and the replayed skeleton. */
export function PlayerSurface(props: SurfaceProps) {
  const reduced = useReducedMotion();
  const key = `${props.recording?.id ?? 'none'}:${props.recording?.status ?? ''}`;
  return (
    <>
      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.2, ease: 'easeOut' }}
        >
          <Layer {...props} />
        </motion.div>
      </AnimatePresence>
      <PoseCanvas fit="cover" className="pointer-events-none absolute inset-0 size-full" />
    </>
  );
}

/** Tracks play state, and the current time through rAF while playing, writing the scrubber fill directly. */
function useVideoClock(video: HTMLVideoElement, total: number, fillRef: React.RefObject<HTMLDivElement | null>) {
  const [playing, setPlaying] = useState(!video.paused);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const t = video.currentTime;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${total ? Math.min(1, t / total) : 0})`;
      setSeconds(Math.floor(t));
    };
    const loop = () => {
      update();
      raf = video.paused ? 0 : requestAnimationFrame(loop);
    };
    const onPlay = () => {
      setPlaying(true);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onPause = () => {
      setPlaying(false);
      update();
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', update);
    video.addEventListener('timeupdate', update);
    update();
    if (!video.paused) onPlay();
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', update);
      video.removeEventListener('timeupdate', update);
    };
  }, [video, total, fillRef]);

  return { playing, seconds };
}

interface ControlsProps { video: HTMLVideoElement; timeline: RecordingTimeline | null; durationMs: number | null; raised: boolean }

/** Glass control bar: play or pause, a scrubber with a tick for every flag, and m:ss / m:ss. */
function Controls({ video, timeline, durationMs, raised }: ControlsProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : (durationMs ?? 0) / 1000;
  const { playing, seconds } = useVideoClock(video, total, fillRef);

  /** Seek to the pointer's position on the track. */
  const seekTo = (e: PointerEvent<HTMLDivElement>) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || !total) return;
    video.currentTime = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * total;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    video.currentTime = Math.min(total, Math.max(0, video.currentTime + (e.key === 'ArrowRight' ? SEEK_STEP_S : -SEEK_STEP_S)));
  };

  return (
    <div className={`pointer-events-auto absolute right-3 left-3 z-10 flex h-10 items-center gap-3 rounded-full bg-black/35 px-2 text-white backdrop-blur-md ${raised ? 'bottom-12' : 'bottom-3'}`}>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => (video.paused ? void video.play() : video.pause())}
        className="pressable grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-white/90 text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          {playing ? <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /> : <path d="M3 1.5v9l7.5-4.5z" />}
        </svg>
      </button>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={seconds}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekTo(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && seekTo(e)}
        className="relative flex h-full flex-1 cursor-pointer touch-none items-center"
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25">
          <div ref={fillRef} className="absolute inset-0 origin-left rounded-full bg-white" style={{ transform: 'scaleX(0)' }} />
        </div>
        {total > 0 && timeline?.flags.map((f) => (
          <span
            key={f.id}
            aria-hidden
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-[#FF6B57]"
            style={{ left: `${Math.min(100, (f.t / 1000 / total) * 100)}%` }}
          />
        ))}
      </div>
      <span className="tabular shrink-0 pr-2 font-display text-[0.7rem] tracking-[0.08em]">
        {duration(seconds * 1000)} / {duration(total * 1000)}
      </span>
    </div>
  );
}

interface OverlayProps { recording: RecordingRow | null; video: HTMLVideoElement | null; timeline: RecordingTimeline | null; raised: boolean }

/** Chips and controls above the focus button: recording date and length, and the glass controls. */
export function PlayerOverlay({ recording, video, timeline, raised }: OverlayProps) {
  const playable = recording?.status === 'ready' && recording.video_path !== null;
  return (
    <>
      {recording && (
        <p className={`pointer-events-none absolute top-3 left-3 z-10 ${CHIP}`}>
          {stamp(recording.started_at)}
          {playable ? ` · ${duration(recording.duration_ms)}` : recording.status === 'ready' ? ' · Sample · no video' : ''}
        </p>
      )}
      {playable && video && <Controls key={recording.id} video={video} timeline={timeline} durationMs={recording.duration_ms} raised={raised} />}
    </>
  );
}
