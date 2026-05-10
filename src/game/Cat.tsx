'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CatAppearance } from './types';
import { SIZE_STATS } from './types';
import { normalizeCat } from '@/lib/normalizeCat';
import { buildFurTexture, hashId } from './furTexture';

interface CatProps {
  cat: CatAppearance;
  position?: [number, number, number];
  rotation?: number;
  anim?: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'crouch' | 'pounce' | 'limp' | 'jump';
  injured?: boolean;
  carrying?: string | null;
}

// Flat ":3" cat-mouth curve, lying in the YZ plane (the cat faces +X).
// Five control points trace a real "3" lying on its side:
//   left corner — left dip — middle PEAK (the back of the 3) — right dip — right corner.
const CAT_MOUTH_CURVE = (() => {
  const halfW   = 0.046;   // mouth half-width — bigger so it reads as a 3
  const dip     = 0.020;   // how far each lobe sags
  const midPeak = 0.024;   // the middle peak — must be clearly higher than the corners
  const pts = [
    new THREE.Vector3(0,        0,        -halfW),           // left corner
    new THREE.Vector3(0,    -dip * 0.4,   -halfW * 0.78),    // pull-in toward dip
    new THREE.Vector3(0,    -dip,         -halfW * 0.45),    // left lobe bottom
    new THREE.Vector3(0,    -dip * 0.5,   -halfW * 0.18),    // climb toward peak
    new THREE.Vector3(0,     midPeak,      0),               // middle PEAK — back of the 3
    new THREE.Vector3(0,    -dip * 0.5,    halfW * 0.18),
    new THREE.Vector3(0,    -dip,          halfW * 0.45),    // right lobe bottom
    new THREE.Vector3(0,    -dip * 0.4,    halfW * 0.78),
    new THREE.Vector3(0,        0,         halfW),           // right corner
  ];
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
})();
const CAT_MOUTH_GEO = new THREE.TubeGeometry(CAT_MOUTH_CURVE, 64, 0.0038, 6, false);

interface LegProps {
  position: [number, number, number];
  material: THREE.Material;
  // 0 = front leg, 1 = back leg (back legs bend more)
  back?: boolean;
}

const Leg = forwardRef<THREE.Group, LegProps>(function Leg({ position, material, back = false }, ref) {
  // Stubby two-segment kitten leg → upper, joint, lower, soft paw
  return (
    <group ref={ref} position={position}>
      {/* Upper segment */}
      <mesh position={[0, -0.08, 0]} material={material}>
        <cylinderGeometry args={[0.062, 0.052, 0.16, 12]} />
      </mesh>
      {/* Knee/elbow joint (rounded, chunky) */}
      <mesh position={[0, -0.16, back ? 0.04 : 0]} material={material}>
        <sphereGeometry args={[0.06, 12, 10]} />
      </mesh>
      {/* Lower segment */}
      <mesh position={[0, -0.24, back ? 0.06 : 0]} rotation={[back ? -0.18 : 0, 0, 0]} material={material}>
        <cylinderGeometry args={[0.05, 0.046, 0.16, 12]} />
      </mesh>
      {/* Paw — soft, low pillow */}
      <mesh position={[0, -0.33, back ? 0.085 : 0.025]} scale={[1.1, 0.45, 1.25]} material={material}>
        <sphereGeometry args={[0.062, 14, 10]} />
      </mesh>
      {/* Pink toe beans (4) underneath the paw — visible at low angles */}
      <group position={[0, -0.345, back ? 0.085 : 0.025]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshStandardMaterial color={'#f3a3b4'} roughness={0.5} />
        </mesh>
        <mesh position={[0.025, 0, 0.022]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color={'#f3a3b4'} roughness={0.5} />
        </mesh>
        <mesh position={[0.025, 0, -0.022]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color={'#f3a3b4'} roughness={0.5} />
        </mesh>
        <mesh position={[-0.025, 0, 0.022]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color={'#f3a3b4'} roughness={0.5} />
        </mesh>
        <mesh position={[-0.025, 0, -0.022]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial color={'#f3a3b4'} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
});

export function Cat({ cat: rawCat, position = [0, 0, 0], rotation = 0, anim = 'idle', injured = false, carrying = null }: CatProps) {
  const cat = useMemo(() => normalizeCat(rawCat), [rawCat]);
  const groupRef = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Mesh>(null);
  const earR = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Group>(null);
  const eyeRRef = useRef<THREE.Group>(null);
  const fLegL = useRef<THREE.Group>(null);
  const fLegR = useRef<THREE.Group>(null);
  const bLegL = useRef<THREE.Group>(null);
  const bLegR = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const t = useRef(0);

  // Blink state machine — long, eased, occasionally a "slow loving blink"
  const blinkRef = useRef({
    nextAt: 1.5 + Math.random() * 2.5,    // first blink shortly after spawn
    duration: 0.42,
    startedAt: -1 as number,
    slow: false,
  });

  const stats = SIZE_STATS[cat.size];
  const scale = stats.scale * cat.height;
  const buildScale = cat.build;

  // (Pattern is now baked into the canvas-generated furTexture below; no per-frame color math needed.)

  useFrame((_, dt) => {
    try {
    t.current += dt;
    const time = t.current;

    let stride = 0;
    let speed = 0;
    let bodyBob = 0;
    let crouchY = 0;
    let pounceY = 0;
    let jumpY = 0;

    if (anim === 'walk') { stride = 1.0; speed = 6; }
    else if (anim === 'run') { stride = 1.6; speed = 12; }
    else if (anim === 'crouch') { crouchY = -0.18; }
    else if (anim === 'pounce') {
      pounceY = Math.max(0, Math.sin(time * 6) * 0.5);
      stride = 0.6; speed = 10;
    } else if (anim === 'sit') { crouchY = -0.05; }
    else if (anim === 'sleep') { crouchY = -0.32; }
    else if (anim === 'limp' || injured) { stride = 0.6; speed = 4.5; }
    else if (anim === 'jump') { jumpY = 0.4; stride = 0.4; }

    const limpFactor = anim === 'limp' || injured ? 0.4 : 1;
    if (fLegL.current && fLegR.current && bLegL.current && bLegR.current) {
      const a = Math.sin(time * speed) * 0.55 * stride * limpFactor;
      const b = Math.sin(time * speed + Math.PI) * 0.55 * stride * limpFactor;
      fLegL.current.rotation.x = a;
      bLegL.current.rotation.x = b * 0.9;
      fLegR.current.rotation.x = b;
      bLegR.current.rotation.x = a * 0.9;
      bodyBob = Math.abs(Math.sin(time * speed)) * 0.04 * stride;
    }

    // ear twitch
    const ear = Math.sin(time * 1.4) > 0.95 ? 0.25 : 0;
    if (earL.current) earL.current.rotation.z = 0.15 + ear;
    if (earR.current) earR.current.rotation.z = -0.15 - ear * 0.8;

    // head subtle look
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(time * 0.6) * 0.1;
      headRef.current.rotation.x = (anim === 'crouch' || anim === 'pounce' ? -0.15 : Math.sin(time * 0.5) * 0.04);
    }

    // Blink animation — generous, eased, occasionally a slow loving blink
    let lid = 1;
    if (anim === 'sleep') {
      lid = 0.04;
    } else {
      const bs = blinkRef.current;
      if (bs.startedAt < 0 && time >= bs.nextAt) {
        bs.startedAt = time;
        bs.slow = Math.random() < 0.18;
        bs.duration = bs.slow ? 0.95 : 0.42;
      }
      if (bs.startedAt >= 0) {
        const p = (time - bs.startedAt) / bs.duration;
        if (p >= 1) {
          bs.startedAt = -1;
          bs.nextAt = time + 2.6 + Math.random() * 3.5; // 2.6 – 6.1s between blinks
        } else {
          const closedMin = 0.05;
          // Phase: 0–40% closing, 40–55% held, 55–100% opening
          const easeInOut = (k: number) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          const closeP = bs.slow ? 0.45 : 0.4;
          const holdEnd = bs.slow ? 0.65 : 0.55;
          if (p < closeP) {
            lid = 1 - (1 - closedMin) * easeInOut(p / closeP);
          } else if (p < holdEnd) {
            lid = closedMin;
          } else {
            lid = closedMin + (1 - closedMin) * easeInOut((p - holdEnd) / (1 - holdEnd));
          }
        }
      }
    }
    if (eyeLRef.current) eyeLRef.current.scale.y = lid;
    if (eyeRRef.current) eyeRRef.current.scale.y = lid;

    if (bodyRef.current) {
      // Soft breathing motion when standing/sitting still
      const isMoving = anim === 'walk' || anim === 'run' || anim === 'pounce' || anim === 'jump' || anim === 'limp';
      const breath = isMoving ? 0 : Math.sin(time * 1.6) * 0.012;
      bodyRef.current.position.y = 0.5 + crouchY + bodyBob + breath;
      // Subtle chest expansion on inhale
      bodyRef.current.scale.y = 1 + (isMoving ? 0 : Math.sin(time * 1.6) * 0.025);
    }
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1] + pounceY + jumpY, position[2]);
      groupRef.current.rotation.y = rotation;
    }
    } catch (e) {
      // never let an animation hiccup crash the whole render tree
      if (typeof console !== 'undefined') console.warn('[wotc] cat frame error', e);
    }
  });

  // Procedural fur texture for non-solid coats. Up to three pattern colors give
  // tortoiseshells / calicos / spotted coats real multi-color depth.
  const furTexture = useMemo(
    () => buildFurTexture({
      pattern: cat.furPattern,
      base: cat.furBase,
      patternColor: cat.patternColor,
      patternColor2: cat.patternColor2,
      patternColor3: cat.patternColor3,
      belly: cat.furBelly,
      seed: hashId(cat.id || cat.name),
    }),
    [cat.furPattern, cat.furBase, cat.patternColor, cat.patternColor2, cat.patternColor3, cat.furBelly, cat.id, cat.name]
  );
  useEffect(() => () => { furTexture?.dispose(); }, [furTexture]);

  // Smooth, slightly glossy fur — much less rough than before
  const bodyMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: furTexture ? 0xffffff : cat.furBase, // let the texture show through when present
      map: furTexture ?? null,
      roughness: 0.55,
      metalness: 0.02,
      envMapIntensity: 0.7,
    });
  }, [furTexture, cat.furBase]);

  const bellyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: cat.furBelly,
      roughness: 0.5,
      metalness: 0.02,
    }),
    [cat.furBelly]
  );

  const earInnerMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#f4b8c4',
      roughness: 0.45,
      metalness: 0,
    }),
    []
  );

  const eyeColor = useMemo(() => {
    const map: Record<string, number> = {
      amber: 0xe2a23a, green: 0x6abf6a, blue: 0x6cc4e0, yellow: 0xf3d23a,
      copper: 0xc36a32, hazel: 0xa78540, odd: 0x6cc4e0,
      emerald: 0x2fb37b, sky: 0x9bd3f5, violet: 0xa48cd6,
      rose: 0xe389b3, silver: 0xd6e0e8, gold: 0xfad34b,
      jade: 0x88d4b3, sunset: 0xf08560,
    };
    return map[cat.eyeColor] ?? 0xe2a23a;
  }, [cat.eyeColor]);

  // Ear geometry — slightly bigger, kitten-rounded
  const earGeo = (() => {
    switch (cat.earShape) {
      case 'tufted':  return <coneGeometry args={[0.10, 0.30, 10]} />;
      case 'rounded': return <sphereGeometry args={[0.12, 14, 14, 0, Math.PI]} />;
      case 'curl':    return <coneGeometry args={[0.085, 0.20, 10]} />;
      default:        return <coneGeometry args={[0.10, 0.24, 10]} />;
    }
  })();

  const safe = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);
  const tailFluff = cat.tail === 'fluffy' ? 1.6 : 1;
  const fluff = safe(1 + cat.fluffiness * 0.35, 1);

  // Cute kitten proportions: shorter, chubbier body
  const bodyLen = Math.max(0.35, safe(0.62 * buildScale, 0.62));
  const bodyR   = Math.max(0.10, safe(0.22 * fluff * buildScale, 0.22));

  return (
    <group ref={groupRef} scale={scale}>
      {/* shadow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[bodyLen * 0.7, bodyR * 1.6, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color={'#000'} transparent opacity={0.28} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.5, 0]}>
        {/* main body — short, chubby cylinder + sphere caps. Slight downward tilt toward the rear for a real cat slope. */}
        <mesh castShadow rotation={[0, 0, Math.PI / 2 + 0.06]} material={bodyMaterial}>
          <cylinderGeometry args={[bodyR, bodyR, bodyLen, 24]} />
        </mesh>
        <mesh position={[bodyLen * 0.5, 0.02, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR, 22, 18]} />
        </mesh>
        <mesh position={[-bodyLen * 0.5, -0.05, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR, 22, 18]} />
        </mesh>
        {/* shoulders */}
        <mesh position={[bodyLen * 0.4, 0.04, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR * 1.06, 18, 14]} />
        </mesh>
        {/* lower-back haunches — sit lower than shoulders for a real cat profile */}
        <mesh position={[-bodyLen * 0.42, -0.06, 0]} scale={[0.78, 0.95, 1.08]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR * 1.2, 22, 16]} />
        </mesh>
        {/* fluffy belly */}
        <mesh position={[0, -bodyR * 0.45, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.95, 0.78]} material={bellyMaterial}>
          <cylinderGeometry args={[bodyR * 0.78, bodyR * 0.78, bodyLen * 0.85, 14]} />
        </mesh>
        {/* soft chest fluff just below where the neck meets the body */}
        <mesh position={[bodyLen * 0.42, -0.05, 0]} scale={[0.85, 0.95, 1.0]} material={bellyMaterial}>
          <sphereGeometry args={[bodyR * 0.78, 16, 14]} />
        </mesh>

        {/* short, chubby neck */}
        <mesh position={[bodyLen * 0.55, 0.16, 0]} rotation={[0, 0, -0.55]} material={bodyMaterial}>
          <cylinderGeometry args={[bodyR * 0.78, bodyR * 0.92, 0.16, 14]} />
        </mesh>

        {/* head — bigger relative to body for kitten/chibi feel */}
        <group ref={headRef} position={[bodyLen * 0.7, 0.32, 0]}>
          {/* skull (rounder) */}
          <mesh castShadow scale={[1.0, 0.96, 1.04]} material={bodyMaterial}>
            <sphereGeometry args={[0.22, 18, 16]} />
          </mesh>
          {/* round cheeks */}
          <mesh position={[0.06, -0.07, 0.105]} material={bodyMaterial}>
            <sphereGeometry args={[0.085, 12, 12]} />
          </mesh>
          <mesh position={[0.06, -0.07, -0.105]} material={bodyMaterial}>
            <sphereGeometry args={[0.085, 12, 12]} />
          </mesh>
          {/* small muzzle (chibi) */}
          <mesh position={[0.18, -0.05, 0]} scale={[1, 0.78, 0.95]} material={bellyMaterial}>
            <sphereGeometry args={[0.078, 12, 10]} />
          </mesh>
          {/* chin */}
          <mesh position={[0.20, -0.10, 0]} scale={[0.85, 0.6, 0.7]} material={bellyMaterial}>
            <sphereGeometry args={[0.062, 10, 8]} />
          </mesh>
          {/* nose — small and round */}
          <mesh position={[0.255, -0.025, 0]}>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshStandardMaterial color={'#3a1f24'} roughness={0.6} />
          </mesh>

          {/* mouth — flat "3" sitting on the muzzle just below the nose */}
          <mesh position={[0.272, -0.082, 0]} geometry={CAT_MOUTH_GEO} renderOrder={2}>
            <meshBasicMaterial color={'#000000'} depthTest={true} />
          </mesh>

          {/* tiny pink tongue tip peeking out under the mouth */}
          <mesh position={[0.276, -0.092, 0]} scale={[0.4, 0.4, 0.6]}>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshStandardMaterial color={'#f08aa3'} roughness={0.55} />
          </mesh>

          {/* optional soft pink blush spots on the cheeks */}
          {cat.blush && (
            <>
              <mesh position={[0.20, -0.03, 0.16]} rotation={[0, 0.3, 0]}>
                <circleGeometry args={[0.038, 18]} />
                <meshBasicMaterial color={'#f7a8b4'} transparent opacity={0.55} />
              </mesh>
              <mesh position={[0.20, -0.03, -0.16]} rotation={[0, -0.3, 0]}>
                <circleGeometry args={[0.038, 18]} />
                <meshBasicMaterial color={'#f7a8b4'} transparent opacity={0.55} />
              </mesh>
            </>
          )}

          {/* big round eyes (groups so we can scale Y to blink) */}
          {(() => {
            // Pupil size: 0..1 → 0.012..0.040 radius. The "blind" cat gets a
            // pale blue cataract overlay instead of a coloured iris.
            const pupilR = 0.012 + (cat.pupilSize ?? 0.5) * 0.028;
            const isBlind = cat.vision === 'blind';
            const irisColor = isBlind ? 0xc6d8ec : eyeColor;
            const irisColorR = isBlind ? 0xc6d8ec : (cat.eyeColor === 'odd' ? 0xe2a23a : eyeColor);
            return (
              <>
                <group ref={eyeLRef} position={[0.18, 0.06, 0.10]}>
                  <mesh rotation={[0, 0.35, 0]}>
                    <sphereGeometry args={[0.052, 16, 14]} />
                    <meshStandardMaterial color={irisColor} emissive={irisColor} emissiveIntensity={isBlind ? 0.02 : 0.10} roughness={0.3} />
                  </mesh>
                  <mesh position={[0.022, 0, 0.012]}>
                    <sphereGeometry args={[pupilR, 12, 12]} />
                    <meshBasicMaterial color={'#0a0a0a'} />
                  </mesh>
                  <mesh position={[0.034, 0.014, 0.020]}>
                    <sphereGeometry args={[0.012, 8, 8]} />
                    <meshBasicMaterial color={'#ffffff'} />
                  </mesh>
                  <mesh position={[0.030, -0.012, 0.018]}>
                    <sphereGeometry args={[0.005, 6, 6]} />
                    <meshBasicMaterial color={'#ffffff'} />
                  </mesh>
                </group>

                <group ref={eyeRRef} position={[0.18, 0.06, -0.10]}>
                  <mesh rotation={[0, -0.35, 0]}>
                    <sphereGeometry args={[0.052, 16, 14]} />
                    <meshStandardMaterial
                      color={irisColorR}
                      emissive={irisColorR}
                      emissiveIntensity={isBlind ? 0.02 : 0.10}
                      roughness={0.3}
                    />
                  </mesh>
                  <mesh position={[0.022, 0, -0.012]}>
                    <sphereGeometry args={[pupilR, 12, 12]} />
                    <meshBasicMaterial color={'#0a0a0a'} />
                  </mesh>
                  <mesh position={[0.034, 0.014, -0.020]}>
                    <sphereGeometry args={[0.012, 8, 8]} />
                    <meshBasicMaterial color={'#ffffff'} />
                  </mesh>
                  <mesh position={[0.030, -0.012, -0.018]}>
                    <sphereGeometry args={[0.005, 6, 6]} />
                    <meshBasicMaterial color={'#ffffff'} />
                  </mesh>
                </group>
              </>
            );
          })()}

          {/* ears (outer) — set higher on the bigger head */}
          <mesh ref={earL} position={[-0.03, 0.22, 0.135]} rotation={[0, 0, 0.18]} material={bodyMaterial}>
            {earGeo}
          </mesh>
          <mesh ref={earR} position={[-0.03, 0.22, -0.135]} rotation={[0, 0, -0.18]} material={bodyMaterial}>
            {earGeo}
          </mesh>
          {/* ear inner pink */}
          <mesh position={[-0.025, 0.21, 0.138]} rotation={[0, 0, 0.18]} scale={0.72} material={earInnerMat}>
            <coneGeometry args={[0.085, 0.20, 10]} />
          </mesh>
          <mesh position={[-0.025, 0.21, -0.138]} rotation={[0, 0, -0.18]} scale={0.72} material={earInnerMat}>
            <coneGeometry args={[0.085, 0.20, 10]} />
          </mesh>

          {/* whiskers — point sideways out from each cheek */}
          <group position={[0.16, -0.05, 0]}>
            {/* Left side: extend in +Z */}
            {[-1, 0, 1].map((i) => (
              <mesh
                key={`wL${i}`}
                position={[i * 0.006, i * 0.012, 0.255]}
                rotation={[i * 0.18, Math.PI / 2 + i * 0.06, 0]}
              >
                <boxGeometry args={[0.13, 0.002, 0.002]} />
                <meshBasicMaterial color={'#f5efe2'} />
              </mesh>
            ))}
            {/* Right side: extend in -Z */}
            {[-1, 0, 1].map((i) => (
              <mesh
                key={`wR${i}`}
                position={[i * 0.006, i * 0.012, -0.255]}
                rotation={[-i * 0.18, -Math.PI / 2 - i * 0.06, 0]}
              >
                <boxGeometry args={[0.13, 0.002, 0.002]} />
                <meshBasicMaterial color={'#f5efe2'} />
              </mesh>
            ))}
          </group>

          {/* carrying prey in mouth */}
          {carrying && (
            <mesh position={[0.32, -0.10, 0]} rotation={[0, 0, 0.2]}>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshStandardMaterial color={'#7a4a2a'} roughness={0.9} />
            </mesh>
          )}

          {/* scars (rare, kept subtle) */}
          {cat.scars.includes('left-ear-nick') && (
            <mesh position={[-0.03, 0.34, 0.135]} rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.04, 0.06, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
          {cat.scars.includes('left-eye') && (
            <mesh position={[0.18, 0.06, 0.10]} rotation={[0, 0, 0.6]}>
              <boxGeometry args={[0.1, 0.012, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
          {cat.scars.includes('muzzle') && (
            <mesh position={[0.20, -0.02, 0.04]} rotation={[0, 0.4, 0.5]}>
              <boxGeometry args={[0.08, 0.01, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
        </group>

        {/* legs — chubby kitten stance, back legs sit lower with the dropped haunch */}
        <Leg ref={fLegL} position={[bodyLen * 0.38, -bodyR * 0.55, 0.13]} material={bodyMaterial} />
        <Leg ref={fLegR} position={[bodyLen * 0.38, -bodyR * 0.55, -0.13]} material={bodyMaterial} />
        <Leg ref={bLegL} position={[-bodyLen * 0.38, -bodyR * 0.65, 0.13]} material={bodyMaterial} back />
        <Leg ref={bLegR} position={[-bodyLen * 0.38, -bodyR * 0.65, -0.13]} material={bodyMaterial} back />

        {/* tail — slightly shorter to match the chibi body */}
        <SmoothTail
          length={cat.tail === 'short' ? 0.55 : cat.tail === 'long' ? 1.05 : cat.tail === 'fluffy' ? 0.85 : 0.7}
          baseRadius={(bodyR * 0.5) * tailFluff * (1 + cat.fluffiness * 0.25)}
          tailType={cat.tail}
          anim={anim}
          material={bodyMaterial}
          attach={[-bodyLen * 0.5, 0.06, 0]}
        />
      </group>
    </group>
  );
}

/* ----- Smooth tail (single tube + animated curve) ----- */

interface SmoothTailProps {
  length: number;
  baseRadius: number;
  tailType: CatAppearance['tail'];
  anim: NonNullable<CatProps['anim']>;
  material: THREE.Material;
  attach: [number, number, number];
}

const TAIL_NODES = 14;     // curve control points
const TAIL_RADIAL = 10;    // tube cross-section vertices

function SmoothTail({ length, baseRadius, tailType, anim, material, attach }: SmoothTailProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tipRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  // Reusable structures (avoid per-frame allocation)
  const points = useMemo(
    () => Array.from({ length: TAIL_NODES }, () => new THREE.Vector3()),
    []
  );
  const positions = useMemo(
    () => new Float32Array((TAIL_NODES) * TAIL_RADIAL * 3),
    []
  );
  const normals = useMemo(
    () => new Float32Array((TAIL_NODES) * TAIL_RADIAL * 3),
    []
  );
  // UVs are static (depend only on segment / radial index), so build once
  const uvs = useMemo(() => {
    const u = new Float32Array((TAIL_NODES) * TAIL_RADIAL * 2);
    for (let i = 0; i < TAIL_NODES; i++) {
      for (let j = 0; j < TAIL_RADIAL; j++) {
        const idx = (i * TAIL_RADIAL + j) * 2;
        u[idx]     = i / (TAIL_NODES - 1);     // U along the length of the tail
        u[idx + 1] = j / TAIL_RADIAL;          // V around the cross-section
      }
    }
    return u;
  }, []);
  const indices = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < TAIL_NODES - 1; i++) {
      for (let j = 0; j < TAIL_RADIAL; j++) {
        const a = i * TAIL_RADIAL + j;
        const b = i * TAIL_RADIAL + ((j + 1) % TAIL_RADIAL);
        const c = (i + 1) * TAIL_RADIAL + j;
        const d = (i + 1) * TAIL_RADIAL + ((j + 1) % TAIL_RADIAL);
        arr.push(a, b, d, a, d, c);
      }
    }
    return new Uint16Array(arr);
  }, []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    return g;
  }, [positions, normals, uvs, indices]);

  useEffect(() => () => geom.dispose(), [geom]);

  // Working vectors
  const tmp = useMemo(() => ({
    p: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    binormal: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  }), []);

  // Allocating a CatmullRomCurve3 + Frenet frames every frame, per cat, was
  // the single biggest perf leak in the scene — multiplied by every remote
  // player. Build the curve ONCE, mutate the same `points` array each frame,
  // and call updateArcLengths() so the curve picks up the new positions.
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4),
    [points]
  );

  useFrame((_, dt) => {
    try {
      t.current += dt;
      const time = t.current;

      // Build smooth control points along the tail
      const sway = anim === 'run' ? 5 : anim === 'walk' ? 3.4 : 2.0;
      const swayAmount = anim === 'run' ? 0.55 : anim === 'walk' ? 0.32 : 0.18;
      const upRise = anim === 'jump' ? 0.55 : anim === 'pounce' ? -0.15 : 0.32;

      for (let i = 0; i < TAIL_NODES; i++) {
        const ratio = i / (TAIL_NODES - 1);
        const phase = time * sway - ratio * 4.5;
        const x = -length * ratio;
        // Base curve rises smoothly toward the tip
        const baseRise = Math.sin(ratio * Math.PI * 0.65) * upRise;
        const wobbleY = Math.sin(phase * 0.8) * 0.04 * ratio;
        const kinkOffset = (tailType === 'kink' && Math.abs(ratio - 0.5) < 0.07) ? 0.12 : 0;
        const y = baseRise + wobbleY + kinkOffset;
        const z = Math.sin(phase) * swayAmount * Math.pow(ratio, 1.2);
        points[i].set(x, y, z);
      }

      // Refresh the cached curve's internal arc-length table for the
      // mutated control points, then compute one set of Frenet frames.
      curve.updateArcLengths();
      const segments = TAIL_NODES - 1;
      const frames = curve.computeFrenetFrames(segments, false);

      const fluffTip = tailType === 'fluffy' ? 0.5 : 0.25;
      for (let i = 0; i <= segments; i++) {
        const tt = i / segments;
        curve.getPointAt(tt, tmp.p);
        // Tapered radius: thicker at base, slim at tip, slight bulge if fluffy
        const taper = (1 - tt * 0.78) + (tailType === 'fluffy' ? Math.sin(tt * Math.PI) * 0.25 : 0);
        const r = Math.max(0.005, baseRadius * taper);
        const N = frames.normals[i];
        const B = frames.binormals[i];

        for (let j = 0; j < TAIL_RADIAL; j++) {
          const angle = (j / TAIL_RADIAL) * Math.PI * 2;
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);
          const nx = cos * N.x + sin * B.x;
          const ny = cos * N.y + sin * B.y;
          const nz = cos * N.z + sin * B.z;

          const idx = (i * TAIL_RADIAL + j) * 3;
          positions[idx]     = tmp.p.x + nx * r;
          positions[idx + 1] = tmp.p.y + ny * r;
          positions[idx + 2] = tmp.p.z + nz * r;
          normals[idx]     = nx;
          normals[idx + 1] = ny;
          normals[idx + 2] = nz;
        }

        // Cap the tip with a small sphere for a clean rounded end
        if (i === segments && tipRef.current) {
          tipRef.current.position.set(tmp.p.x, tmp.p.y, tmp.p.z);
          const tipR = Math.max(0.01, baseRadius * 0.22 + (tailType === 'fluffy' ? 0.03 : 0));
          tipRef.current.scale.setScalar(tipR / 0.05); // base sphere is r=0.05
        }
      }

      const posAttr = geom.attributes.position as THREE.BufferAttribute;
      const normAttr = geom.attributes.normal as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;
      geom.computeBoundingSphere();
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[wotc] tail frame error', e);
    }
  });

  return (
    <group position={attach}>
      <mesh ref={meshRef} geometry={geom} material={material} castShadow />
      <mesh ref={tipRef} material={material}>
        <sphereGeometry args={[0.05, 10, 8]} />
      </mesh>
    </group>
  );
}
