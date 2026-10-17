// Dot geometry and shaders: every dot has a text position and a bone-skinned arm position, and the morph runs in the vertex shader.
import * as THREE from 'three';
import { armConfig } from './armConfig';
import type { ArmRig, SurfacePoint } from './ArmRig';
import type { Vec3 } from './textSampler';

export interface ArmPoints {
  points: THREE.Points;
  uniforms: {
    uBones: { value: THREE.Matrix4[] };
    uProgress: { value: number };
    uTime: { value: number };
    uScale: { value: number };
    uSwirl: { value: number };
  };
  dispose: () => void;
}

/** Builds the Points object that morphs between the text dots and the skinned arm dots. */
export function createArmPoints(rig: ArmRig, textPts: Vec3[], armPts: SurfacePoint[]): ArmPoints {
  const N = textPts.length;
  // Pair dots left to right so each one travels a short, readable path.
  const tOrder = textPts.map((_, i) => i).sort((a, b) => textPts[a][0] - textPts[b][0]);
  const aOrder = armPts.map((_, i) => i).sort((a, b) => armPts[a].wx - armPts[b].wx);

  const aText = new Float32Array(N * 3);
  const aArm = new Float32Array(N * 3);
  const aNrm = new Float32Array(N * 3);
  const aBone = new Float32Array(N);
  const aSeed = new Float32Array(N);
  const aDelay = new Float32Array(N);
  const aFade = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = textPts[tOrder[i]];
    const a = armPts[aOrder[i]];
    aText.set(t, i * 3);
    aArm.set(a.pos, i * 3);
    aNrm.set(a.nrm, i * 3);
    aBone[i] = a.bone;
    aFade[i] = a.fade;
    aSeed[i] = Math.random();
    aDelay[i] = (i / N) * 0.82 + Math.random() * 0.18;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aText.slice(), 3));
  geo.setAttribute('aText', new THREE.BufferAttribute(aText, 3));
  geo.setAttribute('aArm', new THREE.BufferAttribute(aArm, 3));
  geo.setAttribute('aNrm', new THREE.BufferAttribute(aNrm, 3));
  geo.setAttribute('aBone', new THREE.BufferAttribute(aBone, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(aDelay, 1));
  geo.setAttribute('aFade', new THREE.BufferAttribute(aFade, 1));

  const C = armConfig.colors;
  const uniforms = {
    uBones: { value: rig.bones.map(() => new THREE.Matrix4()) },
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uScale: { value: 1 },
    uSwirl: { value: 1 },
    uSize: { value: armConfig.dotSize },
    uInk: { value: new THREE.Color(C.ink) },
    uDark: { value: new THREE.Color(C.dark) },
    uLight: { value: new THREE.Color(C.light) },
    uRimCol: { value: new THREE.Color(C.rim) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: true,
    depthWrite: true,
    transparent: false,
    vertexShader: /* glsl */ `
      #define BONE_COUNT ${rig.bones.length}
      uniform mat4 uBones[BONE_COUNT];
      uniform float uProgress, uTime, uSize, uScale, uSwirl;
      attribute vec3 aText; attribute vec3 aArm; attribute vec3 aNrm;
      attribute float aBone; attribute float aSeed; attribute float aDelay; attribute float aFade;
      varying float vMix; varying float vLight; varying float vRim; varying float vFade; varying float vSeed;

      float ease(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) * 0.5; }

      void main(){
        mat4 B = uBones[int(aBone + 0.5)];
        vec3 armPos = (B * vec4(aArm, 1.0)).xyz;
        vec3 n = normalize(mat3(B) * aNrm);

        float local = clamp(uProgress * 1.7 - aDelay * 0.7, 0.0, 1.0);
        float t = ease(local);
        vec3 p = mix(aText, armPos, t);

        float transit = sin(3.14159265 * t);
        float s = aSeed * 6.2831853;
        vec3 drift = vec3(sin(s*3.0 + uTime*1.4), cos(s*5.0 + uTime*1.1), sin(s*7.0 + uTime*0.8));
        p += drift * transit * (0.45 + 0.9 * fract(aSeed * 17.0)) * uSwirl;
        p.xy += (1.0 - t) * 0.01 * vec2(sin(uTime*1.8 + s*20.0), cos(uTime*1.5 + s*13.0)) * uSwirl;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        vec3 vn = normalize(normalMatrix * n);
        float facing = dot(vn, normalize(-mv.xyz));
        vLight = max(dot(vn, normalize(vec3(-0.35, 0.75, 0.6))), 0.0);
        vRim = pow(1.0 - clamp(facing, 0.0, 1.0), 2.5);
        vMix = t;
        vFade = mix(1.0, aFade, t);
        vSeed = aSeed;

        float sz = uSize * (0.75 + 0.5 * fract(aSeed * 53.0));
        sz *= mix(1.0, 0.55 + 0.45 * smoothstep(-0.2, 0.4, facing), t);
        sz *= mix(1.0, 0.4 + 0.6 * aFade, t);
        sz *= 1.0 + transit * 0.6;
        gl_PointSize = max(sz * uScale * (14.0 / -mv.z), 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk, uDark, uLight, uRimCol;
      varying float vMix; varying float vLight; varying float vRim; varying float vFade; varying float vSeed;

      float hash(float x){ return fract(sin(x * 91.3458) * 47453.5453); }

      void main(){
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        if (hash(vSeed) > vFade) discard;
        vec3 arm = mix(uDark, uLight, vLight) + uRimCol * vRim * 0.9;
        gl_FragColor = vec4(mix(uInk, arm, vMix), 1.0);
      }`,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return {
    points,
    uniforms,
    dispose: () => {
      geo.dispose();
      material.dispose();
    },
  };
}
