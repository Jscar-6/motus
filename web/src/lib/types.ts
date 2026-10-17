// Shared contracts (PLAN.md §16). Change only via an [ACCEPTED] entry in PLAN.md §20.

export type Quat = [w: number, x: number, y: number, z: number];
export type Side = 'left' | 'right';
export type Mode = 'camera' | 'camera+sleeve';

export interface SensorFrame { t: number; upper: Quat; fore: Quat; chest: Quat } // t = performance.now()
export interface Point2 { x: number; y: number; vis?: number }                   // normalized 0–1
export interface PoseFrame { t: number; side: Side; ear: Point2; shoulder: Point2; elbow: Point2; wrist: Point2; hip: Point2 }

export interface ExerciseProfile {
  id: string; name: string;
  source: 'TRSP' | 'therapist'; validated: boolean; useModel: boolean;   // only forward_reach: TRSP / true / true
  goal: { kind: 'touch_target' } | { kind: 'shoulder_flex'; targetDeg: number };
  usesNearFar: boolean;
  checks: { lean: 'off' | 'near_only' | 'always'; hike: boolean; rot: boolean };
  thresholds: { lean: number; hike: number; rot: number };               // sources in config.ts comments
  minFlagMs: number; visMin: number; touchRadius?: number; nearRatio?: number; farRatio?: number;
}

export interface Prescription { side: Side; exerciseId: string; target?: 'near' | 'far'; reps: number; sets: number }
export interface Calibration {
  t: number; mode: Mode; armLengthCm: number; shoulderToEdgeCm: number;   // tape measure (§9.1)
  restPose: PoseFrame; restQuats?: { upper: Quat; fore: Quat; chest: Quat }; // restQuats only with sleeve
}
export interface Target { point: [number, number]; near: boolean }        // click on object; near = chosen tape mark

// Same definitions in ml/features.py (§6.1).
export interface FrameFeatures {
  t: number; leanDeg: number; hikeRatio: number; rotDeg: number | null;
  elbowDeg: number; shoulderFlexDeg: number; vis: number;
}

export type CompLabel = 'clean' | 'trunk_lean' | 'shoulder_hike' | 'trunk_rotation' | 'incomplete_reach' | 'uncertain';

export interface RepResult {
  repId: string; exerciseId: string; tStart: number; tEnd: number; near?: boolean; reached: boolean; mode: Mode;
  maxLeanDeg: number; maxHikeRatio: number; maxRotDeg: number | null; minElbowDeg: number; maxShoulderFlexDeg: number; minVis: number;
  ruleFlags: CompLabel[]; modelFlags?: CompLabel[]; modelProbs?: Record<string, number>; recordedLabel?: CompLabel; // recordedLabel: I4 only
}

export interface SessionSummary { sessionId: string; startedAt: string; mode: Mode; prescription: Prescription; reps: RepResult[] }
