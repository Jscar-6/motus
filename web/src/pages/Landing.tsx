// Landing: wordmark, setup steps and one button that asks for the webcam; the lens then grows into the session's video panel,
// while the physician link fades the whole page out instead.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { prefetchOverview } from '../db/hooks';
import Lens from '../landing/Lens';
import Button from '../ui/Button';
import Wordmark from '../ui/Wordmark';
import { rectOf, type FlipOrigin } from '../landing/useFlipFrom';
import { EASE_OUT, useMaterialize } from '../patient/motion';

const MESSAGES = {
  blocked: 'Camera access was blocked. You can allow it from the address bar, or try again.',
  missing: "We couldn't find a camera on this device. Connect one and try again.",
} as const;
const STEPS = [
  'Laptop to your affected side, webcam at shoulder height',
  'Sit upright, back off the chair, arm resting',
  'Hold still 3 seconds while we capture your rest pose',
] as const;
const CAPTIONS = { idle: 'waiting for camera…', requesting: 'requesting access…', denied: 'waiting for camera…', ready: 'camera ready' } as const;
const LEAVE = { opacity: 0, y: -12, transition: { duration: 0.25, ease: 'easeOut' } } as const;
const FADE = { opacity: 0, transition: { duration: 0.25, ease: 'easeOut' } } as const;

type Phase = keyof typeof CAPTIONS;
type Exit = 'morph' | 'fade';  // morph: the lens stays to grow into the session panel; fade: everything fades out together

/** Camera glyph that inherits the button's text colour. */
function CameraIcon() {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.83" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.0833 6.41667L14.6667 11L21.0833 15.5833V6.41667Z" />
      <path d="M2.75 4.58333H12.8333C13.8459 4.58333 14.6667 5.40414 14.6667 6.41667V15.5833C14.6667 16.5959 13.8459 17.4167 12.8333 17.4167H2.75C1.73748 17.4167 0.916666 16.5959 0.916666 15.5833V6.41667C0.916666 5.40414 1.73748 4.58333 2.75 4.58333Z" />
    </svg>
  );
}

/** Landing page. */
export default function Landing() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string>(MESSAGES.blocked);
  const [granted, setGranted] = useState(false);
  const [exit, setExit] = useState<Exit>('morph');
  const lensRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const copy = useMaterialize({ delay: 0.1, y: 12, blur: 6 });
  const lens = useMaterialize({ delay: 0.2, y: 12, blur: 6 });
  const login = useMaterialize({ delay: 0.1, y: 8, blur: 4 });
  const footer = useMaterialize({ delay: 0.3, y: 8, blur: 4 });

  useEffect(() => {
    let live = true;
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => { if (live) setGranted(status.state === 'granted'); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  /** Navigate, handing over where the lens and wordmark are so the next page can grow from them. */
  function goTo(path: string) {
    const state: FlipOrigin | undefined = lensRef.current && wordmarkRef.current
      ? { from: 'landing', at: Date.now(), lensRect: rectOf(lensRef.current), wordmarkRect: rectOf(wordmarkRef.current) }
      : undefined;
    navigate(path, { state });
  }

  /** Fade the whole page out while the physician overview's code and data load, so it can slide in complete. */
  function goToPhysician() {
    import('./Physician').catch(() => undefined);
    prefetchOverview();
    flushSync(() => setExit('fade'));
    navigate('/physician');
  }

  /** Go to the patient session. */
  function enterSession() {
    setPhase('ready');
    goTo('/session');
  }

  /** Ask for the webcam (or reuse a standing grant), then hand over to the session page. */
  async function allow() {
    if (granted) {
      enterSession();
      return;
    }
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      enterSession();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setMessage(name === 'NotAllowedError' || name === 'SecurityError' ? MESSAGES.blocked : MESSAGES.missing);
      setPhase('denied');
    }
  }

  const fade = exit === 'fade';
  const leave = reduced || fade ? undefined : LEAVE;

  return (
    <motion.main
      initial={{ opacity: 1 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.2 } } : fade ? FADE : { opacity: 1, transition: { duration: 0.25 } }}
      className="relative flex min-h-dvh flex-col items-center gap-8 px-4 py-8 text-ink sm:px-8 lg:px-[72px]"
    >
      <motion.div aria-hidden exit={fade ? undefined : { opacity: 0, transition: { duration: 0.25 } }} className="fixed inset-0 bg-canvas" />

      <header className="relative flex w-full items-center justify-center">
        <div ref={wordmarkRef}>
          <Wordmark />
        </div>
        <motion.div {...login} exit={leave} className="absolute right-0 top-1/2 -translate-y-1/2">
          <Button
            variant="quiet"
            onClick={goToPhysician}
            className="!h-8 gap-1.5 !px-3.5 text-[0.7rem] uppercase tracking-[0.08em]"
          >
            Physician login
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M8 7h9v9" /></svg>
          </Button>
        </motion.div>
      </header>

      <div className="relative flex w-full flex-1 flex-col-reverse items-center justify-center gap-10 lg:flex-row lg:gap-24">
        <motion.div {...copy} exit={leave} className="flex w-full max-w-[480px] flex-col items-start gap-6">
          <h2 className="display-lg sm:text-[3.5rem]">Your camera becomes a therapist’s eye.</h2>
          <p className="text-[1.125rem] leading-[1.55] text-ink-2">
            Personalized physical therapy for stroke patients. Please allow camera access to get started.
          </p>

          <Button onClick={allow} disabled={phase === 'requesting' || phase === 'ready'}>
            <CameraIcon />
            Allow camera access
          </Button>

          <AnimatePresence>
            {phase === 'denied' && (
              <motion.div
                role="status"
                initial={{ opacity: 0, transform: 'translateY(8px)' }}
                animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.45, ease: EASE_OUT } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="flex max-w-[44ch] flex-col items-start gap-3"
              >
                <p className="text-[0.95rem] leading-snug text-ink-2">{message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <ol className="flex flex-col gap-2.5 pt-2 text-[0.95rem]">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-baseline gap-3 text-ink-2">
                <span className="eyebrow tabular w-5 shrink-0 !text-ok">{String(i + 1).padStart(2, '0')}</span>
                {step}
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div {...lens} className="flex w-full max-w-[460px] flex-col items-center gap-4">
          <Lens ref={lensRef} />
          <motion.p exit={leave} role="status" className="eyebrow tabular">
            {CAPTIONS[phase]}
          </motion.p>
        </motion.div>
      </div>

      <motion.footer {...footer} exit={leave} className="relative text-center text-ink-2">
        Made by Ehan Shah, Daniel Cao, Himmet Dhaliwal, Jack Scarlett
      </motion.footer>
    </motion.main>
  );
}
