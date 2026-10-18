// State and per-frame logic of the camera-only vision model (C1–C5): rest-pose capture, live §6.1 features,
// near/far target touch, reps and rule verdicts. Shared by the pose check page (VisionCheck) and the Session overlay.
import { useRef, useState } from 'react';
import { FORWARD_REACH } from '../lib/config';
import { computeFeatures, RestPoseCapture, type RestCaptureStatus } from '../lib/features';
import { RepTracker } from '../lib/reps';
import { createRuleTracker, finishRep, type RuleState } from '../lib/rules';
import type { CompLabel, FrameFeatures, PoseFrame, RepResult, Side, Target } from '../lib/types';
import { buzzOnFlags, captureSleeveRest, withSleeve } from '../sleeve/sleeveSession';
import { isTouching } from './target';

/** Vision model state plus the handlers the camera and controls call. */
export function useVisionModel() {
  const [side, setSide] = useState<Side>('right');
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [features, setFeatures] = useState<FrameFeatures | null>(null);
  const [capture, setCapture] = useState<RestCaptureStatus | null>(null);
  const [fps, setFps] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);
  const [near, setNear] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [touching, setTouching] = useState(false);
  const [inRep, setInRep] = useState(false);
  const [reps, setReps] = useState<RepResult[]>([]);
  const [rules, setRules] = useState<RuleState | null>(null);
  const repTracker = useRef(new RepTracker(FORWARD_REACH, 'camera'));
  const ruleTracker = useRef(createRuleTracker(FORWARD_REACH));
  const repFlags = useRef(new Set<CompLabel>());
  const times = useRef<number[]>([]);
  const capturing = useRef<RestPoseCapture | null>(null);
  const wantCapture = useRef(false);
  const rest = useRef<PoseFrame | null>(null);

  /** Track frame rate, run the rest capture if active, compute features, and check the target touch. */
  const onPose = (f: PoseFrame | null, aspect: number) => {
    const now = performance.now();
    setAspect(aspect);
    const touch = !!f && !!target && isTouching(f, target, FORWARD_REACH.touchRadius!, FORWARD_REACH.visMin, aspect);
    setTouching(touch);
    times.current = [...times.current.filter((t) => now - t < 1000), now];
    setFps(times.current.length);
    setFrame(f);
    if (wantCapture.current) {
      wantCapture.current = false;
      capturing.current = new RestPoseCapture(FORWARD_REACH.visMin, aspect);
    }
    if (capturing.current) {
      const status = capturing.current.push(f);
      setCapture(status);
      if (status.kind === 'done') {
        rest.current = status.restPose;
        captureSleeveRest();
        repTracker.current.reset();
        ruleTracker.current.reset();
        capturing.current = null;
      }
    }
    // With a connected, rested sleeve, lean / rotation / elbow come from the IMUs (PLAN.md §6.1); otherwise camera only.
    const feats = withSleeve(f && rest.current ? computeFeatures(f, rest.current, aspect) : null);
    setFeatures(feats);
    if (rest.current) {
      const state = ruleTracker.current.update(feats, target?.near ?? true);
      setRules(state);
      buzzOnFlags(state.flags);
      const ev = repTracker.current.update({ features: feats, touching: touch, near: target?.near });
      setInRep(ev.kind === 'started' || ev.kind === 'in_rep');
      if (ev.kind === 'started') repFlags.current.clear();
      if (ev.kind === 'started' || ev.kind === 'in_rep' || ev.kind === 'ended') state.flags.forEach((l) => repFlags.current.add(l));
      if (ev.kind === 'ended') {
        const result = finishRep(FORWARD_REACH, ev.rep, repFlags.current);
        setReps((r) => [result, ...r]);
      }
    }
  };

  /** Pick the tracked side; an old rest pose belongs to the other side, so drop it. */
  const pickSide = (s: Side) => {
    setSide(s);
    rest.current = null;
    repTracker.current.reset();
    ruleTracker.current.reset();
    capturing.current = null;
    setCapture(null);
  };

  /** Pick near or far; a placed target keeps its point and takes the new choice. */
  const pickNear = (isNear: boolean) => {
    setNear(isNear);
    setTarget((t) => (t ? { ...t, near: isNear } : t));
  };

  /** Start a rest-pose capture on the next frame. */
  const requestCapture = () => {
    wantCapture.current = true;
  };

  return {
    side, frame, features, capture, fps, aspect, near, target, touching, inRep, reps, rules,
    onPose, pickSide, pickNear, requestCapture, setTarget,
  };
}
