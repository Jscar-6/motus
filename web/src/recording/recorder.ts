// Records the webcam stream plus a replay timeline, then uploads both to Supabase as fast as possible (F11).
import { onSensorFrame, sensorStatus } from '../arm/armInput';
import { createRecording, recordingPaths, updateRecording, uploadFile } from '../db/api';
import type { RecordingPeaks, RecordingRow, RecordingTimeline, TimelineSensor } from '../db/types';
import type { CompLabel } from '../lib/types';
import type { FlagEvent, LiveSample } from '../live/types';
import { useLive } from '../live/store';

// Keeps the WebM under the Supabase free tier's 50 MB per-file cap at 1.5 Mbps (4 min is about 45 MB).
export const MAX_RECORDING_MS = 4 * 60_000;
const VIDEO_BPS = 1_500_000;
const THUMB_WIDTH = 360;
const MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'] as const;

type Stats = Pick<RecordingRow, 'duration_ms' | 'frame_count' | 'flagged_frames' | 'pct_compensating' | 'flag_counts' | 'peaks'>;

export interface FinishedRecording {
  video: Blob;
  videoExt: string;
  thumb: Blob | null;
  timeline: Omit<RecordingTimeline, 'recordingId'>;
  stats: Stats;
  row: Promise<RecordingRow | null>;
  marked: Promise<unknown>;  // the 'uploading' status write; 'ready' waits for it so the two can't land out of order
}

export interface RecordingHandle {
  startedAt: number;
  stop: () => Promise<FinishedRecording>;
}

interface StartOptions {
  stream: MediaStream;
  video: HTMLVideoElement;
  patientId: string;
  onAutoStop: () => void;
}

/** Round floats to 4 decimals so the timeline JSON stays small. */
function round4(_key: string, value: unknown): unknown {
  return typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * 1e4) / 1e4 : value;
}

/** First container/codec this browser can record, or undefined when MediaRecorder cannot record at all. */
function pickMime(): string | undefined {
  return MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
}

/** A copy of a live sample with every timestamp as ms since the recording started. */
function rebase(sample: LiveSample, t0: number): LiveSample {
  return {
    ...sample,
    t: sample.t - t0,
    pose: sample.pose && { ...sample.pose, t: sample.pose.t - t0 },
    features: sample.features && { ...sample.features, t: sample.features.t - t0 },
  };
}

/** Summary numbers for the physician's overview, computed from the timeline. */
function computeStats(samples: LiveSample[], flags: FlagEvent[], durationMs: number): Stats {
  const withFeatures = samples.filter((s) => s.features);
  const flagged = withFeatures.filter((s) => (s.rules?.flags.length ?? 0) > 0).length;
  const flagCounts: Partial<Record<CompLabel, number>> = {};
  flags.forEach((f) => { flagCounts[f.label] = (flagCounts[f.label] ?? 0) + 1; });
  const peaks: RecordingPeaks = {};
  withFeatures.forEach(({ features: f }) => {
    if (!f) return;
    peaks.maxLeanDeg = Math.max(peaks.maxLeanDeg ?? -Infinity, f.leanDeg);
    peaks.maxHikeRatio = Math.max(peaks.maxHikeRatio ?? -Infinity, f.hikeRatio);
    peaks.minElbowDeg = Math.min(peaks.minElbowDeg ?? Infinity, f.elbowDeg);
    peaks.maxShoulderFlexDeg = Math.max(peaks.maxShoulderFlexDeg ?? -Infinity, f.shoulderFlexDeg);
  });
  return {
    duration_ms: Math.round(durationMs),
    frame_count: withFeatures.length,
    flagged_frames: flagged,
    pct_compensating: withFeatures.length ? flagged / withFeatures.length : null,
    flag_counts: flagCounts,
    peaks,
  };
}

/** JPEG of the current video frame at thumbnail size, or null if the frame cannot be read. */
function captureThumb(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = Math.round((THUMB_WIDTH * video.videoHeight) / video.videoWidth);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

/** Start recording the camera stream; the database row is inserted in the background so recording starts at once. */
export async function startRecording({ stream, video, patientId, onAutoStop }: StartOptions): Promise<RecordingHandle> {
  const picked = pickMime();
  if (!picked) throw new Error('This browser cannot record video');
  const mime: string = picked;
  const mode = sensorStatus() === 'streaming' ? 'camera+sleeve' : 'camera';
  const row = createRecording(patientId, mode).catch(() => null);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BPS });
  const chunks: Blob[] = [];
  const samples: LiveSample[] = [];
  const flags: FlagEvent[] = [];
  const sensor: TimelineSensor[] = [];
  const startedAtIso = new Date().toISOString();
  let t0 = performance.now();
  let stopTimer = 0;
  let unsubscribe: Array<() => void> = [];
  let stopping: Promise<FinishedRecording> | null = null;

  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const started = new Promise<void>((resolve, reject) => {
    recorder.onstart = () => resolve();
    recorder.onerror = () => reject(new Error('Recording failed to start'));
  });
  recorder.start(1000);
  await started;
  t0 = performance.now();

  unsubscribe = [
    useLive.subscribe((state, prev) => {
      if (state.latest && state.latest !== prev.latest) samples.push(rebase(state.latest, t0));
      const flag = state.flags[0];
      if (flag && flag !== prev.flags[0]) flags.push({ ...flag, t: flag.t - t0 });
    }),
    onSensorFrame((f) => sensor.push({ t: f.t - t0, upper: f.upper, fore: f.fore, chest: f.chest })),
  ];
  stopTimer = window.setTimeout(onAutoStop, MAX_RECORDING_MS);

  /** Stop the recorder, release listeners and package everything for upload. */
  async function finish(): Promise<FinishedRecording> {
    window.clearTimeout(stopTimer);
    unsubscribe.forEach((fn) => fn());
    const durationMs = performance.now() - t0;
    const thumb = await captureThumb(video).catch(() => null);
    if (recorder.state !== 'inactive') {
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.stop();
      await stopped;
    }
    const marked = row.then((r) => r && updateRecording(r.id, { status: 'uploading' })).catch(() => undefined);
    return {
      video: new Blob(chunks, { type: recorder.mimeType || mime }),
      videoExt: (recorder.mimeType || mime).includes('mp4') ? 'mp4' : 'webm',
      thumb,
      timeline: { version: 1, patientId, startedAt: startedAtIso, mode, samples, sensor, flags },
      stats: computeStats(samples, flags, durationMs),
      row,
      marked,
    };
  }

  return {
    get startedAt() { return t0; },
    stop: () => (stopping ??= finish()),
  };
}

/** Upload the video, timeline and thumbnail in parallel, then mark the row ready; marks it failed and rethrows on error so the caller can retry. */
export async function uploadRecording(rec: FinishedRecording): Promise<void> {
  let row = await rec.row;
  try {
    row ??= await createRecording(rec.timeline.patientId, rec.timeline.mode);
    const id = row.id;
    const paths = recordingPaths(row, rec.videoExt);
    const timelineBlob = new Blob([JSON.stringify({ ...rec.timeline, recordingId: id }, round4)], { type: 'application/json' });
    await Promise.all([
      uploadFile(paths.video, rec.video, rec.video.type.split(';')[0] || 'video/webm'),
      uploadFile(paths.timeline, timelineBlob, 'application/json'),
      rec.thumb ? uploadFile(paths.thumb, rec.thumb, 'image/jpeg') : Promise.resolve(null),
    ]);
    await rec.marked;
    await updateRecording(id, {
      status: 'ready',
      video_path: paths.video,
      timeline_path: paths.timeline,
      thumb_path: rec.thumb ? paths.thumb : null,
      ...rec.stats,
    });
    rec.row = Promise.resolve(row);
  } catch (err) {
    if (row) void updateRecording(row.id, { status: 'failed' }).catch(() => undefined);
    rec.row = Promise.resolve(row);
    throw err;
  }
}
