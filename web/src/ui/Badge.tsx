// Small status chip: mode badge, "Demo data", "Gemini" / "Template", "Not data-validated".
import clsx from 'clsx';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'ink';

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/70 text-ink-2',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/14 text-[#8a5c0f]',
  bad: 'bg-bad/12 text-bad',
  ink: 'bg-ink text-paper',
};

/** Status chip with an optional live dot. */
export default function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 h-7 px-3 rounded-full font-display text-[0.7rem] tracking-[0.08em] uppercase whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
