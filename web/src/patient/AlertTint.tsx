// Full-viewport vignette behind the cards: beige when clean, deeper red as alerts fire (designer note, opacity only).
import { useLive, useThrottledSample } from '../live/store';
import { getSeverity, type Severity } from './cues';

const ALERT_OPACITY: Record<Severity, number> = { clean: 0, uncertain: 0, warn: 0.16, flagged: 0.42 };
const FADE = { transitionProperty: 'opacity', transitionDuration: '700ms', transitionTimingFunction: 'ease' } as const;

/** Slow, calm tint layer; two stacked vignettes so each only animates opacity. */
export default function AlertTint() {
  const sample = useThrottledSample(10);
  const restCaptured = useLive((s) => s.restCaptured);
  const severity = getSeverity(sample, restCaptured);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0">
      <div
        className="absolute inset-0"
        style={{
          ...FADE,
          opacity: ALERT_OPACITY[severity],
          background: 'radial-gradient(ellipse 90% 80% at 50% 45%, color-mix(in srgb, var(--color-alert) 30%, transparent), var(--color-alert) 110%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          ...FADE,
          opacity: severity === 'uncertain' ? 0.08 : 0,
          background: 'radial-gradient(ellipse 90% 80% at 50% 45%, transparent, var(--color-ink) 120%)',
        }}
      />
    </div>
  );
}
