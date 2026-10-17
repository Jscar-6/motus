// BroadcastChannel transport between the patient tab and the therapist tab (internal to web/, not a §16 contract).
import type { LiveMessage } from './types';

const CHANNEL_NAME = 'truereach-live';

/** A handle on the live channel: post to the other tabs, or close it. */
export interface LiveChannel {
  post(m: LiveMessage): void;
  close(): void;
}

/** Open the live channel; `onMessage` hears every message from other channel instances (never its own). */
export function openLiveChannel(onMessage: (m: LiveMessage) => void): LiveChannel {
  const bc = new BroadcastChannel(CHANNEL_NAME);
  let closed = false;
  bc.onmessage = (e: MessageEvent<LiveMessage>) => onMessage(e.data);
  return {
    post(m) {
      if (!closed) bc.postMessage(m);
    },
    close() {
      closed = true;
      bc.close();
    },
  };
}
