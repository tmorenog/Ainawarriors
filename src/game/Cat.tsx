'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CatAppearance } from './types';
import { SIZE_STATS } from './types';

interface CatProps {
  cat: CatAppearance;
  position?: [number, number, number];
  rotation?: number;
  anim?: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'crouch' | 'pounce' | 'limp';
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

export function Cat({ cat, position = [0, 0, 0], rotation = 0, anim = 'idle', injured = false, carrying = null }: CatProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRefs = useRef<THREE.Mesh[]>([]);
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
    t.current += dt;
    const time = t.current;

    let stride = 0;
    let speed = 0;
    let bodyBob = 0;
    let crouchY = 0;
    let pounceY = 0;

    if (anim === 'walk') { stride = 1.0; speed = 6; }
    else if (anim === 'run') { stride = 1.6; speed = 12; }
    else if (anim === 'crouch') { crouchY = -0.18; }
    else if (anim === 'pounce') {
      pounceY = Math.max(0, Math.sin(time * 6) * 0.5);
      stride = 0.6; speed = 10;
    } else if (anim === 'sit') { crouchY = -0.05; }
    else if (anim === 'sleep') { crouchY = -0.32; }
    else if (anim === 'limp' || injured) { stride = 0.6; speed = 4.5; }

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

    // tail wave
    tailRefs.current.forEach((seg, i) => {
      if (!seg) return;
      const phase = time * (anim === 'run' ? 5 : 2.2) - i * 0.5;
      seg.rotation.y = Math.sin(phase) * (0.18 + i * 0.06);
      seg.rotation.x = Math.sin(phase * 0.8) * 0.05 + (anim === 'pounce' ? -0.2 : 0);
    });

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
      bodyRef.current.position.y = 0.32 + crouchY + bodyBob;
    }
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1] + pounceY, position[2]);
      groupRef.current.rotation.y = rotation;
    }
  });

  // mix base + pattern by simple emissive trick on body parts
  const bodyMaterial = useMemo(() => {
    const c = furBase.clone().lerp(patternColor, patternStrength * 0.35);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
  }, [furBase, patternColor, patternStrength]);

  const bellyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: furBelly, roughness: 0.9, metalness: 0 }),
    [furBelly]
  );

  const stripesMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: patternColor, roughness: 0.85, metalness: 0, transparent: true, opacity: patternStrength }),
    [patternColor, patternStrength]
  );

  const eyeColor = useMemo(() => {
    const map: Record<string, number> = {
      amber: 0xe2a23a, green: 0x6abf6a, blue: 0x6cc4e0, yellow: 0xf3d23a,
      copper: 0xc36a32, hazel: 0xa78540, odd: 0x6cc4e0,
    };
    return map[cat.eyeColor] ?? 0xe2a23a;
  }, [cat.eyeColor]);

  const earGeo = (() => {
    switch (cat.earShape) {
      case 'tufted':  return <coneGeometry args={[0.13, 0.32, 8]} />;
      case 'rounded': return <sphereGeometry args={[0.14, 12, 12, 0, Math.PI]} />;
      case 'curl':    return <coneGeometry args={[0.11, 0.22, 8]} />;
      default:        return <coneGeometry args={[0.12, 0.25, 8]} />;
    }
  })();

  const tailLen = cat.tail === 'short' ? 4 : cat.tail === 'long' ? 9 : cat.tail === 'fluffy' ? 7 : 6;
  const tailFluff = cat.tail === 'fluffy' ? 1.5 : 1;
  const fluff = 1 + cat.fluffiness * 0.45;

  return (
    <group ref={groupRef} scale={scale}>
      {/* shadow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55 * buildScale, 16]} />
        <meshBasicMaterial color={'#000'} transparent opacity={0.25} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.32, 0]}>
        {/* body */}
        <mesh castShadow scale={[1.0 * buildScale * fluff, 0.6 * fluff, 0.55 * fluff]} material={bodyMaterial}>
          <sphereGeometry args={[0.5, 18, 14]} />
        </mesh>
        {/* belly highlight */}
        <mesh position={[0, -0.12, 0]} scale={[0.85 * buildScale, 0.45, 0.45]} material={bellyMaterial}>
          <sphereGeometry args={[0.5, 16, 12]} />
        </mesh>
        {/* tabby stripes overlay */}
        {patternStrength > 0 && (
          <mesh scale={[1.02 * buildScale * fluff, 0.62 * fluff, 0.57 * fluff]} material={stripesMaterial}>
            <sphereGeometry args={[0.5, 18, 14]} />
          </mesh>
        )}

        {/* head */}
        <group ref={headRef} position={[0.55 * buildScale, 0.18, 0]}>
          <mesh castShadow scale={[0.9, 0.85, 0.9]} material={bodyMaterial}>
            <sphereGeometry args={[0.22, 16, 14]} />
          </mesh>
          {/* muzzle */}
          <mesh position={[0.18, -0.06, 0]} scale={[0.9, 0.7, 0.8]} material={bellyMaterial}>
            <sphereGeometry args={[0.11, 12, 10]} />
          </mesh>
          {/* nose */}
          <mesh position={[0.27, -0.04, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color={'#3a1f24'} roughness={0.6} />
          </mesh>
          {/* eyes */}
          <mesh position={[0.18, 0.05, 0.1]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial color={eyeColor} emissive={eyeColor} emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[0.18, 0.05, -0.1]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial color={cat.eyeColor === 'odd' ? 0xe2a23a : eyeColor} emissive={cat.eyeColor === 'odd' ? 0xe2a23a : eyeColor} emissiveIntensity={0.15} />
          </mesh>
          {/* ears */}
          <mesh ref={earL} position={[-0.02, 0.21, 0.13]} rotation={[0, 0, 0.15]} material={bodyMaterial}>
            {earGeo}
          </mesh>
          <mesh ref={earR} position={[-0.02, 0.21, -0.13]} rotation={[0, 0, -0.15]} material={bodyMaterial}>
            {earGeo}
          </mesh>
          {/* whiskers (lines) */}
          <group position={[0.23, -0.05, 0]}>
            {[-1, 0, 1].map((i) => (
              <mesh key={`wL${i}`} position={[0, i * 0.015, 0.05]} rotation={[0, 0.3, 0]}>
                <boxGeometry args={[0.18, 0.003, 0.003]} />
                <meshBasicMaterial color={'#f5efe2'} />
              </mesh>
            ))}
            {[-1, 0, 1].map((i) => (
              <mesh key={`wR${i}`} position={[0, i * 0.015, -0.05]} rotation={[0, -0.3, 0]}>
                <boxGeometry args={[0.18, 0.003, 0.003]} />
                <meshBasicMaterial color={'#f5efe2'} />
              </mesh>
            ))}
          </group>

          {/* carrying prey in mouth */}
          {carrying && (
            <mesh position={[0.36, -0.12, 0]} rotation={[0, 0, 0.2]}>
              <sphereGeometry args={[0.08, 10, 8]} />
              <meshStandardMaterial color={'#7a4a2a'} roughness={0.9} />
            </mesh>
          )}

          {/* scars */}
          {cat.scars.includes('left-ear-nick') && (
            <mesh position={[-0.02, 0.31, 0.13]} rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.04, 0.06, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
          {cat.scars.includes('left-eye') && (
            <mesh position={[0.18, 0.05, 0.1]} rotation={[0, 0, 0.6]}>
              <boxGeometry args={[0.12, 0.012, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
          {cat.scars.includes('muzzle') && (
            <mesh position={[0.21, -0.02, 0.04]} rotation={[0, 0.4, 0.5]}>
              <boxGeometry args={[0.1, 0.01, 0.005]} />
              <meshBasicMaterial color={'#3a2618'} />
            </mesh>
          )}
        </group>

        {/* legs */}
        <Leg ref={fLegL} position={[0.32 * buildScale, -0.32, 0.18]} material={bodyMaterial} />
        <Leg ref={fLegR} position={[0.32 * buildScale, -0.32, -0.18]} material={bodyMaterial} />
        <Leg ref={bLegL} position={[-0.32 * buildScale, -0.32, 0.18]} material={bodyMaterial} />
        <Leg ref={bLegR} position={[-0.32 * buildScale, -0.32, -0.18]} material={bodyMaterial} />

        {/* tail */}
        <group position={[-0.5 * buildScale, 0.08, 0]}>
          {Array.from({ length: tailLen }).map((_, i) => (
            <mesh
              key={i}
              ref={(el) => { if (el) tailRefs.current[i] = el; }}
              position={[-i * 0.11, i * 0.012 + (cat.tail === 'kink' && i === 3 ? 0.08 : 0), 0]}
              material={bodyMaterial}
            >
              <sphereGeometry args={[(0.08 + (tailLen - i) * 0.005) * tailFluff * (1 + cat.fluffiness * 0.3), 8, 8]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

interface LegProps {
  position: [number, number, number];
  material: THREE.Material;
}

const Leg = forwardRef<THREE.Group, LegProps>(function Leg({ position, material }, ref) {
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, -0.08, 0]} material={material}>
        <cylinderGeometry args={[0.06, 0.05, 0.18, 8]} />
      </mesh>
      <mesh position={[0, -0.2, 0]} material={material}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
    </group>
  );
});
