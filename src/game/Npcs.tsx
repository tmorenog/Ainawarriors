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
// We don't ship full-fledged AI — these NPCs idle in place, head bobbing.
// The combat with Tigerstar is mediated by the dialog → battle flow.
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

  // Snap Y to terrain height (don't float above hills)
  const groundY = terrainHeightAt(npc.pos[0], npc.pos[2]);
  const wantTalk = useRef(false);

  useFrame(() => {
    const me = viewerRef.current?.position;
    if (!me) return;
    const dx = npc.pos[0] - me.x;
    const dz = npc.pos[2] - me.z;
    const close = (dx * dx + dz * dz) < 4 * 4;
    if (close !== promptRef.current.near) {
      promptRef.current.near = close;
      wantTalk.current = close;
    }
  });

  // Tigerstar gets a HP bar above his head while the battle is active.
  const showTigerHp = id === 'tigerstar' && battleActive;

  return (
    <group ref={groupRef} position={[npc.pos[0], groundY, npc.pos[2]]}>
      <Cat cat={npc.cat} anim={id === 'tigerstar' && battleActive ? 'crouch' : 'sit'} />
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
          ★ {npc.cat.name}
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
