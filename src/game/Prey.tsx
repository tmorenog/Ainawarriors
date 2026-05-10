'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type PreyKind = 'mouse' | 'rabbit' | 'fish' | 'bird' | 'squirrel';

export interface PreyState {
  id: string;
  kind: PreyKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alarmed: boolean;
  alive: boolean;
  home: THREE.Vector3;
}

export function spawnPrey(count = 24): PreyState[] {
  const arr: PreyState[] = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 380;
    const z = (Math.random() - 0.5) * 380;
    const r = Math.random();
    let kind: PreyKind = 'mouse';
    if (r > 0.85) kind = 'squirrel';
    else if (r > 0.7) kind = 'bird';
    else if (r > 0.55) kind = 'rabbit';
    if (Math.abs(x - 180) < 28) kind = 'fish';
    arr.push({
      id: `prey_${i}`,
      kind,
      pos: new THREE.Vector3(x, 0.2, z),
      vel: new THREE.Vector3(),
      alarmed: false,
      alive: true,
      home: new THREE.Vector3(x, 0.2, z),
    });
  }
  return arr;
}

interface PreyMeshProps {
  state: PreyState;
  threat?: THREE.Vector3 | null;
  onCaught?: (id: string) => void;
}

const COLORS: Record<PreyKind, string> = {
  mouse: '#7a6450',
  rabbit: '#a89880',
  fish: '#9bbed6',
  bird: '#5b6a7a',
  squirrel: '#9c5a2a',
};

export const PreyMesh = forwardRef<THREE.Group, PreyMeshProps>(function PreyMesh({ state, threat, onCaught }, _ref) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 100);

  useFrame((_, dt) => {
    if (!ref.current || !state.alive) return;
    t.current += dt;
    const desired = new THREE.Vector3();
    if (threat) {
      const d = state.pos.distanceTo(threat);
      const sense = state.kind === 'rabbit' ? 16 : state.kind === 'bird' ? 22 : 12;
      if (d < sense) {
        // flee
        const away = state.pos.clone().sub(threat).setY(0).normalize();
        desired.copy(away).multiplyScalar(state.kind === 'rabbit' ? 9 : 6);
        state.alarmed = true;
      } else {
        state.alarmed = false;
        // wander to home
        const back = state.home.clone().sub(state.pos).setY(0);
        if (back.length() > 6) desired.copy(back.normalize().multiplyScalar(1.5));
        else {
          desired.set(Math.sin(t.current * 0.7), 0, Math.cos(t.current * 0.5)).multiplyScalar(0.8);
        }
      }
    }
    state.vel.lerp(desired, 0.08);
    state.pos.addScaledVector(state.vel, dt);
    state.pos.y = state.kind === 'fish' ? 0.0 : 0.18 + Math.abs(Math.sin(t.current * 8)) * (state.alarmed ? 0.18 : 0.06);
    ref.current.position.copy(state.pos);
    if (state.vel.lengthSq() > 0.0001) {
      ref.current.rotation.y = Math.atan2(state.vel.x, state.vel.z);
    }

    // catch detection
    if (threat && state.alive) {
      const d = state.pos.distanceTo(threat);
      if (d < 0.9 && onCaught) {
        state.alive = false;
        onCaught(state.id);
      }
    }
  });

  if (!state.alive) return null;

  const color = COLORS[state.kind];
  const scale = state.kind === 'rabbit' ? 1.0 : state.kind === 'mouse' ? 0.5 : state.kind === 'squirrel' ? 0.7 : state.kind === 'fish' ? 0.6 : 0.55;

  return (
    <group ref={ref} position={state.pos.toArray() as [number, number, number]} scale={scale}>
      <mesh castShadow>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0.16, 0.08, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {state.kind !== 'fish' && (
        <mesh position={[-0.18, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.04, state.kind === 'rabbit' ? 0.05 : 0.3, 8]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
});
