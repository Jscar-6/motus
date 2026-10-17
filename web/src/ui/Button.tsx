// Pill button with press feedback. `primary` is ink on canvas; `quiet` is a frosted chip.
import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'quiet' }

/** Pressable pill button. */
export default function Button({ variant = 'primary', className, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={clsx(
        'pressable inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 font-display text-[0.95rem] tracking-[0.02em] cursor-pointer select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        variant === 'primary' && 'bg-ink text-paper shadow-[var(--shadow-float)] [@media(hover:hover)]:hover:bg-[#3a251b]',
        variant === 'quiet' && 'material !rounded-full text-ink [@media(hover:hover)]:hover:bg-white/80',
        className,
      )}
      style={{ transitionProperty: 'transform, background-color', ...rest.style }}
    />
  );
}
