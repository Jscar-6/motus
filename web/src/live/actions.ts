// Controls shared by both tabs: update the store, tell the other tab, and tell a pipeline running in this tab.
import type { Pipeline } from './pipeline';
import { openLiveChannel, type LiveChannel } from './channel';
import { useLive } from './store';
import type { BuzzSensitivity, LiveMessage } from './types';

let channel: LiveChannel | null = null;
let localPipeline: Pipeline | null = null;

/** Apply a control message that came from the other tab (never re-broadcast, so tabs cannot loop). */
function applyRemote(m: LiveMessage): void {
  if (m.type === 'target') useLive.setState({ near: m.near });
  else if (m.type === 'buzz') useLive.setState({ buzz: m.level });
  else if (m.type === 'recaptureRest') localPipeline?.recaptureRest();
}

/** Start hearing the other tab's control messages (idempotent). Hooks call this on mount. */
export function listenForActions(): void {
  channel ??= openLiveChannel(applyRemote);
}

/** Tell actions which pipeline runs in this tab (or null), so rest re-capture reaches it. Internal to the hooks. */
export function registerLocalPipeline(p: Pipeline | null): void {
  localPipeline = p;
  listenForActions();
}

/** Send a control message to the other tab. */
function broadcast(m: LiveMessage): void {
  listenForActions();
  channel!.post(m);
}

/** Choose the near or far target; the lean check follows it. */
export function setNear(near: boolean): void {
  useLive.setState({ near });
  broadcast({ type: 'target', near });
}

/** Ask the running pipeline (here or in the patient tab) to capture a new rest pose. */
export function requestRecaptureRest(): void {
  localPipeline?.recaptureRest();
  broadcast({ type: 'recaptureRest' });
}

/** Set the buzz sensitivity (read by S3 when it lands). */
export function setBuzz(level: BuzzSensitivity): void {
  useLive.setState({ buzz: level });
  broadcast({ type: 'buzz', level });
}
