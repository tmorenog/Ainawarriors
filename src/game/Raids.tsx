'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from './useGameStore';
import { terrainHeightAt } from './terrain';

// Visible enemy warriors who walk toward the player when a leader has
// declared battle. Each raider:
//   - Renders as a simple red-marked cat (small group of meshes — cheap)
//   - Walks toward the player at ~2.5 u/s
//   - Bites the player every 1.6s when in range
//   - Loses HP when the player pounces (Q) or swipes (F) nearby — done
//     from Game.tsx PlayerController where we already have controlsRef
//   - Despawns when its HP reaches 0
// When all raiders are dead, the raid clears. When the raid time runs
// out it ends in a "truce" outcome. When the player's HP hits 0 we go
// through the regular respawn path.
export function Raids({ viewerRef }: { viewerRef: React.MutableRefObject<THREE.Object3D | null> }) {
  const raid = useGameStore((s) => s.raid);
  if (!raid) return null;
  return (
    <>
      {raid.raiders.map((r) => r.alive && (
        <Raider key={r.id} id={r.id} viewerRef={viewerRef} />
      ))}
    </>
  );
}

function Raider({ id, viewerRef }: { id: string; viewerRef: React.MutableRefObject<THREE.Object3D | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const lastBiteAt = useRef(0);

  useFrame((_, dt) => {
    const s = useGameStore.getState();
    const r = s.raid?.raiders.find((x) => x.id === id);
    const me = viewerRef.current?.position;
    if (!r || !r.alive || !groupRef.current) return;

    if (me) {
      const dx = me.x - r.x;
      const dz = me.z - r.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const speed = 2.5; // a touch faster than fleeing prey but slow enough to react
        const stepX = (dx / d) * speed * dt;
        const stepZ = (dz / d) * speed * dt;
        s.updateRaider(id, { x: r.x + stepX, z: r.z + stepZ });
      }
      // Bite the player every 1.6s when in close range.
      if (d < 2.2) {
        const now = performance.now() / 1000;
        if (now - lastBiteAt.current > 1.6) {
          lastBiteAt.current = now;
          const next = Math.max(0, s.hud.hp - 9);
          s.setHud({ hp: next });
          s.setCameraShake(0.45);
          s.triggerSwipeFx('bite');
          s.pushChat({
            id: 'rd' + Date.now(),
            fromId: 'system',
            fromName: r.clan ? `${r.clan} raider` : 'Raider',
            scope: 'system',
            text: 'A raider bites you!',
            at: Date.now(),
          });
        }
      }
    }

    const y = terrainHeightAt(r.x, r.z);
    groupRef.current.position.set(r.x, y, r.z);
    if (me) groupRef.current.rotation.y = Math.atan2(-(r.z - me.z), -(r.x - me.x));
  });

  // Look up current raider for rendering (HP bar)
  const raid = useGameStore((s) => s.raid);
  const r = raid?.raiders.find((x) => x.id === id);
  if (!r) return null;

  // Procedural quick-cat. Red sash hints it's an enemy.
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.20, 0.20, 0.55, 18]} />
        <meshStandardMaterial color={'#5a3a25'} roughness={0.85} />
      </mesh>
      <mesh position={[0.28, 0.48, 0]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={'#5a3a25'} roughness={0.85} />
      </mesh>
      {/* eyes */}
      <mesh position={[0.46, 0.55, 0.07]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color={'#e44'} emissive={'#a22'} emissiveIntensity={0.4} /></mesh>
      <mesh position={[0.46, 0.55, -0.07]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color={'#e44'} emissive={'#a22'} emissiveIntensity={0.4} /></mesh>
      {/* legs */}
      {[[0.2, 0.18, 0.12], [0.2, 0.18, -0.12], [-0.2, 0.18, 0.12], [-0.2, 0.18, -0.12]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.05, 0.05, 0.34, 8]} />
          <meshStandardMaterial color={'#5a3a25'} />
        </mesh>
      ))}
      {/* red sash so they read as enemies even from distance */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 14]} />
        <meshStandardMaterial color={'#c0392b'} roughness={0.5} />
      </mesh>
      <Html position={[0, 1.1, 0]} center distanceFactor={9}>
        <div className="px-2 py-0.5 rounded-full bg-black/70 text-bone text-[10px] whitespace-nowrap border border-thunder/60 shadow">
          ⚔ raider {Math.round(r.hp)}/60
        </div>
      </Html>
    </group>
  );
}
