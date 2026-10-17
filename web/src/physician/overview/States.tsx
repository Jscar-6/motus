// Non-happy-path views of the physician overview: database setup, loading, error and no patients.
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Button from '../../ui/Button';
import { useMaterialize } from '../../patient/motion';

/** Centred frosted card shared by the state views. */
function StateCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const enter = useMaterialize({ y: 12 });
  return (
    <div className="grid flex-1 place-items-center py-8">
      <motion.section {...enter} className="material flex w-full max-w-md flex-col items-start gap-4 p-7">
        <h2 className="display-md">{title}</h2>
        <div className="flex flex-col gap-3 text-ink-2">{children}</div>
        {action}
      </motion.section>
    </div>
  );
}

/** Shown when web/.env.local has no Supabase keys; steps copied from supabase/README.md. */
export function SetupCard() {
  return (
    <StateCard title="Connect the database">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Create a free project at supabase.com.</li>
        <li>Dashboard → SQL → New query: run <code>schema.sql</code>, then <code>seed.sql</code> (adds the demo patient and badged sample patients).</li>
        <li>Dashboard → Project Settings → API: copy the Project URL and the anon public key into <code>web/.env.local</code> as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.</li>
      </ol>
    </StateCard>
  );
}

/** Load failure with a retry. */
export function ErrorCard({ message }: { message: string }) {
  return (
    <StateCard title="We couldn't load patients" action={<Button variant="quiet" onClick={() => window.location.reload()}>Try again</Button>}>
      <p role="alert">{message}</p>
    </StateCard>
  );
}

/** No patients in the database yet. */
export function EmptyCard() {
  return (
    <StateCard title="No patients yet">
      <p>Patients appear here as soon as someone starts a recording from the patient page.</p>
    </StateCard>
  );
}

/** Placeholder pill rows with a moving shimmer while data loads. */
export function SkeletonList() {
  const reduced = useReducedMotion();
  return (
    <div role="status" aria-label="Loading patients" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="material relative h-16 overflow-hidden" style={{ borderRadius: 9999, opacity: 1 - i * 0.18 }}>
          {!reduced && (
            <motion.div
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/2"
              style={{ background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.6), transparent)' }}
              initial={{ transform: 'translateX(-100%)' }}
              animate={{ transform: 'translateX(200%)' }}
              transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.4, delay: i * 0.1 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
