// Turns a live sample into one calm, warm cue for the patient (PLAN §20 I3b) and a severity for the alert tint.
import type { CheckState, LiveSample } from '../live/types';

export type CueId = 'idle' | 'rest' | 'uncertain' | 'lean' | 'hike' | 'rot' | 'warn' | 'clean';
export type Tone = 'neutral' | 'ok' | 'warn' | 'bad';

export interface Cue { id: CueId; status: string; text: string; tone: Tone }

/** What the alert tint shows: nothing, a soft grey (can't see the arm), amber, or red. */
export type Severity = 'clean' | 'uncertain' | 'warn' | 'flagged';

/** The enabled check with this key, if any. */
function check(sample: LiveSample, key: CheckState['key']): CheckState | undefined {
  return sample.rules?.checks.find((c) => c.key === key && c.enabled);
}

/** Cue for the current frame; without analysis it is the static exercise instruction, and the lean text carries the live degrees. */
export function getCue(sample: LiveSample | null, restCaptured: boolean): Cue {
  const rules = sample?.rules;
  if (!sample || !rules) {
    return { id: 'idle', status: 'Forward reach', tone: 'neutral', text: 'Reach forward to the target, then bring your arm back to rest.' };
  }
  if (!restCaptured) {
    return { id: 'rest', status: 'Hold still', tone: 'neutral', text: 'Sit tall, let your arm hang, and hold still for a moment.' };
  }
  if (rules.uncertain) {
    return { id: 'uncertain', status: "Can't see you", tone: 'neutral', text: "I can't quite see your arm. Turn so your side faces the screen." };
  }
  const lean = check(sample, 'lean');
  if (lean?.flagged) {
    const deg = Math.round(Math.abs(lean.value ?? 0));
    return { id: 'lean', status: 'Adjust', tone: 'bad', text: `Let's reset — sit back tall. You're leaning forward ${deg}°.` };
  }
  if (check(sample, 'hike')?.flagged) {
    return { id: 'hike', status: 'Adjust', tone: 'bad', text: 'Relax your shoulder down, away from your ear.' };
  }
  if (check(sample, 'rot')?.flagged) {
    return { id: 'rot', status: 'Adjust', tone: 'bad', text: 'Keep your chest facing forward as you reach.' };
  }
  if (rules.checks.some((c) => c.enabled && c.level !== 'ok')) {
    return { id: 'warn', status: 'Almost', tone: 'warn', text: 'Nice — keep your back tall as you reach.' };
  }
  return { id: 'clean', status: 'Looking good', tone: 'ok', text: 'Looking good. Reach for the target, then come back to rest.' };
}

/** Severity for the background tint; stays clean until the rest pose is captured. */
export function getSeverity(sample: LiveSample | null, restCaptured: boolean): Severity {
  const cue = getCue(sample, restCaptured);
  if (cue.id === 'uncertain') return 'uncertain';
  if (cue.tone === 'bad') return 'flagged';
  if (cue.tone === 'warn') return 'warn';
  return 'clean';
}
