// Shared layout for the honest placeholder pages (Setup, Results): wordmark, one card, a way back.
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import Wordmark from '../ui/Wordmark';
import { useMaterialize } from './motion';

interface Props { eyebrow: string; title: string; body: string }

/** Placeholder page that says plainly which task fills it in. */
export default function PlaceholderPage({ eyebrow, title, body }: Props) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const card = useMaterialize({ delay: 0.1, y: 20, blur: 8, duration: 0.6 });
  return (
    <motion.main
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.2 : 0.25, ease: 'easeOut' } }}
      className="relative flex min-h-dvh flex-col p-6 lg:p-8"
    >
      <button type="button" aria-label="TrueReach, back to start" onClick={() => navigate('/')} className="pressable w-fit cursor-pointer" style={{ transitionProperty: 'transform' }}>
        <Wordmark size="md" />
      </button>
      <div className="grid flex-1 place-items-center py-10">
        <motion.section {...card} className="material flex w-full max-w-xl flex-col items-start gap-6 p-8 sm:p-12">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="display-lg text-ink">{title}</h2>
          <p className="max-w-[34ch] text-[1.125rem] leading-snug text-ink-2">{body}</p>
          <Button variant="quiet" onClick={() => navigate('/')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            Back to start
          </Button>
        </motion.section>
      </div>
    </motion.main>
  );
}
