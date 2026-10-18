// The forward-reach session steps (PLAN.md §9.2) as plain text in the instruction card. The sleeve step appears only
// once a sleeve is connected, so camera-only mode never shows it (CLAUDE.md rule 9).
import { useLive } from '../live/store';
import { useSleeve } from '../sleeve/sleeveSession';

/** The step texts in order. */
function useSteps(): { id: string; text: string }[] {
  const reps = useLive((s) => s.reps);
  const conn = useSleeve((s) => s.conn);
  const sleeveOn = conn === 'live' || conn === 'zeroing';
  return [
    ...(sleeveOn ? [{ id: 'zero', text: 'Sleeve on: press Zero and sit still for 2 s' }] : []),
    { id: 'sit', text: 'Sit tall, feet flat, your side to the camera' },
    { id: 'rest', text: 'Let your arm hang straight and capture the rest pose' },
    { id: 'target', text: 'Pick Near or Far, then click the object on the video' },
    { id: 'reach', text: reps ? `Reach, touch, come back · ${reps} ${reps === 1 ? 'rep' : 'reps'} done` : 'Reach, touch the object, come back to rest' },
  ];
}

/** List of the session steps. */
export default function SessionSteps() {
  const steps = useSteps();
  return (
    <ol aria-label="Session steps" className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.id} className="text-[0.85rem] leading-snug text-ink-2">{s.text}</li>
      ))}
    </ol>
  );
}
