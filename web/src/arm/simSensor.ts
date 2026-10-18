// Demo sleeve for the arm without hardware: the A3 fake sleeve (lib/fakeSensor.ts), through the same link as the
// real one, so window.truereachArm.startSim() exercises the full sleeve path.
import { connectSleeve, disconnectSleeve, useSleeve } from '../sleeve/sleeveSession';

/** Connects the demo sleeve unless a sleeve is already connected; returns the stop function. */
export function startSimSensor(): () => void {
  void connectSleeve('demo');
  return () => {
    if (useSleeve.getState().source === 'demo') void disconnectSleeve();
  };
}
