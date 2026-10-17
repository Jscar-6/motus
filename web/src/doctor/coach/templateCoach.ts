// Client-side coach used when the server or Gemini is unavailable. Deterministic; built only from CoachContext numbers.
import type { CompLabel } from '../../lib/types';
import type { BuzzSensitivity } from '../../live/types';
import type { CoachContext } from './context';

const NAMES: Partial<Record<CompLabel, string>> = {
  trunk_lean: 'Trunk lean',
  shoulder_hike: 'Shoulder hike',
  trunk_rotation: 'Trunk rotation',
  incomplete_reach: 'Incomplete reach',
  uncertain: 'Low tracking confidence',
};

const CUES: Partial<Record<CompLabel, string>> = {
  trunk_lean: 'Cue the patient to sit back before reaching.',
  shoulder_hike: 'Cue them to relax the shoulder down.',
  trunk_rotation: 'Cue them to keep the chest square to the table.',
  incomplete_reach: 'Cue them to reach a little further.',
  uncertain: 'Check that the camera can see the whole arm.',
};

/** Spell a small count as "once", "twice" or "N times". */
function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

/** Most frequent flag label in a counts map, or null when empty. */
function topLabel(counts: CoachContext['windowFlagCounts']): [CompLabel, number] | null {
  const entries = (Object.entries(counts) as [CompLabel, number][]).filter(([l, n]) => n > 0 && NAMES[l]);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0] ?? null;
}

/** One or two warm sentences about the last few seconds, from the context numbers only. */
export function templateNote(ctx: CoachContext): string {
  if (ctx.sampleCount === 0) return 'Waiting for movement. Ask the patient to start a reach and I will comment as it happens.';

  const lean = ctx.maxLean !== null ? ` at ${ctx.maxLean}°` : '';
  const current = ctx.flags.find((l) => NAMES[l]);
  if (current) {
    const detail = current === 'trunk_lean' ? ` Trunk lean${lean || ' is up'}.` : '';
    return `${NAMES[current]} is flagged right now.${detail} ${CUES[current]}`;
  }

  const recent = topLabel(ctx.windowFlagCounts);
  if (recent) {
    const [label, n] = recent;
    const where = label === 'trunk_lean' && ctx.maxLean !== null ? ` reached ${ctx.maxLean}°${ctx.near ? ' on near targets' : ''}` : ' showed up';
    return `${NAMES[label]}${where} ${times(n)} in the last few reps. ${CUES[label]}`;
  }

  const upright = ctx.maxLean !== null ? ` — trunk stayed within ${ctx.maxLean}° of upright` : '';
  return `Clean reaches so far${upright}. ${ctx.near ? 'Next: add a far-target set.' : 'Next: keep this pace.'}`;
}

/** Read a spoken instruction into a short reply and an optional buzz-sensitivity level. */
export function templateVoice(transcript: string): { reply: string; buzzSensitivity: BuzzSensitivity | null } {
  const text = transcript.toLowerCase();
  if (/\b(lower|softer|soft|gentle|gentler|less|reduce|decrease)\b/.test(text)) return { reply: 'Okay, sleeve buzz set to low.', buzzSensitivity: 'low' };
  if (/\b(stronger|more|higher|increase|louder)\b/.test(text)) return { reply: 'Okay, sleeve buzz set to high.', buzzSensitivity: 'high' };
  if (/\b(normal|default|medium|standard)\b/.test(text)) return { reply: 'Okay, sleeve buzz set to medium.', buzzSensitivity: 'medium' };
  return { reply: 'I can set the sleeve buzz to low, medium or high. Just say which.', buzzSensitivity: null };
}
