// The forward-reach session steps (PLAN.md §9.2) as a checklist in the instruction card: each step ticks itself off
// from live state, and the first unticked one is highlighted. Sleeve steps appear only once a sleeve is connected,
// so camera-only mode never waits on them (CLAUDE.md rule 9).
import clsx from 'clsx';
import { FORWARD_REACH } from '../lib/config';
import type { PoseFrame } from '../lib/types';
import { useLive, useThrottledSample } from '../live/store';
import { useSleeve } from '../sleeve/sleeveSession';

interface Step { id: string; text: string; done: boolean }

/** True when every landmark the features use is visible enough to measure (same cut as the rules). */
function bodyVisible(pose: PoseFrame | null | undefined): boolean {
  if (!pose) return false;
  return [pose.ear, pose.shoulder, pose.elbow, pose.wrist, pose.hip].every((p) => (p.vis ?? 0) >= FORWARD_REACH.visMin);
}

/** The steps in order, each with whether it's done right now. */
function useSteps(): Step[] {
  const sample = useThrottledSample(4);
  const restCaptured = useLive((s) => s.restCaptured);
  const targetSet = useLive((s) => s.targetSet);
  const reps = useLive((s) => s.reps);
  const sleeve = useSleeve();
  const sleeveOn = sleeve.conn === 'live' || sleeve.conn === 'zeroing';
  const steps: Step[] = [];
  if (sleeveOn) steps.push({ id: 'zero', text: 'Sleeve on: press Zero and sit still for 2 s', done: sleeve.zero === 'ok' });
  steps.push(
    { id: 'sit', text: 'Sit tall, feet flat, your side to the camera', done: restCaptured || bodyVisible(sample?.pose) },
    { id: 'rest', text: 'Let your arm hang straight and capture the rest pose', done: restCaptured },
    { id: 'target', text: 'Pick Near or Far, then click the object on the video', done: targetSet },
    { id: 'reach', text: reps ? `Reach, touch, come back · ${reps} ${reps === 1 ? 'rep' : 'reps'} done` : 'Reach, touch the object, come back to rest', done: reps > 0 },
  );
  return steps;
}

/** Small round tick, filled when done. */
function Tick({ done, current }: { done: boolean; current: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'mt-[0.15em] grid size-4 shrink-0 place-items-center rounded-full border',
        done ? 'border-ok bg-ok text-white' : current ? 'border-ink-2' : 'border-ink-3/60',
      )}
      style={{ transitionProperty: 'background-color, border-color', transitionDuration: '300ms', transitionTimingFunction: 'ease' }}
    >
      {done && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2 5 8.5l4.5-5" />
        </svg>
      )}
    </span>
  );
}

/** Checklist of the session steps; the current step is darker, finished ones are ticked. */
export default function SessionSteps() {
  const steps = useSteps();
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="Session steps" className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={s.id} className="flex gap-2.5 text-[0.85rem] leading-snug">
          <Tick done={s.done} current={i === current} />
          <span className={clsx(s.done ? 'text-ink-3' : i === current ? 'font-medium text-ink' : 'text-ink-2')}>
            <span className="sr-only">{s.done ? 'Done: ' : i === current ? 'Now: ' : 'Next: '}</span>
            {s.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
