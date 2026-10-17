// Per-session pipeline: auto-captures the rest pose, then pose → features → rule state → store.
import { FORWARD_REACH } from '../lib/config';
import type { CompLabel, ExerciseProfile, Point2, PoseFrame } from '../lib/types';
import { computeFeatures, type RestPose } from './featuresStub';
import { createRuleTracker } from './rulesStub';
import { pushFlag, pushSample, useLive } from './store';
import type { LiveSample } from './types';

const REST_WINDOW_MS = 1000;
// STUB(C2): stillness placeholder until C2's rest-pose check (square units of frame height).
const REST_STILL_EPSILON = 0.02;
const JOINTS = ['ear', 'shoulder', 'elbow', 'wrist', 'hip'] as const;

/** Feeds frames in and keeps the store up to date. */
export interface Pipeline {
  process(pose: PoseFrame | null, aspect: number): LiveSample;
  recaptureRest(): void;
}

/** Lowest visibility of the five tracked points (a missing value counts as 0). */
function poseVis(p: PoseFrame): number {
  return Math.min(p.ear.vis ?? 0, p.shoulder.vis ?? 0, p.elbow.vis ?? 0, p.wrist.vis ?? 0, p.hip.vis ?? 0);
}

/** True when the wrist or shoulder moved more than the stillness epsilon between two poses. */
function moved(a: PoseFrame, b: PoseFrame, aspect: number): boolean {
  const shift = (p: Point2, q: Point2) => Math.hypot((p.x - q.x) * aspect, p.y - q.y);
  return Math.max(shift(a.wrist, b.wrist), shift(a.shoulder, b.shoulder)) > REST_STILL_EPSILON;
}

/** Average a run of poses joint by joint. */
function meanPose(frames: readonly PoseFrame[]): PoseFrame {
  const last = frames[frames.length - 1];
  const mean = (joint: (typeof JOINTS)[number]): Point2 => {
    let x = 0;
    let y = 0;
    let vis = 0;
    for (const f of frames) {
      x += f[joint].x;
      y += f[joint].y;
      vis += f[joint].vis ?? 0;
    }
    return { x: x / frames.length, y: y / frames.length, vis: vis / frames.length };
  };
  return {
    t: last.t,
    side: last.side,
    ear: mean('ear'),
    shoulder: mean('shoulder'),
    elbow: mean('elbow'),
    wrist: mean('wrist'),
    hip: mean('hip'),
  };
}

/** Create a pipeline for one exercise profile (forward reach by default). */
export function createPipeline(profile: ExerciseProfile = FORWARD_REACH): Pipeline {
  const tracker = createRuleTracker(profile);
  const candidates: PoseFrame[] = [];
  let rest: RestPose | null = null;
  let active: CompLabel[] = [];
  let flagSeq = 0;

  /** Collect still, well-visible frames; after REST_WINDOW_MS of them, the mean pose becomes the rest pose. */
  const collectRest = (pose: PoseFrame, aspect: number) => {
    if (poseVis(pose) < profile.visMin) {
      candidates.length = 0;
      return;
    }
    if (candidates.length && moved(candidates[0], pose, aspect)) candidates.length = 0;
    candidates.push(pose);
    if (pose.t - candidates[0].t >= REST_WINDOW_MS) {
      rest = { pose: meanPose(candidates), aspect };
      candidates.length = 0;
      useLive.setState({ restCaptured: true });
    }
  };

  /** Push a FlagEvent for every label that was not flagged on the previous frame. */
  const emitRisingEdges = (sample: LiveSample) => {
    const flags = sample.rules?.flags ?? [];
    for (const label of flags) {
      if (active.includes(label)) continue;
      const value = sample.rules?.checks.find((c) => c.label === label)?.value ?? 0;
      pushFlag({ id: `${label}-${++flagSeq}`, t: sample.t, label, value });
    }
    active = flags;
  };

  return {
    process(pose, aspect) {
      if (!rest) {
        if (pose) collectRest(pose, aspect);
        else candidates.length = 0;
      }
      const features = rest && pose ? computeFeatures(pose, rest, aspect) : null;
      const rules = rest ? tracker.update(features, useLive.getState().near) : null;
      const sample: LiveSample = { t: pose?.t ?? performance.now(), pose, features, rules, aspect };
      pushSample(sample);
      emitRisingEdges(sample);
      return sample;
    },
    recaptureRest() {
      rest = null;
      candidates.length = 0;
      active = [];
      tracker.reset();
      useLive.setState({ restCaptured: false });
    },
  };
}
