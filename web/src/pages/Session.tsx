// Patient view (Figma 1:6): a left column (wordmark, white instruction card, arm) beside a big video panel with a Record control.
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { readFlipOrigin, useFlipFrom } from '../landing/useFlipFrom';
import { usePatientSession } from '../live/usePatientSession';
import AlertTint from '../patient/AlertTint';
import InstructionCard from '../patient/InstructionCard';
import { EASE_OUT, useMaterialize } from '../patient/motion';
import ArmViewer from '../arm/ArmViewer';
import ArmSlot from '../ui/ArmSlot';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Wordmark from '../ui/Wordmark';
import RecordButton from '../recording/RecordButton';
import { useRecorder } from '../recording/useRecorder';
import VisionCheck from '../vision/VisionCheck';

const SLIDE = { type: 'spring', bounce: 0, duration: 0.7 } as const;
const COLUMN = 'lg:grid-cols-[clamp(13rem,17vw,17rem)_1fr]'; // left column: wordmark, instruction card, arm

/** Calm moving shimmer while the camera starts. */
function StartingOverlay({ reduced }: { reduced: boolean | null }) {
  return (
    <motion.div
      key="starting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="absolute inset-0 grid place-items-center overflow-hidden"
    >
      {!reduced && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.45), transparent)' }}
          initial={{ transform: 'translateX(-100%)' }}
          animate={{ transform: 'translateX(200%)' }}
          transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.4 }}
        />
      )}
      <p role="status" className="relative font-serif text-[1.125rem] text-ink-2">Starting camera…</p>
    </motion.div>
  );
}

/** Error overlay: calm wording and a way forward. */
function ErrorOverlay() {
  return (
    <motion.div
      key="error"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 grid place-items-center p-6 text-center"
    >
      <div role="alert" className="flex max-w-sm flex-col items-center gap-4">
        <p className="font-serif text-[1.25rem] leading-snug text-ink">We couldn&apos;t start your camera.</p>
        <p className="text-ink-2">Check that no other app is using it, then try again.</p>
        <Button variant="quiet" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </motion.div>
  );
}

/** Video, status overlays, optional content above them, and the glass controls inside the panel. */
function VideoSurface({ videoRef, status, reduced, recorder, children }: {
  videoRef: RefObject<HTMLVideoElement>;
  status: 'starting' | 'running' | 'error';
  reduced: boolean | null;
  recorder: ReturnType<typeof useRecorder>;
  children?: ReactNode;
}) {
  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 size-full object-cover"
        style={{ opacity: status === 'running' ? 1 : 0, transitionProperty: 'opacity', transitionDuration: '500ms', transitionTimingFunction: 'ease' }}
      />

      <AnimatePresence>
        {status === 'starting' && <StartingOverlay reduced={reduced} />}
        {status === 'error' && <ErrorOverlay />}
      </AnimatePresence>

      {children}

      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <div />
        <div className="flex items-center gap-2">
          <Badge className="backdrop-blur-md">Camera</Badge>
          <RecordButton
            state={recorder.state}
            elapsedMs={recorder.elapsedMs}
            available={recorder.available}
            reason={recorder.reason}
            onStart={() => void recorder.start()}
            onStop={() => void recorder.stop()}
            onRetry={recorder.retry}
          />
        </div>
      </div>
    </>
  );
}

/** The patient session layout: camera panel, instruction card and arm. */
export default function Session() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const { state } = useLocation();
  const [origin] = useState(() => readFlipOrigin(state));
  const reduced = useReducedMotion();
  const { status } = usePatientSession({ videoRef });
  const recorder = useRecorder({ videoRef, cameraRunning: status === 'running' });
  const flipping = origin !== undefined && !reduced;
  useFlipFrom(panelRef, origin?.lensRect, 'panel');
  useFlipFrom(brandRef, origin?.wordmarkRect, 'text');
  const brand = useMaterialize({ delay: 0, y: 8, blur: 6 });
  const card = useMaterialize({ delay: 0.12, x: -16, y: 0, blur: 8, duration: 0.6 });
  const arm = useMaterialize({ delay: 0.2, y: 16, blur: 8 });
  const panel = flipping
    ? {}
    : reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, filter: 'blur(8px)', transform: 'translateX(8%)' },
        animate: { opacity: 1, filter: 'blur(0px)', transform: 'translateX(0%)' },
        transition: { transform: SLIDE, opacity: { duration: 0.5, ease: EASE_OUT }, filter: { duration: 0.5, ease: EASE_OUT } },
      };

  return (
    <motion.main
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.2 : 0.25, ease: 'easeOut' } }}
      className={`relative grid min-h-dvh grid-cols-1 content-start gap-4 p-4 sm:p-6 lg:h-dvh lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden ${COLUMN}`}
    >
      <AlertTint />

      <motion.div {...(flipping ? {} : brand)} className="relative lg:col-start-1 lg:row-start-1">
        <Link ref={brandRef} to="/" aria-label="TrueReach, back to start" className="pressable inline-block" style={{ transitionProperty: 'transform' }}>
          <Wordmark size="md" />
        </Link>
      </motion.div>

      <motion.section
        ref={panelRef}
        {...panel}
        aria-label="Camera"
        className="material relative aspect-[4/3] overflow-hidden sm:aspect-video lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:aspect-auto"
      >
        <VideoSurface videoRef={videoRef} status={status} reduced={reduced} recorder={recorder}>
          {/* Himmet's vision model (C1–C5), unchanged; the classes only restore browser default looks that Tailwind resets. */}
          <div className="absolute inset-0 overflow-auto bg-paper text-ink [&_button]:rounded-md [&_button]:border [&_button]:border-ink-3 [&_button]:bg-white [&_button]:px-2 [&_button]:py-0.5 [&_button:disabled]:opacity-40 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_p]:my-2 [&_pre]:text-xs [&_th]:text-left">
            <VisionCheck />
          </div>
        </VideoSurface>
      </motion.section>

      <motion.div {...card} className="relative flex min-h-0 flex-col lg:col-start-1 lg:row-start-2">
        <InstructionCard className="lg:min-h-0 lg:flex-1" />
      </motion.div>

      <motion.div {...arm} className="material relative p-2.5 lg:col-start-1 lg:row-start-3">
        <ArmSlot className="aspect-square w-full"><ArmViewer /></ArmSlot>
      </motion.div>
    </motion.main>
  );
}
