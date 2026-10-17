// Landing: the wordmark materializes letter by letter over a stippled reach arc; one button asks for the webcam.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import StippleArc from '../patient/StippleArc';
import { EASE_OUT, useMaterialize } from '../patient/motion';

const WORD = 'TrueReach';
const LETTER_STAGGER = 0.035;
const MESSAGES = {
  blocked: 'Camera access was blocked. You can allow it from the address bar, or look around with demo data.',
  missing: "We couldn't find a camera on this device. You can still look around with demo data.",
} as const;

type Phase = 'idle' | 'requesting' | 'denied';

/** Camera icon, 1.75px stroke like the rest of the icon set. */
function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.4a1 1 0 0 0 .8-.4L8.9 4a1 1 0 0 1 .8-.4h4.6a1 1 0 0 1 .8.4l1.2 1.6a1 1 0 0 0 .8.4h1.4A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

/** The wordmark, one blurred letter at a time (plays once). */
function HeroWordmark() {
  const reduced = useReducedMotion();
  const whole = useMaterialize({ y: 0, blur: 0, duration: 0.4 });
  return (
    <h1 aria-label={WORD} className="display-xl select-none text-ink">
      {reduced ? (
        <motion.span aria-hidden className="inline-block" {...whole}>{WORD}</motion.span>
      ) : (
        WORD.split('').map((letter, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="inline-block"
            initial={{ opacity: 0, filter: 'blur(10px)', transform: 'translateY(24px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)' }}
            transition={{ duration: 0.7, delay: 0.1 + i * LETTER_STAGGER, ease: EASE_OUT }}
          >
            {letter}
          </motion.span>
        ))
      )}
    </h1>
  );
}

/** Landing page. */
export default function Landing() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string>(MESSAGES.blocked);
  const [granted, setGranted] = useState(false);
  const tagline = useMaterialize({ delay: 0.75, y: 12, blur: 6 });
  const actions = useMaterialize({ delay: 0.9, y: 12, blur: 6 });
  const footer = useMaterialize({ delay: 1.05, y: 8, blur: 4 });

  useEffect(() => {
    let live = true;
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => { if (live) setGranted(status.state === 'granted'); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  /** Ask for the webcam (or reuse a standing grant), then hand over to the session page. */
  async function allow() {
    if (granted) {
      navigate('/session');
      return;
    }
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      navigate('/session');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setMessage(name === 'NotAllowedError' || name === 'SecurityError' ? MESSAGES.blocked : MESSAGES.missing);
      setPhase('denied');
    }
  }

  return (
    <motion.main
      initial={{ opacity: 1, filter: 'blur(0px)' }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, filter: 'blur(12px)', transition: { duration: 0.35, ease: 'easeOut' } }}
      className="relative flex min-h-dvh flex-col items-center overflow-hidden px-6"
    >
      <StippleArc className="pointer-events-none absolute left-1/2 top-0 w-[min(1300px,100vw)] -translate-x-1/2 text-ink sm:-top-[2%]" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center pb-20 pt-16 text-center">
        <HeroWordmark />
        <motion.p {...tagline} className="mt-5 max-w-[28ch] font-serif text-[1.25rem] leading-snug text-ink-2 sm:max-w-none sm:text-[1.5rem]">
          A therapist&apos;s eye for every reach at home.
        </motion.p>

        <motion.div {...actions} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={allow} disabled={phase === 'requesting'} className="h-14 px-8 text-[1.05rem]">
            <CameraIcon />
            {granted ? 'Continue to session' : 'Allow webcam access'}
          </Button>
          <Button variant="quiet" onClick={() => navigate('/doctor')} className="h-14 px-7">Therapist portal</Button>
        </motion.div>

        <div className="mt-6 min-h-24 max-w-[44ch]">
          <AnimatePresence>
            {phase === 'denied' && (
              <motion.div
                role="status"
                initial={{ opacity: 0, filter: 'blur(6px)', transform: 'translateY(8px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translateY(0px)', transition: { duration: 0.45, ease: EASE_OUT } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="flex flex-col items-center gap-3"
              >
                <p className="text-[1rem] leading-snug text-ink-2">{message}</p>
                <Button variant="quiet" onClick={() => navigate('/session?demo=1')} className="h-10 px-5 text-[0.85rem]">Try with demo data</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.footer {...footer} className="relative z-10 pb-8 text-center font-serif text-[0.9rem] text-ink-2">
        Made by Ehan Shah, Daniel Cao, Himmet Dhaliwal, Jack Scarlet
      </motion.footer>
    </motion.main>
  );
}
