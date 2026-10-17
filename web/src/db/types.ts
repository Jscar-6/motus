// F11 database row and recording-timeline types. Internal to web/; the tables are defined in supabase/schema.sql.
import type { CompLabel, Mode, Quat } from '../lib/types';
import type { FlagEvent, LiveSample } from '../live/types';

export type RecordingStatus = 'recording' | 'uploading' | 'ready' | 'failed';

/** One row of `patients`. */
export interface PatientRow {
  id: string;
  name: string;
  affected_side: 'left' | 'right';
  note: string | null;
  is_sample: boolean;
  created_at: string;
}

/** Peak values over a recording, from its timeline. */
export interface RecordingPeaks {
  maxLeanDeg?: number;
  maxHikeRatio?: number;
  minElbowDeg?: number;
  maxShoulderFlexDeg?: number;
}

/** One row of `recordings`. Paths are inside the `recordings` storage bucket. */
export interface RecordingRow {
  id: string;
  patient_id: string;
  exercise_id: string;
  mode: Mode;
  status: RecordingStatus;
  started_at: string;
  duration_ms: number | null;
  video_path: string | null;
  timeline_path: string | null;
  thumb_path: string | null;
  frame_count: number | null;
  flagged_frames: number | null;
  pct_compensating: number | null;
  flag_counts: Partial<Record<CompLabel, number>>;
  peaks: RecordingPeaks;
  is_sample: boolean;
}

/** A sleeve frame inside a timeline; `t` is ms since recording start. */
export interface TimelineSensor { t: number; upper: Quat; fore: Quat; chest: Quat }

/**
 * Everything needed to replay a recording in sync with its video: the live samples the patient's
 * screen saw (pose, features, rule state) and the sleeve frames. Every `t` is ms since recording start,
 * on the same clock as the video's currentTime * 1000.
 */
export interface RecordingTimeline {
  version: 1;
  recordingId: string;
  patientId: string;
  startedAt: string;          // ISO
  mode: Mode;
  samples: LiveSample[];      // LiveSample.t rebased to ms since start
  sensor: TimelineSensor[];
  flags: FlagEvent[];         // FlagEvent.t rebased to ms since start
}
