'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Cat } from './Cat';
import { NPCS, type NpcId } from '@/lib/npcs';
import { useGameStore } from './useGameStore';
import { terrainHeightAt } from './terrain';

// Renders Firestar and Tigerstar in the world. Each NPC shows a glowing
// nameplate above their head; if the player walks within ~3 units a "Talk"
// prompt appears, and clicking it opens the dialog.
//
// Firestar's behaviour changes with mission state:
//   - 'none'    : he stays at his ThunderClan camp post
//   - 'accepted': he walks toward Tigerstar, leading the player there.
//                 If close to Tigerstar during battle he also contributes
//                 a small amount of damage (~6 hp / 2s).
//   - 'won'     : he returns to camp.
export function Npcs({ viewerRef }: { viewerRef: React.MutableRefObject<THREE.Object3D | null> }) {
  return (
    <>
      {(Object.keys(NPCS) as NpcId[]).map((id) => (
        <NpcInstance key={id} id={id} viewerRef={viewerRef} />
      ))}
    </>
  );
}

function NpcInstance({
  id,
  viewerRef,
}: {
  id: NpcId;
  viewerRef: React.MutableRefObject<THREE.Object3D | null>;
}) {
  const npc = NPCS[id];
  const groupRef = useRef<THREE.Group>(null);
  const promptRef = useRef<{ near: boolean }>({ near: false });
  const setNpcDialogId = useGameStore((s) => s.setNpcDialogId);
  const battleActive = useGameStore((s) => s.battleActive);
  const tigerstarHp = useGameStore((s) => s.tigerstarHp);

  // Each NPC keeps its own dynamic position so Firestar can walk. We seed
  // it from the static spawn point and lerp toward a target each frame.
  const livePos = useRef(new THREE.Vector3(npc.pos[0], terrainHeightAt(npc.pos[0], npc.pos[2]), npc.pos[2]));
  const liveRot = useRef(0);
  const lastFirestarHitAt = useRef(0);
  const wantTalk = useRef(false);

  useFrame((_, dt) => {
    const me = viewerRef.current?.position;
    const g = groupRef.current;
    if (!g) return;

    // Compute Firestar's target each frame:
    //   - mission accepted: walk along the line from player → Tigerstar,
    //     keeping ~5 units AHEAD of the player so it really feels like he
    //     is leading you. As you approach Tigerstar, he closes in.
    //   - otherwise: hold his static spawn point.
    const store = useGameStore.getState();
    let targetX = npc.pos[0];
    let targetZ = npc.pos[2];

    if (id === 'firestar') {
      if (store.mission === 'accepted' && me) {
        const tx = NPCS.tigerstar.pos[0];
        const tz = NPCS.tigerstar.pos[2];
        const dx = tx - me.x;
        const dz = tz - me.z;
        const distToTiger = Math.hypot(dx, dz);
        if (distToTiger < 6) {
          // Once we're close to Tigerstar he stops at his side and faces him.
          targetX = me.x + (dx / Math.max(1, distToTiger)) * 2.5;
          targetZ = me.z + (dz / Math.max(1, distToTiger)) * 2.5;
        } else {
          // Lead the player by ~5 units in the Tigerstar direction.
          const lead = Math.min(5, distToTiger * 0.4);
          targetX = me.x + (dx / distToTiger) * lead;
          targetZ = me.z + (dz / distToTiger) * lead;
        }
      } else if (store.mission === 'won') {
        targetX = npc.pos[0];
        targetZ = npc.pos[2];
      }
    }

    const desiredY = terrainHeightAt(targetX, targetZ);
    const a = Math.min(1, dt * 2.5);
    livePos.current.x += (targetX - livePos.current.x) * a;
    livePos.current.z += (targetZ - livePos.current.z) * a;
    livePos.current.y += (desiredY - livePos.current.y) * a;

    // Face direction of motion (or face Tigerstar if at his side)
    const dxFace = targetX - livePos.current.x;
    const dzFace = targetZ - livePos.current.z;
    if (dxFace * dxFace + dzFace * dzFace > 0.01) {
      const moveYaw = Math.atan2(-dzFace, dxFace);
      let delta = moveYaw - liveRot.current;
      while (delta >  Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      liveRot.current += delta * Math.min(1, dt * 6);
    }

    g.position.copy(livePos.current);
    g.rotation.y = liveRot.current;

    // "Talk to" proximity prompt
    if (me) {
      const dx = livePos.current.x - me.x;
      const dz = livePos.current.z - me.z;
      const close = (dx * dx + dz * dz) < 4 * 4;
      if (close !== promptRef.current.near) {
        promptRef.current.near = close;
        wantTalk.current = close;
      }
    }

    // Firestar in the battle: chip in 6 hp every 2 seconds while close to
    // Tigerstar. Makes the fight feel cooperative.
    if (id === 'firestar' && store.battleActive) {
      const tx = NPCS.tigerstar.pos[0];
      const tz = NPCS.tigerstar.pos[2];
      const dx = livePos.current.x - tx;
      const dz = livePos.current.z - tz;
      if (dx * dx + dz * dz < 6 * 6) {
        const nowS = performance.now() / 1000;
        if (nowS - lastFirestarHitAt.current > 2) {
          lastFirestarHitAt.current = nowS;
          const next = Math.max(0, store.tigerstarHp - 6);
          store.setTigerstarHp(next);
          if (next <= 0) {
            store.setBattleActive(false);
            store.setMission('won');
            store.setNpcDialogId(null);
            store.pushChat({
              id: 'sys' + Date.now(),
              fromId: 'system',
              fromName: 'Firestar',
              scope: 'system',
              text: 'Together we did it. ThunderClan owes you everything.',
              at: Date.now(),
            });
            store.setHud({ hp: 100, stamina: 100, reputation: Math.min(100, store.hud.reputation + 25) });
          } else {
            store.pushChat({
              id: 'fs' + Date.now(),
              fromId: 'system',
              fromName: 'Firestar',
              scope: 'system',
              text: `Firestar lunges! (Tigerstar ${next}/100)`,
              at: Date.now(),
            });
          }
        }
      }
    }
  });

  // Animation pick: Tigerstar crouches when battle is on, Firestar walks
  // when leading, sits otherwise.
  const mission = useGameStore((s) => s.mission);
  const animFor = (() => {
    if (id === 'tigerstar') return battleActive ? 'crouch' : 'sit';
    if (id === 'firestar') {
      if (mission === 'accepted') return 'walk';
      return 'sit';
    }
    return 'sit';
  })();

  const showTigerHp = id === 'tigerstar' && battleActive;

  return (
    <group ref={groupRef}>
      <Cat cat={npc.cat} anim={animFor as any} />
      <Html position={[0, 1.05, 0]} center distanceFactor={9}>
        <div
          className="px-2 py-0.5 rounded-full border whitespace-nowrap shadow"
          style={{
            background: id === 'tigerstar' ? 'rgba(60,12,12,0.85)' : 'rgba(36,60,28,0.85)',
            color: id === 'tigerstar' ? '#ffd2c2' : '#fffbe6',
            borderColor: id === 'tigerstar' ? '#a04848' : '#cdb673',
            fontSize: 11,
          }}
        >
          ★ {npc.cat.name}{id === 'firestar' && mission === 'accepted' ? ' — follow!' : ''}
        </div>
        {showTigerHp && (
          <div className="mt-1 w-32 h-1.5 mx-auto rounded bg-black/60 overflow-hidden">
            <div className="h-full bg-thunder" style={{ width: `${tigerstarHp}%` }} />
          </div>
        )}
        {wantTalk.current && (
          <button
            onClick={() => setNpcDialogId(id)}
            className="mt-1 px-2 py-0.5 rounded-full bg-thunder text-bone text-[10px] shadow pointer-events-auto"
          >
            Talk to {npc.cat.name}
          </button>
        )}
      </Html>
    </group>
  );
}
