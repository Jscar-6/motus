// Therapist-tab feed: samples, flags and video from the patient tab, or a local demo when no patient is there.
import { useEffect, useState } from 'react';
import { listenForActions, registerLocalPipeline } from './actions';
import { openLiveChannel } from './channel';
import { startDemoLoop } from './demoLoop';
import { createPipeline } from './pipeline';
import { pushFlag, pushSample, resetLive, useLive } from './store';
import { clearVideoFrame, publishVideoFrame } from './videoBus';

const PRESENCE_MS = 1000;
const CHECK_MS = 500;
const PATIENT_TIMEOUT_MS = 2500;
// With no patient, the demo starts after about this long, not after the full timeout.
const FIRST_DEMO_DELAY_MS = 1000;

/** Feed the therapist portal; `mode` says whether the data is from a patient tab or the local demo. */
export function useDoctorFeed(): { mode: 'remote' | 'demo' } {
  const [mode, setMode] = useState<'remote' | 'demo'>('demo');

  useEffect(() => {
    let lastPatientSeen = performance.now() - PATIENT_TIMEOUT_MS + FIRST_DEMO_DELAY_MS;
    let stopDemo: (() => void) | null = null;
    let decoding = false;
    let closed = false;

    /** The patient tab is (still) here: leave the demo if it was running. */
    const patientSeen = () => {
      lastPatientSeen = performance.now();
      if (stopDemo) {
        stopDemo();
        stopDemo = null;
        registerLocalPipeline(null);
        resetLive();
        useLive.setState({ restCaptured: false });
      }
      if (useLive.getState().source !== 'remote' || !useLive.getState().patientOnline) {
        useLive.setState({ source: 'remote', patientOnline: true });
        setMode('remote');
      }
    };

    /** Run the fake pose source locally because no patient tab is broadcasting. */
    const startDemo = () => {
      const pipeline = createPipeline();
      clearVideoFrame();
      resetLive();
      useLive.setState({ source: 'demo', patientOnline: false, restCaptured: false });
      registerLocalPipeline(pipeline);
      stopDemo = startDemoLoop(() => 'right', pipeline);
      setMode('demo');
    };

    const channel = openLiveChannel((m) => {
      if (m.type === 'presence' && m.role === 'patient') {
        patientSeen();
      } else if (m.type === 'sample') {
        patientSeen();
        const restCaptured = m.sample.features !== null;
        if (useLive.getState().restCaptured !== restCaptured) useLive.setState({ restCaptured });
        // Re-stamp with this tab's clock: performance.now() differs between tabs.
        pushSample({ ...m.sample, t: performance.now() });
      } else if (m.type === 'flag') {
        pushFlag({ ...m.event, t: performance.now() });
      } else if (m.type === 'video' && !decoding) {
        decoding = true;
        createImageBitmap(m.frame)
          .then((bmp) => (closed ? bmp.close() : publishVideoFrame(bmp)))
          .catch(() => undefined) // an undecodable frame is simply dropped
          .then(() => {
            decoding = false;
          });
      }
    });

    /** Tell patient tabs a therapist tab is open so they answer at once. */
    const announce = () => channel.post({ type: 'presence', role: 'doctor', source: useLive.getState().source });

    /** Start the local demo when no patient tab has been heard from recently. */
    const check = () => {
      if (performance.now() - lastPatientSeen <= PATIENT_TIMEOUT_MS) return;
      if (!stopDemo) startDemo();
    };

    listenForActions();
    resetLive();
    useLive.setState({ source: 'none', patientOnline: false, restCaptured: false });
    announce();
    const presenceTimer = window.setInterval(announce, PRESENCE_MS);
    const checkTimer = window.setInterval(check, CHECK_MS);

    return () => {
      closed = true;
      window.clearInterval(presenceTimer);
      window.clearInterval(checkTimer);
      stopDemo?.();
      channel.close();
      registerLocalPipeline(null);
      clearVideoFrame();
      resetLive();
      useLive.setState({ source: 'none', patientOnline: false, restCaptured: false });
    };
  }, []);

  return { mode };
}
