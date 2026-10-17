// Therapist portal (F9): live mirror of the patient's session with the AI's math visible, coach, mic and a focus view.
import { useEffect, useState } from 'react';
import AdjustmentsCard from '../doctor/AdjustmentsCard';
import CoachPanel from '../doctor/coach/CoachPanel';
import MicCard from '../doctor/coach/MicCard';
import DoctorLayout from '../doctor/DoctorLayout';
import LiveMathPanel from '../doctor/LiveMathPanel';
import { useMedia } from '../doctor/useMedia';
import VideoChips from '../doctor/VideoChips';
import { useDoctorFeed } from '../live/useDoctorFeed';

const WIDE_QUERY = '(min-width: 1280px)';

/** The /doctor page: subscribes to the live feed once and lays out the portal. */
export default function Doctor() {
  const feed = useDoctorFeed();
  const desktop = useMedia('(min-width: 1024px)');
  const [focusRequested, setFocus] = useState(false);
  const [mathOpen, setMathOpen] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const focus = focusRequested && desktop;

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  return (
    <DoctorLayout
      desktop={desktop}
      focus={focus}
      mathOpen={mathOpen || !desktop}
      onToggleFocus={() => setFocus((f) => !f)}
      adjustments={<AdjustmentsCard />}
      mic={<MicCard className="h-full w-full" />}
      coach={<CoachPanel className="h-full w-full" />}
      math={<LiveMathPanel open={mathOpen || !desktop} collapsible={desktop} onToggle={() => setMathOpen((o) => !o)} className="h-full" />}
      videoOverlay={<VideoChips mode={feed.mode} />}
    />
  );
}
