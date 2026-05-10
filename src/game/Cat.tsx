'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CatAppearance } from './types';
import { SIZE_STATS } from './types';
import { normalizeCat } from '@/lib/normalizeCat';

interface CatProps {
  cat: CatAppearance;
  position?: [number, number, number];
  rotation?: number;
  anim?: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'crouch' | 'pounce' | 'limp' | 'jump';
  injured?: boolean;
  carrying?: string | null;
}

const PATTERN_TINT: Record<string, number> = {
  solid: 0,
  tabby: 0.45,
  tortoiseshell: 0.6,
  calico: 0.5,
  point: 0.3,
  bicolor: 0.55,
  spotted: 0.4,
};

interface LegProps {
  position: [number, number, number];
  material: THREE.Material;
  // 0 = front leg, 1 = back leg (back legs bend more)
  back?: boolean;
}

const Leg = forwardRef<THREE.Group, LegProps>(function Leg({ position, material, back = false }, ref) {
  // Two-segment leg: upper (thigh/shoulder) → lower (shin) → paw
  return (
    <group ref={ref} position={position}>
      {/* Upper segment */}
      <mesh position={[0, -0.14, 0]} material={material}>
        <cylinderGeometry args={[0.055, 0.045, 0.28, 10]} />
      </mesh>
      {/* Knee/elbow joint */}
      <mesh position={[0, -0.28, back ? 0.04 : 0]} material={material}>
        <sphereGeometry args={[0.055, 10, 8]} />
      </mesh>
      {/* Lower segment */}
      <mesh position={[0, -0.42, back ? 0.06 : 0]} rotation={[back ? -0.15 : 0, 0, 0]} material={material}>
        <cylinderGeometry args={[0.045, 0.04, 0.28, 10]} />
      </mesh>
      {/* Paw */}
      <mesh position={[0, -0.56, back ? 0.08 : 0.02]} material={material}>
        <boxGeometry args={[0.09, 0.05, 0.13]} />
      </mesh>
    </group>
  );
});

export function Cat({ cat: rawCat, position = [0, 0, 0], rotation = 0, anim = 'idle', injured = false, carrying = null }: CatProps) {
  const cat = useMemo(() => normalizeCat(rawCat), [rawCat]);
  const groupRef = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Mesh>(null);
  const earR = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const fLegL = useRef<THREE.Group>(null);
  const fLegR = useRef<THREE.Group>(null);
  const bLegL = useRef<THREE.Group>(null);
  const bLegR = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const t = useRef(0);

  const stats = SIZE_STATS[cat.size];
  const scale = stats.scale * cat.height;
  const buildScale = cat.build;

  const furBase = useMemo(() => new THREE.Color(cat.furBase), [cat.furBase]);
  const furBelly = useMemo(() => new THREE.Color(cat.furBelly), [cat.furBelly]);
  const patternColor = useMemo(() => new THREE.Color(cat.patternColor), [cat.patternColor]);
  const patternStrength = PATTERN_TINT[cat.furPattern] ?? 0;

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

    if (bodyRef.current) {
      bodyRef.current.position.y = 0.6 + crouchY + bodyBob;
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

  // body material with pattern tint
  const bodyMaterial = useMemo(() => {
    const c = furBase.clone().lerp(patternColor, patternStrength * 0.35);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
  }, [furBase, patternColor, patternStrength]);

  const bellyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: furBelly, roughness: 0.9, metalness: 0 }),
    [furBelly]
  );

  const stripesMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: patternColor, roughness: 0.85, metalness: 0, transparent: true, opacity: patternStrength * 0.85 }),
    [patternColor, patternStrength]
  );

  const earInnerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f4b8c4', roughness: 0.9 }),
    []
  );

  const eyeColor = useMemo(() => {
    const map: Record<string, number> = {
      amber: 0xe2a23a, green: 0x6abf6a, blue: 0x6cc4e0, yellow: 0xf3d23a,
      copper: 0xc36a32, hazel: 0xa78540, odd: 0x6cc4e0,
    };
    return map[cat.eyeColor] ?? 0xe2a23a;
  }, [cat.eyeColor]);

  // Ear geometry
  const earGeo = (() => {
    switch (cat.earShape) {
      case 'tufted':  return <coneGeometry args={[0.085, 0.28, 8]} />;
      case 'rounded': return <sphereGeometry args={[0.1, 12, 12, 0, Math.PI]} />;
      case 'curl':    return <coneGeometry args={[0.075, 0.18, 8]} />;
      default:        return <coneGeometry args={[0.085, 0.22, 8]} />;
    }
  })();

  const safe = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);
  const tailFluff = cat.tail === 'fluffy' ? 1.6 : 1;
  const fluff = safe(1 + cat.fluffiness * 0.35, 1);

  // Body length and proportions (clamped to avoid NaN/0 reaching Three.js geometries)
  const bodyLen = Math.max(0.4, safe(0.95 * buildScale, 0.95));
  const bodyR = Math.max(0.08, safe(0.18 * fluff * buildScale, 0.18));

  return (
    <group ref={groupRef} scale={scale}>
      {/* shadow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[bodyLen * 0.7, bodyR * 1.6, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color={'#000'} transparent opacity={0.28} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.6, 0]}>
        {/* main body — cylinder + spherical caps along X (forward axis) */}
        <mesh castShadow rotation={[0, 0, Math.PI / 2]} material={bodyMaterial}>
          <cylinderGeometry args={[bodyR, bodyR, bodyLen, 16]} />
        </mesh>
        <mesh position={[bodyLen * 0.5, 0, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR, 16, 12]} />
        </mesh>
        <mesh position={[-bodyLen * 0.5, 0, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR, 16, 12]} />
        </mesh>
        {/* shoulders bulk */}
        <mesh position={[bodyLen * 0.42, 0.02, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR * 1.05, 14, 12]} />
        </mesh>
        {/* haunches (back hips) bulk */}
        <mesh position={[-bodyLen * 0.42, 0.04, 0]} material={bodyMaterial}>
          <sphereGeometry args={[bodyR * 1.15, 14, 12]} />
        </mesh>
        {/* belly */}
        <mesh position={[0, -bodyR * 0.55, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.85, 0.7]} material={bellyMaterial}>
          <cylinderGeometry args={[bodyR * 0.7, bodyR * 0.7, bodyLen * 0.85, 12]} />
        </mesh>
        {/* tabby/spotted overlay */}
        {patternStrength > 0 && (
          <mesh rotation={[0, 0, Math.PI / 2]} scale={[1.02, 1.02, 1.02]} material={stripesMaterial}>
            <cylinderGeometry args={[bodyR * 1.005, bodyR * 1.005, bodyLen, 16]} />
          </mesh>
        )}

        {/* neck */}
        <mesh position={[bodyLen * 0.55, 0.18, 0]} rotation={[0, 0, -0.6]} material={bodyMaterial}>
          <cylinderGeometry args={[bodyR * 0.7, bodyR * 0.85, 0.22, 12]} />
        </mesh>

        {/* head */}
        <group ref={headRef} position={[bodyLen * 0.65, 0.36, 0]}>
          {/* skull */}
          <mesh castShadow scale={[1.0, 0.95, 1.0]} material={bodyMaterial}>
            <sphereGeometry args={[0.18, 16, 14]} />
          </mesh>
          {/* cheeks/jowls */}
          <mesh position={[0.05, -0.06, 0.09]} material={bodyMaterial}>
            <sphereGeometry args={[0.07, 10, 10]} />
          </mesh>
          <mesh position={[0.05, -0.06, -0.09]} material={bodyMaterial}>
            <sphereGeometry args={[0.07, 10, 10]} />
          </mesh>
          {/* muzzle */}
          <mesh position={[0.16, -0.05, 0]} scale={[1, 0.8, 0.9]} material={bellyMaterial}>
            <sphereGeometry args={[0.085, 12, 10]} />
          </mesh>
          {/* chin */}
          <mesh position={[0.18, -0.1, 0]} scale={[0.8, 0.6, 0.7]} material={bellyMaterial}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
          {/* nose */}
          <mesh position={[0.235, -0.035, 0]}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshStandardMaterial color={'#3a1f24'} roughness={0.6} />
          </mesh>
          {/* eyes */}
          <mesh position={[0.155, 0.04, 0.075]} rotation={[0, 0.4, 0]}>
            <sphereGeometry args={[0.032, 12, 10]} />
            <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0.155, 0.04, -0.075]} rotation={[0, -0.4, 0]}>
            <sphereGeometry args={[0.032, 12, 10]} />
            <meshStandardMaterial color={cat.eyeColor === 'odd' ? 0xe2a23a : eyeColor} emissive={cat.eyeColor === 'odd' ? 0xe2a23a : eyeColor} emissiveIntensity={0.2} />
          </mesh>
          {/* pupils (slit) */}
          <mesh position={[0.171, 0.04, 0.075]}>
            <boxGeometry args={[0.005, 0.024, 0.005]} />
            <meshBasicMaterial color={'#0a0a0a'} />
          </mesh>
          <mesh position={[0.171, 0.04, -0.075]}>
            <boxGeometry args={[0.005, 0.024, 0.005]} />
            <meshBasicMaterial color={'#0a0a0a'} />
          </mesh>
          {/* ears (outer) */}
          <mesh ref={earL} position={[-0.04, 0.18, 0.105]} rotation={[0, 0, 0.15]} material={bodyMaterial}>
            {earGeo}
          </mesh>
          <mesh ref={earR} position={[-0.04, 0.18, -0.105]} rotation={[0, 0, -0.15]} material={bodyMaterial}>
            {earGeo}
          </mesh>
          {/* ear inner pink */}
          <mesh position={[-0.035, 0.17, 0.108]} rotation={[0, 0, 0.15]} scale={0.7} material={earInnerMat}>
            <coneGeometry args={[0.07, 0.18, 8]} />
          </mesh>
          <mesh position={[-0.035, 0.17, -0.108]} rotation={[0, 0, -0.15]} scale={0.7} material={earInnerMat}>
            <coneGeometry args={[0.07, 0.18, 8]} />
          </mesh>
          {/* whiskers */}
          <group position={[0.21, -0.05, 0]}>
            {[-1, 0, 1].map((i) => (
              <mesh key={`wL${i}`} position={[0, i * 0.012, 0.06]} rotation={[0, 0.3 + i * 0.1, 0]}>
                <boxGeometry args={[0.18, 0.0025, 0.0025]} />
                <meshBasicMaterial color={'#f5efe2'} />
              </mesh>
            ))}
            {[-1, 0, 1].map((i) => (
              <mesh key={`wR${i}`} position={[0, i * 0.012, -0.06]} rotation={[0, -0.3 - i * 0.1, 0]}>
                <boxGeometry args={[0.18, 0.0025, 0.0025]} />
                <meshBasicMaterial color={'#f5efe2'} />
              </mesh>
            ))}
          </group>

          {/* carrying prey */}
          {carrying && (
            <mesh position={[0.3, -0.12, 0]} rotation={[0, 0, 0.2]}>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshStandardMaterial color={'#7a4a2a'} roughness={0.9} />
            </mesh>
          )}

          {/* scars */}
          {cat.scars.includes('left-ear-nick') && (
            <mesh position={[-0.04, 0.28, 0.105]} rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.04, 0.06, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
          {cat.scars.includes('left-eye') && (
            <mesh position={[0.155, 0.04, 0.075]} rotation={[0, 0, 0.6]}>
              <boxGeometry args={[0.1, 0.012, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
          {cat.scars.includes('muzzle') && (
            <mesh position={[0.18, -0.02, 0.04]} rotation={[0, 0.4, 0.5]}>
              <boxGeometry args={[0.08, 0.01, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
        </group>

        {/* legs - placed at proper anatomical points */}
        {/* Front legs near shoulders */}
        <Leg ref={fLegL} position={[bodyLen * 0.4, -bodyR * 0.6, 0.12]} material={bodyMaterial} />
        <Leg ref={fLegR} position={[bodyLen * 0.4, -bodyR * 0.6, -0.12]} material={bodyMaterial} />
        {/* Back legs near haunches */}
        <Leg ref={bLegL} position={[-bodyLen * 0.4, -bodyR * 0.55, 0.12]} material={bodyMaterial} back />
        <Leg ref={bLegR} position={[-bodyLen * 0.4, -bodyR * 0.55, -0.12]} material={bodyMaterial} back />

        {/* tail — single smooth, tapered, animated tube */}
        <SmoothTail
          length={cat.tail === 'short' ? 0.85 : cat.tail === 'long' ? 1.55 : cat.tail === 'fluffy' ? 1.2 : 1.05}
          baseRadius={(bodyR * 0.55) * tailFluff * (1 + cat.fluffiness * 0.25)}
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
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    return g;
  }, [positions, normals, indices]);

  useEffect(() => () => geom.dispose(), [geom]);

  // Working vectors
  const tmp = useMemo(() => ({
    p: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    binormal: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  }), []);

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

      // CatmullRom curve through the points → consistent tangent frames
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
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
