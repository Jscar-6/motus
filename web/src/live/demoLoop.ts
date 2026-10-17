// requestAnimationFrame loop that feeds fake poses through a pipeline (demo mode in both tabs).
import type { Side } from '../lib/types';
import { createFakePoseSource, FAKE_ASPECT } from './fakePose';
import type { Pipeline } from './pipeline';
import type { LiveSample } from './types';

/** Run fake poses through `pipeline` every animation frame; returns the stop function. */
export function startDemoLoop(
  getSide: () => Side,
  pipeline: Pipeline,
  onSample?: (sample: LiveSample) => void,
): () => void {
  let side = getSide();
  let source = createFakePoseSource(side);
  let rafId = 0;
  const tick = () => {
    if (getSide() !== side) {
      side = getSide();
      source = createFakePoseSource(side);
    }
    const sample = pipeline.process(source(performance.now()), FAKE_ASPECT);
    onSample?.(sample);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
