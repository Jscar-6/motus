// Patient view (Figma 1:6): a big video panel sliding in from the right, a white instruction card over its left edge, the arm slot below.
import { useRef, useState, type CSSProperties, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { readFlipOrigin, useFlipFrom } from '../landing/useFlipFrom';
import { usePatientSession } from '../live/usePatientSession';
import AlertTint from '../patient/AlertTint';
import InstructionCard from '../patient/InstructionCard';
import NearFarControl from '../patient/NearFarControl';
import PoseCanvas from '../patient/PoseCanvas';
import { EASE_OUT, useMaterialize } from '../patient/motion';
import ArmSlot from '../ui/ArmSlot';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Wordmark from '../ui/Wordmark';

const SLIDE = { type: 'spring', bounce: 0, duration: 0.7 } as const;
const COLUMN = 'clamp(10rem, 13vw, 13.75rem)'; // left column: arm slot width
const LAYOUT_VARS = { '--col': COLUMN, '--video-left': `calc(${COLUMN} + 3rem)` } as CSSProperties;

/** Calm moving shimmer while the camera and pose model start. */
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
      <p role="status" className="relative font-serif text-[1.125rem] text-ink-2">Starting camera and pose model…</p>
    </motion.div>
  );
}

/** Error overlay: calm wording and a way forward. */
function ErrorOverlay({ onDemo }: { onDemo: () => void }) {
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
        <p className="text-ink-2">Check that no other app is using it, then reload. Or look around with demo data.</p>
        <Button variant="quiet" onClick={onDemo}>Try with demo data</Button>
      </div>
    </motion.div>
  );
}

/** Video, demo backdrop, pose canvas, status overlays and the glass controls inside the panel. */
function VideoSurface({ videoRef, demo, status, error, onDemo, reduced }: {
  videoRef: RefObject<HTMLVideoElement>;
  demo: boolean;
  status: 'starting' | 'running' | 'demo' | 'error';
  error?: string;
  onDemo: () => void;
  reduced: boolean | null;
}) {
  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        className={demo ? 'hidden' : 'absolute inset-0 size-full object-cover'}
        style={{ opacity: status === 'running' ? 1 : 0, transitionProperty: 'opacity', transitionDuration: '500ms', transitionTimingFunction: 'ease' }}
      />
      {demo && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgb(43 26 18 / 0.14) 1px, transparent 1.4px), radial-gradient(120% 90% at 25% 10%, #f3d6c2, #d6a98f 75%)',
            backgroundSize: '12px 12px, 100% 100%',
          }}
        />
      )}
      <PoseCanvas fit={demo ? 'contain' : 'cover'} className="absolute inset-0 size-full" />

      <AnimatePresence>
        {status === 'starting' && <StartingOverlay reduced={reduced} />}
        {status === 'error' && <ErrorOverlay onDemo={onDemo} />}
      </AnimatePresence>

      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <div>{demo && <Badge dot className="!bg-white/75 backdrop-blur-md">{error ? 'Camera unavailable, demo data' : 'Demo data'}</Badge>}</div>
        <div className="flex items-center gap-2">
          <Badge className="backdrop-blur-md">Camera</Badge>
          <Button
            variant="quiet"
            onClick={() => window.open('/doctor', 'truereach-doctor')}
            className="!h-8 gap-1.5 !px-3.5 text-[0.7rem] uppercase tracking-[0.08em]"
          >
            Therapist view
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M8 7h9v9" /></svg>
          </Button>
        </div>
      </div>

      <NearFarControl className="absolute bottom-5 left-1/2 -translate-x-1/2" />
    </>
  );
}

/** The session layout for one source (camera or demo); remounted when the source changes. */
function SessionView({ demo }: { demo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const { state } = useLocation();
  const [origin] = useState(() => readFlipOrigin(state));
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { status, error } = usePatientSession({ side: 'right', videoRef, demo });
  const showDemo = demo || status === 'demo';
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
      style={LAYOUT_VARS}
      className="relative grid min-h-dvh grid-cols-[1fr_auto] content-start gap-4 p-4 sm:p-6 lg:block lg:h-dvh lg:overflow-hidden"
    >
      <AlertTint />

      <motion.div {...(flipping ? {} : brand)} className="relative col-span-2 lg:absolute lg:left-6 lg:top-6">
        <Link ref={brandRef} to="/" aria-label="TrueReach, back to start" className="pressable inline-block" style={{ transitionProperty: 'transform' }}>
          <Wordmark size="md" />
        </Link>
      </motion.div>

      <motion.section
        ref={panelRef}
        {...panel}
        aria-label="Camera"
        className="material relative col-span-2 aspect-[4/3] overflow-hidden sm:aspect-video lg:absolute lg:bottom-6 lg:left-[var(--video-left)] lg:right-6 lg:top-6 lg:aspect-auto"
      >
        <VideoSurface videoRef={videoRef} demo={showDemo} status={status} error={error} onDemo={() => navigate('/session?demo=1')} reduced={reduced} />
      </motion.section>

      <div className="pointer-events-none relative lg:absolute lg:inset-y-0 lg:left-6 lg:flex lg:items-center">
        <motion.div {...card} className="pointer-events-auto lg:w-[clamp(20rem,26vw,25rem)]">
          <InstructionCard />
        </motion.div>
      </div>

      <motion.div {...arm} className="material relative self-end p-2.5 lg:absolute lg:bottom-6 lg:left-6" style={{ width: 'var(--col)' }}>
        <ArmSlot className="aspect-square w-full" />
      </motion.div>
    </motion.main>
  );
}

/** Patient session page; `?demo=1` swaps the webcam for fake poses. */
export default function Session() {
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  return <SessionView key={demo ? 'demo' : 'camera'} demo={demo} />;
}
