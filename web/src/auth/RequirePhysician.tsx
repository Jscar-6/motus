// Gate for the physician pages: renders them only for a signed-in physician, and fails closed when Auth0 isn't configured.
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { StateCard } from '../physician/overview/States';
import Button from '../ui/Button';
import Wordmark from '../ui/Wordmark';
import { usePhysicianAuth } from './usePhysicianAuth';

const SLOW_MS = 700;  // still checking after this long: show a quiet status line instead of an empty canvas

/** Page frame for the gate's cards: the wordmark back to start above a centred card. */
function GateFrame({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.main
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.2 : 0.25, ease: 'easeOut' } }}
      className="relative flex min-h-dvh flex-col overflow-x-clip p-4 sm:p-6"
    >
      <div className="mb-4 flex shrink-0 justify-center">
        <Link to="/" aria-label="TrueReach, back to start" className="pressable inline-block" style={{ transitionProperty: 'transform' }}>
          <Wordmark size="md" />
        </Link>
      </div>
      {children}
    </motion.main>
  );
}

/** Quiet status line shown only if the session check is slow, so a fast check shows nothing at all. */
function Checking() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <AnimatePresence>
      {slow && (
        <motion.p
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
          className="eyebrow grid min-h-dvh place-items-center"
        >
          Checking sign-in…
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Renders `children` for a signed-in physician; otherwise a setup, sign-in or access-denied card. */
export default function RequirePhysician({ children }: { children: ReactNode }) {
  const { configured, loading, signedIn, error, signIn } = usePhysicianAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (error && new URLSearchParams(search).has('error')) navigate(pathname, { replace: true });
  }, [error, search, pathname, navigate]);

  if (!configured) {
    return (
      <GateFrame>
        <StateCard title="Connect Auth0">
          <p>Patient recordings are only shown to signed-in physicians, so this page stays locked until sign-in is set up.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Auth0 Dashboard → Applications: open the TrueReach single-page app.</li>
            <li>Copy its Domain and Client ID into <code>web/.env.local</code> as <code>VITE_AUTH0_DOMAIN</code> and <code>VITE_AUTH0_CLIENT_ID</code>, then restart <code>npm run dev</code>.</li>
          </ol>
        </StateCard>
      </GateFrame>
    );
  }
  if (loading) return <Checking />;
  if (signedIn) return children;
  if (error) {
    return (
      <GateFrame>
        <StateCard title="Sign-in didn't go through" action={<Button variant="quiet" onClick={() => signIn(pathname, true)}>Sign in with another account</Button>}>
          <p role="alert">{error}</p>
        </StateCard>
      </GateFrame>
    );
  }
  return (
    <GateFrame>
      <StateCard title="Physician sign-in" action={<Button onClick={() => signIn(pathname)}>Sign in</Button>}>
        <p>Patient recordings and notes are only visible to invited physicians.</p>
      </StateCard>
    </GateFrame>
  );
}
