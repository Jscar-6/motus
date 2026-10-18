// Top-right account chip on the physician overview: who is signed in, and a way out.
import Button from '../ui/Button';
import { usePhysicianAuth } from './usePhysicianAuth';

/** The signed-in physician's email (wide screens) and a Sign out pill; renders nothing when signed out. */
export default function SignOutButton() {
  const { signedIn, email, signOut } = usePhysicianAuth();
  if (!signedIn) return null;
  return (
    <div className="flex items-center gap-3">
      {email && <span className="hidden max-w-[16rem] truncate text-[0.8rem] text-ink-2 md:inline">{email}</span>}
      <Button variant="quiet" onClick={() => signOut()} className="!h-8 !px-3.5 text-[0.7rem] uppercase tracking-[0.08em]">
        Sign out
      </Button>
    </div>
  );
}
