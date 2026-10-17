// The TrueReach wordmark in Tanker. Pass layoutId to let it glide between positions (doctor focus view).
import { motion } from 'motion/react';
import clsx from 'clsx';

interface Props { className?: string; layoutId?: string; size?: 'sm' | 'md' | 'xl' }

const SIZES = { sm: 'text-[1.5rem] leading-none', md: 'text-[2rem] leading-none tracking-[-0.01em]', xl: 'display-xl' };

/** Brand wordmark. */
export default function Wordmark({ className, layoutId, size = 'md' }: Props) {
  return (
    <motion.h1
      layoutId={layoutId}
      layout={layoutId ? 'position' : undefined}
      transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
      className={clsx('font-display text-ink select-none', SIZES[size], className)}
    >
      TrueReach
    </motion.h1>
  );
}
