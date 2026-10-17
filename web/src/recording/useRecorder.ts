// React hook over the recorder: state machine, elapsed clock, and the reason recording is unavailable.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useActivePatient } from '../db/activePatient';
import { hasDatabase } from '../db/supabase';
import { startRecording, uploadRecording, type FinishedRecording, type RecordingHandle } from './recorder';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'uploading' | 'sent' | 'error';

const SENT_MS = 2500;
const TICK_MS = 250;

interface Options { videoRef: RefObject<HTMLVideoElement>; cameraRunning: boolean }

/** Recording controls for the session page; leaving the page stops the recording and still uploads it. */
export function useRecorder({ videoRef, cameraRunning }: Options) {
  const { patient, configured } = useActivePatient();
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const handle = useRef<RecordingHandle | null>(null);
  const finished = useRef<FinishedRecording | null>(null);
  const timer = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const reason = !hasDatabase() || !configured
    ? 'Connect the database to record (see supabase/README.md)'
    : !patient
    ? 'No patient selected'
    : !cameraRunning
    ? 'Start the camera to record'
    : null;

  /** Upload the finished recording; success shows "sent" briefly, failure keeps the blobs for retry. */
  const upload = useCallback(async (rec: FinishedRecording) => {
    setState('uploading');
    try {
      await uploadRecording(rec);
      finished.current = null;
      setState('sent');
      window.setTimeout(() => { if (stateRef.current === 'sent') setState('idle'); }, SENT_MS);
    } catch {
      setState('error');
    }
  }, []);

  const stop = useCallback(async () => {
    const h = handle.current;
    if (!h) return;
    handle.current = null;
    window.clearInterval(timer.current);
    setState('uploading');
    let rec: FinishedRecording;
    try {
      rec = await h.stop();
    } catch {
      setState('error');
      return;
    }
    finished.current = rec;
    await upload(rec);
  }, [upload]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    const stream = video?.srcObject;
    if (!video || !(stream instanceof MediaStream) || !patient || stateRef.current !== 'idle') return;
    setState('starting');
    try {
      handle.current = await startRecording({ stream, video, patientId: patient.id, onAutoStop: () => void stop() });
    } catch {
      setState('error');
      return;
    }
    setElapsedMs(0);
    setState('recording');
    timer.current = window.setInterval(() => {
      if (handle.current) setElapsedMs(performance.now() - handle.current.startedAt);
    }, TICK_MS);
  }, [videoRef, patient, stop]);

  const retry = useCallback(() => {
    if (finished.current) void upload(finished.current);
    else setState('idle');
  }, [upload]);

  useEffect(() => () => {
    window.clearInterval(timer.current);
    void handle.current?.stop().then(uploadRecording).catch(() => undefined);
  }, []);

  return { state, elapsedMs, available: reason === null, reason, start, stop, retry };
}
