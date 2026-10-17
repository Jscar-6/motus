// Tracks a CSS media query so layout can switch between the desktop grid and the stacked layout.
import { useEffect, useState } from 'react';

/** True while the media query matches; updates when the viewport crosses it. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
