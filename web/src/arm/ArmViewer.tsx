// The dotted 3D arm (F7): stippled "PLEASE PUT SLEEVE ON" that morphs into a bone-rigged arm. Fills its parent; drop it inside ArmSlot.
// Camera-first: it reads the pose from the live store and never opens a webcam. Driving the arm from live data is off until validated.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useLive } from '../live/store';
import { armConfig } from './armConfig';
import { pushSensorFrame, sensorRateHz, sensorStatus } from './armInput';
import type { SensorStatus } from './armInput';
import { ArmRig } from './ArmRig';
import { createArmPoints } from './particles';
import { PoseFusion } from './PoseFusion';
import { startSimSensor } from './simSensor';
import { sampleText } from './textSampler';

type Mode = 'arm' | 'text';

interface Controller {
  morphTo: (mode: Mode) => void;
  setDrive: (on: boolean) => void;
  calibrate: () => boolean;
}

interface TruereachArmApi {
  morphTo: (mode: Mode) => void;
  setDrive: (on: boolean) => void;
  calibrate: () => boolean;
  startSim: () => void;
  stopSim: () => void;
  pushSensorFrame: typeof pushSensorFrame;
  sensorRateHz: typeof sensorRateHz;
}

declare global {
  interface Window {
    truereachArm?: TruereachArmApi;
  }
}

const STATUS_LABEL: Record<SensorStatus, string> = {
  offline: 'Sleeve not connected',
  streaming: 'Sleeve streaming',
  stale: 'Sleeve signal stale',
};

const ARM_WIDTH = 7.6;
const ARM_HEIGHT = 2;
const FIT_MARGIN = 1.12;
const TEXT_ASPECT = 640 / 1400;
const HOME_RATE = 3;

const controllers = new Set<Controller>();
let stopSim: (() => void) | null = null;

/** Installs window.truereachArm; its calls fan out to every mounted viewer. */
function installApi(): void {
  window.truereachArm = {
    morphTo: (mode) => controllers.forEach((c) => c.morphTo(mode)),
    setDrive: (on) => controllers.forEach((c) => c.setDrive(on)),
    calibrate: () => [...controllers].map((c) => c.calibrate()).some(Boolean),
    startSim: () => {
      stopSim ??= startSimSensor();
    },
    stopSim: () => {
      stopSim?.();
      stopSim = null;
    },
    pushSensorFrame,
    sensorRateHz,
  };
}

/** Removes window.truereachArm and stops the shared simulator. */
function uninstallApi(): void {
  stopSim?.();
  stopSim = null;
  delete window.truereachArm;
}

/** Registers a viewer controller, installing the window API on the first one. */
function register(c: Controller): () => void {
  controllers.add(c);
  if (controllers.size === 1) installApi();
  return () => {
    controllers.delete(c);
    if (controllers.size === 0) uninstallApi();
  };
}

/** Camera distance at which both the text block and the arm fit the view with a small margin. */
function homeDistance(fovDeg: number, aspect: number): number {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
  const textW = armConfig.textWorldWidth;
  const needW = Math.max(textW, ARM_WIDTH);
  const needH = Math.max(textW * TEXT_ASPECT, ARM_HEIGHT);
  return (Math.max(needW / (2 * tanHalf * aspect), needH / (2 * tanHalf)) * FIT_MARGIN);
}

/** Fills its parent with the morphing dot arm, a mode toggle, and the sleeve status line; `replay` morphs straight to the arm and follows the pose in the live store (physician playback). */
export default function ArmViewer({ replay = false }: { replay?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const [showArm, setShowArm] = useState(false);
  const [status, setStatus] = useState<SensorStatus>(sensorStatus());

  useEffect(() => {
    const id = window.setInterval(() => setStatus(sensorStatus()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const morphSeconds = reduced ? armConfig.reducedMorphDuration : armConfig.morphDuration;
    const amplitude = reduced ? 0 : 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.insertBefore(canvas, container.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enabled = false;
    const home = new THREE.Vector3(0, 0, 16);
    const origin = new THREE.Vector3();
    camera.position.copy(home);

    const rig = new ArmRig();
    const fusion = new PoseFusion();
    const state = { target: 0, progress: 0, drive: false, calibrated: false };
    let armPoints: ReturnType<typeof createArmPoints> | null = null;
    let disposed = false;
    let raf = 0;
    let last: number | null = null;
    let elapsed = 0;
    let visible = true;

    const controller: Controller = {
      morphTo: (mode) => {
        state.target = mode === 'arm' ? 1 : 0;
        canvas.style.touchAction = state.target ? 'none' : 'pan-y';
        setShowArm(state.target === 1);
      },
      setDrive: (on) => {
        state.drive = on;
      },
      calibrate: () => fusion.calibrate(),
    };
    controllerRef.current = controller;
    canvas.style.touchAction = 'pan-y';
    const unregister = register(controller);

    /** Sizes the renderer, camera, point scale and home distance to the container. */
    const resize = (): void => {
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      home.z = homeDistance(camera.fov, camera.aspect);
      camera.position.setLength(home.z);
      controls.minDistance = home.z * 0.5;
      controls.maxDistance = home.z * 1.6;
      if (armPoints) armPoints.uniforms.uScale.value = (renderer.getPixelRatio() * h) / 300;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    /** Advances one animation frame: morph progress, pose, camera glide, render. */
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      if (!armPoints) return;

      const dir = Math.sign(state.target - state.progress);
      state.progress = THREE.MathUtils.clamp(state.progress + (dir * dt) / morphSeconds, 0, 1);
      armPoints.uniforms.uProgress.value = state.progress;
      armPoints.uniforms.uTime.value = elapsed;

      const latest = useLive.getState().latest;
      if (replay) {
        if (!latest) state.calibrated = false;
        else if (!state.calibrated) state.calibrated = fusion.calibrate();
      }
      const pose = fusion.update(dt, latest?.pose ?? null, latest?.aspect ?? 1);
      if (state.drive && pose) rig.applyPose(pose);
      else rig.idle(elapsed, amplitude);
      rig.syncTo(armPoints.uniforms.uBones.value);

      if (state.target === 0) {
        controls.enabled = false;
        const k = 1 - Math.exp(-dt * HOME_RATE);
        camera.position.lerp(home, k);
        controls.target.lerp(origin, k);
      } else {
        controls.enabled = true;
      }
      controls.update();
      renderer.render(scene, camera);
    };

    /** Runs the loop only while the viewer is on screen and the tab is visible. */
    const syncLoop = (): void => {
      const run = visible && !document.hidden;
      if (run && !raf) {
        last = null;
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      syncLoop();
    });
    intersection.observe(container);
    document.addEventListener('visibilitychange', syncLoop);

    (async () => {
      const textPts = await sampleText(armConfig.textLines, armConfig.particleCount, armConfig.textWorldWidth);
      if (disposed) return;
      const built = createArmPoints(rig, textPts, rig.sampleSurface(armConfig.particleCount));
      built.uniforms.uSwirl.value = reduced ? 0 : 1;
      scene.add(built.points);
      armPoints = built;
      if (replay) {
        controller.morphTo('arm');
        state.drive = true;
      }
      resize();
      syncLoop();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', syncLoop);
      controls.dispose();
      armPoints?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      unregister();
      controllerRef.current = null;
    };
  }, [replay]);

  return (
    <div ref={containerRef} aria-label={`Arm model. ${STATUS_LABEL[status]}`} className="absolute inset-0">
      <button
        type="button"
        aria-label={showArm ? 'Show sleeve message' : 'Show arm model'}
        aria-pressed={showArm}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => controllerRef.current?.morphTo(showArm ? 'text' : 'arm')}
        className="pressable absolute right-2 top-2 z-10 grid h-[30px] w-[30px] place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-card)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {showArm ? (
            <path d="M5 6h14M12 6v13" />
          ) : (
            <>
              <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
              <path d="M4 7.5 12 12l8-4.5M12 12v9" />
            </>
          )}
        </svg>
      </button>
      <span className="eyebrow pointer-events-none absolute bottom-3 left-3 z-10">{STATUS_LABEL[status]}</span>
    </div>
  );
}
