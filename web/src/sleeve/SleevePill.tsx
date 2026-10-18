// Sleeve control for the Session camera panel: connect (USB or demo), zero, and live status, as one grey pill.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { sensorRateHz, sensorStatus } from '../arm/armInput';
import { IMU_NAMES, serialSupported } from '../lib/serial';
import { connectSleeve, disconnectSleeve, sleeveStats, useSleeve, zeroSleeve } from './sleeveSession';

// Opening the port restarts the ESP32: about 2.5 s to boot plus its 2 s start-up zero before frames flow again.
const BOOT_GRACE_MS = 6000;
// SOURCE: requested by Ehan: time after clicking Zero for the patient to get into the zero position (sitting still,
// sleeve on) before the 2 s gyro measurement starts.
export const ZERO_COUNTDOWN_S = 5;
const BTN = 'pressable h-8 cursor-pointer rounded-full px-3 transition-colors duration-150 [@media(hover:hover)]:hover:bg-white/20';

/** One-line status text for a connected sleeve. */
function liveText(s: ReturnType<typeof useSleeve.getState>): { text: string; bad: boolean } {
  if (sensorStatus() !== 'streaming') {
    if (performance.now() - s.connectedAt < BOOT_GRACE_MS) return { text: 'Starting sensors…', bad: false };
    const { lines, frames } = sleeveStats();
    if (lines === 0) {
      return s.via === 'bridge'
        ? { text: 'Bridge has no sensor data · check its terminal', bad: true }
        : { text: 'Board sends nothing · replug USB, reconnect', bad: true };
    }
    return { text: `No valid frames (${lines} lines, ${frames} frames) · check baud`, bad: true };
  }
  if (s.lostImus.length) return { text: `${s.lostImus.map((n) => IMU_NAMES[n]).join(', ')} lost · check wire`, bad: true };
  if (s.zero === 'moved') return { text: 'Moved while zeroing · sit still, retry', bad: true };
  if (s.zero !== 'ok') return { text: 'Zero sensors first', bad: false };
  if (!s.restReady) return { text: 'Capture rest pose', bad: false };
  if (!s.chestUpright) return { text: 'Chest sensor not facing forward', bad: true };
  return { text: `Sleeve live · ${Math.round(sensorRateHz())} Hz`, bad: false };
}

/** Grey pill with the sleeve's connection, zero and status; `pillClass` matches the other camera-panel pills. */
export default function SleevePill({ pillClass }: { pillClass: string }) {
  const s = useSleeve();
  const [, setTick] = useState(0);
  const [zeroAt, setZeroAt] = useState<number | null>(null);  // when the countdown sends `G`; null = no countdown
  useEffect(() => {
    // Stream health and rate live outside React state, so re-read them twice a second.
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    // Tick the countdown, then zero; dropped if the sleeve disconnects first.
    if (zeroAt === null) return;
    if (s.conn !== 'live') return setZeroAt(null);
    const id = window.setInterval(() => {
      if (performance.now() < zeroAt) return setTick((n) => n + 1);
      setZeroAt(null);
      void zeroSleeve();
    }, 100);
    return () => window.clearInterval(id);
  }, [zeroAt, s.conn]);

  if (s.conn === 'off' || s.conn === 'error') {
    return (
      <div role="group" aria-label="Sleeve" className={pillClass}>
        {serialSupported() && (
          <button type="button" className={BTN} onClick={() => void connectSleeve('usb')}>
            {s.conn === 'error' ? 'Sleeve error · retry' : 'Connect sleeve'}
          </button>
        )}
        <button type="button" className={clsx(BTN, 'text-white/75')} onClick={() => void connectSleeve('demo')}>
          Demo sleeve
        </button>
      </div>
    );
  }
  if (s.conn === 'connecting') return <div className={clsx(pillClass, 'px-3.5')}>Sleeve · connecting…</div>;
  if (s.conn === 'zeroing') return <div className={clsx(pillClass, 'px-3.5')}>Zeroing · hold still 2 s</div>;
  if (zeroAt !== null) {
    const left = Math.max(1, Math.ceil((zeroAt - performance.now()) / 1000));
    return (
      <div role="group" aria-label="Sleeve" className={pillClass}>
        <span className="tabular whitespace-nowrap px-2.5" aria-live="assertive">Get into position · zero in {left}</span>
        <button type="button" className={BTN} onClick={() => setZeroAt(null)}>Cancel</button>
      </div>
    );
  }

  const status = liveText(s);
  return (
    <div role="group" aria-label="Sleeve" className={clsx(pillClass, status.bad && '!bg-bad/85')}>
      <span className="whitespace-nowrap px-2.5" aria-live="polite">
        {s.source === 'demo' ? 'Demo · ' : ''}{status.text}
      </span>
      <button
        type="button"
        className={BTN}
        title={`Starts in ${ZERO_COUNTDOWN_S} s, then sit still for 2 seconds (the sleeve can stay on)`}
        onClick={() => setZeroAt(performance.now() + ZERO_COUNTDOWN_S * 1000)}
      >
        Zero
      </button>
      <button type="button" aria-label="Disconnect sleeve" className={BTN} onClick={() => void disconnectSleeve()}>
        ×
      </button>
    </div>
  );
}
