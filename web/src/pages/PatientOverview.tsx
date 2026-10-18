// Patient overview for the physician (F11, Figma 5:13): recording playback, arm replay, session numbers, past recordings, coach and mic.
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ArmViewer from '../arm/ArmViewer';
import { useMedia } from '../doctor/useMedia';
import { hasDatabase } from '../db/supabase';
import { usePatients, useRecordings } from '../db/hooks';
import { readFlipOrigin } from '../landing/useFlipFrom';
import MicPanel from '../physician/patient/MicPanel';
import OverviewLayout from '../physician/patient/OverviewLayout';
import PastExercisesCard from '../physician/patient/PastExercisesCard';
import { PlayerOverlay, PlayerSurface } from '../physician/patient/RecordingPlayer';
import SessionDataCard from '../physician/patient/SessionDataCard';
import { useRecordingNote } from '../physician/patient/useRecordingNote';
import { useSelection } from '../physician/patient/useSelection';
import { useVoiceNote } from '../physician/patient/useVoiceNote';
import { usePlaybackFeed } from '../replay/usePlaybackFeed';
import { useTimeline } from '../replay/useTimeline';
import ArmSlot from '../ui/ArmSlot';

/** The /physician/:patientId page: loads the patient's recordings live and replays the selected one across the cards. */
export default function PatientOverview() {
  const { patientId = '' } = useParams();
  const { state } = useLocation();
  const [origin] = useState(() => readFlipOrigin(state));
  const patient = usePatients().data.find((p) => p.id === patientId);
  const recordings = useRecordings(patientId);
  const { selected, select, newIds } = useSelection(recordings.data);
  const timeline = useTimeline(selected);
  const note = useRecordingNote(selected);
  const voice = useVoiceNote(patientId);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const desktop = useMedia('(min-width: 1024px)');
  const [focusRequested, setFocus] = useState(false);
  const focus = focusRequested && desktop;

  const playing = video && selected && video.dataset.rid === selected.id ? video : null;
  usePlaybackFeed(playing, playing && timeline?.recordingId === selected?.id ? timeline : null);

  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  const name = patient?.name ?? 'This patient';
  const arm = (
    <section aria-label="Arm replay" className="material flex h-full flex-col gap-2 p-2.5">
      <span className="eyebrow truncate px-1.5 pt-1">{patient ? `${patient.name} · ${patient.affected_side} arm` : 'Arm replay'}</span>
      <ArmSlot className="min-h-0 flex-1"><ArmViewer /></ArmSlot>
    </section>
  );

  return (
    <OverviewLayout
      desktop={desktop}
      focus={focus}
      onToggleFocus={() => setFocus((f) => !f)}
      lensRect={origin?.lensRect}
      wordmarkRect={origin?.wordmarkRect}
      arm={arm}
      data={<SessionDataCard recording={selected} />}
      past={<PastExercisesCard recordings={recordings.data} selectedId={selected?.id ?? null} newIds={newIds} onSelect={select} voice={voice} note={note} />}
      mic={<MicPanel voice={voice} />}
      surface={<PlayerSurface recording={selected} patientName={name} configured={hasDatabase()} onVideo={setVideo} />}
      overlay={<PlayerOverlay recording={selected} video={playing} timeline={timeline} raised={desktop} />}
    />
  );
}
