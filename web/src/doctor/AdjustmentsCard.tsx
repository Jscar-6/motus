// Solid white card for the therapist: live, plainly worded guidance from the rule state, plus the slot for Daniel's 3D arm (F7).
import { AnimatePresence, motion } from 'motion/react';
import { useLive, useThrottledSample } from '../live/store';
import type { LiveSample } from '../live/types';
import ArmViewer from '../arm/ArmViewer';
import ArmSlot from '../ui/ArmSlot';

type Tone = 'idle' | 'ok' | 'warn' | 'bad';
interface Guidance { key: string; tone: Tone; lines: string[] }

const DOT: Record<Tone, string> = { idle: 'bg-ink/25', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Formats a signed check value as an absolute number with 0 decimals. */
function deg(value: number | null): string {
  return value === null ? '' : Math.abs(value).toFixed(0);
}

/** Therapist-phrased guidance for the current frame. The key changes with meaning, not with every number. */
function guidance(sample: LiveSample | null, restCaptured: boolean, near: boolean): Guidance {
  if (!sample) return { key: 'waiting', tone: 'idle', lines: ['Waiting for the patient camera.'] };
  if (!restCaptured) return { key: 'rest', tone: 'idle', lines: ['Waiting for rest pose.', 'Ask the patient to sit tall and still for a moment.'] };
  const rules = sample.rules;
  if (!sample.pose || !rules || rules.uncertain) {
    return { key: 'uncertain', tone: 'warn', lines: ["Can't see the arm clearly.", 'Check the lighting and that the whole arm is in frame.'] };
  }
  const flagged = rules.checks.filter((c) => c.enabled && c.flagged);
  if (flagged.length > 0) {
    return {
      key: `flag:${flagged.map((c) => c.key).join()}`,
      tone: 'bad',
      lines: flagged.map((c) => {
        if (c.key === 'lean') return `Trunk leaning forward ${deg(c.value)}° on a ${rules.near ? 'near' : 'far'} target. Cue: sit back.`;
        if (c.key === 'hike') return 'Shoulder hiking. Cue: relax the shoulder down.';
        return `Trunk rotating ${deg(c.value)}°. Cue: keep the chest square.`;
      }),
    };
  }
  const warming = rules.checks.filter((c) => c.enabled && c.level === 'warn');
  if (warming.length > 0) {
    return {
      key: `warn:${warming.map((c) => c.key).join()}`,
      tone: 'warn',
      lines: warming.map((c) => (c.key === 'lean' ? `Trunk lean is building (${deg(c.value)}°). Watch it.` : c.key === 'hike' ? 'Shoulder starting to rise. Watch it.' : 'Trunk starting to rotate. Watch it.')),
    };
  }
  const leanSkipped = rules.checks.some((c) => c.key === 'lean' && !c.enabled);
  if (!near && leanSkipped) return { key: 'far', tone: 'ok', lines: ['Far target: forward lean is expected (RPSS).'] };
  return { key: 'clean', tone: 'ok', lines: ['Clean reach.'] };
}

/** The "Adjustment instructions" card. */
export default function AdjustmentsCard() {
  const sample = useThrottledSample(6);
  const restCaptured = useLive((s) => s.restCaptured);
  const near = useLive((s) => s.near);
  const g = guidance(sample, restCaptured, near);

  return (
    <div className="material-solid flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Adjustments</p>
        <span aria-hidden className={`size-2 rounded-full ${DOT[g.tone]}`} style={{ transition: 'background-color 400ms ease' }} />
      </div>
      <div className="relative mt-3 min-h-[6.5rem]" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={g.key}
            initial={{ opacity: 0, filter: 'blur(4px)', transform: 'translate3d(0px, 6px, 0px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translate3d(0px, 0px, 0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)', transform: 'translate3d(0px, -4px, 0px)', transition: { duration: 0.14, ease: EASE_OUT } }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            {g.lines.map((line, i) => (
              <p key={i} className={i === 0 ? 'text-[1.12rem] leading-snug text-ink tabular' : 'mt-1.5 text-[0.95rem] leading-snug text-ink-2 tabular'}>{line}</p>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      <ArmSlot className="mt-4 min-h-24 flex-1 bg-paper"><ArmViewer /></ArmSlot>
    </div>
  );
}
