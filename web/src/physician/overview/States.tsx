// Non-happy-path views of the physician overview: database setup, error and no patients.
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import Button from '../../ui/Button';
import { useSlideIn } from '../slideIn';

/** Centred frosted card shared by the state views. */
function StateCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const enter = useSlideIn(1);
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
