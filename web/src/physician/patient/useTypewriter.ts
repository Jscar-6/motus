// Reveals text character by character toward a target that may keep growing (live transcript) or be replaced (coach note).
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** The first part of `text` that has "been typed" at `cps` characters per second; everything at once under reduced motion. */
export function useTypewriter(text: string, cps: number): string {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  const shown = useRef(0);
  const prev = useRef('');

  useEffect(() => {
    const old = prev.current;
    let common = 0;
    while (common < old.length && common < text.length && old[common] === text[common]) common++;
    prev.current = text;
    shown.current = Math.min(shown.current, common);
    if (reduced) {
      shown.current = text.length;
      setCount(text.length);
      return undefined;
    }
    setCount(Math.floor(shown.current));
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      shown.current = Math.min(text.length, shown.current + ((now - last) * cps) / 1000);
      last = now;
      setCount(Math.floor(shown.current));
      if (shown.current >= text.length) window.clearInterval(id);
    }, 33);
    return () => window.clearInterval(id);
  }, [text, cps, reduced]);

  return text.slice(0, Math.min(count, text.length));
}
