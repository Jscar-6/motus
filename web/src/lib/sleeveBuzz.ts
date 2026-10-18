// Buzz on rule flags (S3): turns the rule engine's current flags into `V,<motor>,<pattern>` commands.
// Lean and trunk rotation buzz the chest motor; shoulder hike buzzes the upper-arm motor. The buzz
// sensitivity (F10, set by the therapist) picks the pattern; it never changes detection thresholds.
import { MOTOR, PATTERN } from './serial';
import type { CompLabel } from './types';

/** Same values as live/types BuzzSensitivity (F10). */
export type Sensitivity = 'low' | 'medium' | 'high';

const MOTOR_FOR: Partial<Record<CompLabel, number>> = {
  trunk_lean: MOTOR.chest,
  trunk_rotation: MOTOR.chest,
  shoulder_hike: MOTOR.upperArm,
};

const PATTERN_FOR: Record<Sensitivity, number> = {
  low: PATTERN.pulse,
  medium: PATTERN.doublePulse,
  high: PATTERN.on,  // stays on until the flag clears
};

// SOURCE: hand-set, not data. A motor starts a new buzz at most this often: low/medium re-pulse at this rate while a
// flag stays on, and a flag that flickers off and back on can't restart the buzz sooner.
export const BUZZ_REPEAT_MS = 2000;

export interface BuzzController {
  /** Call every frame with the currently flagged labels; sends commands only when something changes. */
  update(flags: readonly CompLabel[], sensitivity: Sensitivity, now: number): void;
  /** Turn every motor off. */
  stop(): void;
}

/** Create a controller that sends motor commands through `send` (e.g. SleeveLink.buzz). */
export function createBuzzController(send: (motor: number, pattern: number) => void): BuzzController {
  const motors = [MOTOR.chest, MOTOR.upperArm];
  const lastStart = new Map<number, number>();      // motor → when its last buzz started; kept after the flag clears
  const continuous = new Set<number>();             // motors left on with PATTERN.on

  return {
    update(flags, sensitivity, now) {
      const pattern = PATTERN_FOR[sensitivity];
      for (const motor of motors) {
        const flagged = flags.some((l) => MOTOR_FOR[l] === motor);
        if (!flagged) {
          if (continuous.delete(motor)) send(motor, PATTERN.off);
          continue;
        }
        if (pattern === PATTERN.on && continuous.has(motor)) continue;
        if (pattern !== PATTERN.on && continuous.delete(motor)) send(motor, PATTERN.off);  // sensitivity lowered while on
        const last = lastStart.get(motor);
        if (last !== undefined && now - last < BUZZ_REPEAT_MS) continue;
        send(motor, pattern);
        lastStart.set(motor, now);
        if (pattern === PATTERN.on) continuous.add(motor);
      }
    },
    stop() {
      for (const motor of motors) send(motor, PATTERN.off);
      continuous.clear();
      lastStart.clear();
    },
  };
}
