'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Cat } from './Cat';
import { World } from './World';
import { CameraRig } from './CameraRig';
import { PreyMesh, spawnPrey, type PreyState } from './Prey';
import { createControls, useKeyboardControls, useMouseLook } from './useControls';
import { useGameStore } from './useGameStore';
import { CLANS } from '@/lib/clans';
import { SIZE_STATS } from './types';

export interface GameNetHandle {
  sendMove: (pos: [number, number, number], rot: number, anim: string) => void;
  sendCatch: (preyId: string, kind: string) => void;
}

interface GameProps {
  room: string;
  net: GameNetHandle;
}

function PlayerController({
  selfRef,
  yaw,
  pitch,
  onAnim,
  onPos,
  preyList,
  onCatch,
}: {
  selfRef: React.MutableRefObject<THREE.Object3D | null>;
  yaw: React.MutableRefObject<number>;
  pitch: React.MutableRefObject<number>;
  onAnim: (a: string) => void;
  onPos: (p: [number, number, number], rot: number) => void;
  preyList: React.MutableRefObject<PreyState[]>;
  onCatch: (id: string, kind: string) => void;
}) {
  const controlsRef = useRef(createControls());
  useKeyboardControls(controlsRef);
  useMouseLook(controlsRef, 0.0024);

  const cat = useGameStore((s) => s.cat);
  const setHud = useGameStore((s) => s.setHud);
  const hud = useGameStore((s) => s.hud);
  const setCarrying = useGameStore((s) => s.setCarrying);
  const carrying = useGameStore((s) => s.carrying);
  const settings = useGameStore((s) => s.settings);
  const room = useGameStore((s) => s.room);

  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const lastSent = useRef(0);
  const lastAnim = useRef('idle');

  useEffect(() => {
    if (cat) pos.current.set(...(CLANS[cat.clan].campCenter as [number, number, number]));
  }, [cat]);

  useFrame((_, dt) => {
    if (!cat) return;
    const c = controlsRef.current;
    yaw.current += c.yaw; c.yaw = 0;
    pitch.current += c.pitch; c.pitch = 0;
    pitch.current = Math.max(-0.8, Math.min(0.8, pitch.current));

    if (c.toggleCamera) {
      c.toggleCamera = false;
      useGameStore.getState().setSettings({ cameraMode: settings.cameraMode === 'first' ? 'third' : 'first' });
    }

    const stats = SIZE_STATS[cat.size];
    const clanBonus = (CLANS[cat.clan].bonuses.speed ?? 1) as number;
    const base = 6 * stats.speed * clanBonus;
    const speed = (c.sprint ? base * 1.7 : base) * (c.crouch ? 0.45 : 1) * (hud.stamina < 5 ? 0.5 : 1);
    const fwd = c.forward;
    const sd = c.strafe;

    const dir = new THREE.Vector3(
      Math.sin(yaw.current) * fwd + Math.cos(yaw.current) * sd,
      0,
      Math.cos(yaw.current) * fwd - Math.sin(yaw.current) * sd
    );
    if (dir.lengthSq() > 0) dir.normalize();
    pos.current.addScaledVector(dir, speed * dt);

    let anim = 'idle';
    if (c.pounce) { anim = 'pounce'; c.pounce = false; }
    else if (c.crouch && (fwd !== 0 || sd !== 0)) anim = 'crouch';
    else if (c.crouch) anim = 'sit';
    else if (c.sprint && (fwd !== 0 || sd !== 0)) anim = 'run';
    else if (fwd !== 0 || sd !== 0) anim = 'walk';

    if (hud.hp < 30 && (fwd !== 0 || sd !== 0)) anim = 'limp';

    // stamina/hunger drain
    const draining = anim === 'run';
    setHud({
      stamina: Math.max(0, Math.min(100, hud.stamina + (draining ? -20 : 8) * dt)),
      hunger: Math.max(0, hud.hunger - 0.4 * dt),
    });

    // attempt to catch nearest prey when pouncing
    if (anim === 'pounce') {
      const closest = preyList.current
        .filter((p) => p.alive)
        .map((p) => ({ p, d: p.pos.distanceTo(pos.current) }))
        .sort((a, b) => a.d - b.d)[0];
      if (closest && closest.d < 1.4) {
        closest.p.alive = false;
        onCatch(closest.p.id, closest.p.kind);
        if (!carrying) setCarrying(closest.p.kind);
      }
    }

    if (selfRef.current) {
      selfRef.current.position.copy(pos.current);
      selfRef.current.rotation.y = yaw.current + Math.PI;
    }

    if (anim !== lastAnim.current) {
      lastAnim.current = anim;
      onAnim(anim);
    }

    const now = performance.now();
    if (now - lastSent.current > 80) {
      lastSent.current = now;
      onPos([pos.current.x, pos.current.y, pos.current.z], yaw.current + Math.PI);
    }
  });

  return null;
}

function RemoteBubble({ text }: { text: string }) {
  return (
    <Html position={[0, 1.2, 0]} center distanceFactor={6}>
      <div className="px-2 py-1 rounded-xl bg-white/85 text-bark text-xs shadow border border-bone whitespace-nowrap max-w-[220px]">
        {text}
      </div>
    </Html>
  );
}

function NameTag({ name, role, isLeader, isDeputy }: { name: string; role: string; isLeader: boolean; isDeputy: boolean }) {
  return (
    <Html position={[0, 1.0, 0]} center distanceFactor={8}>
      <div className="text-[10px] px-2 py-0.5 rounded-full bg-black/55 text-bone border border-white/10 whitespace-nowrap">
        {isLeader ? '★ ' : isDeputy ? '✦ ' : ''}{name} <span className="opacity-70">· {role}</span>
      </div>
    </Html>
  );
}

export function Game({ room, net }: GameProps) {
  const cat = useGameStore((s) => s.cat);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const settings = useGameStore((s) => s.settings);
  const chat = useGameStore((s) => s.chat);
  const setRoom = useGameStore((s) => s.setRoom);
  const roomState = useGameStore((s) => s.room);

  const selfRef = useRef<THREE.Object3D | null>(null);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const [anim, setAnim] = useState<string>('idle');
  const preyList = useRef<PreyState[]>(spawnPrey(28));

  // Day/night/weather progression in offline mode
  useEffect(() => {
    if (!roomState || roomState.roomId !== 'offline') return;
    const id = setInterval(() => {
      setRoom({
        ...roomState,
        timeOfDay: (roomState.timeOfDay + 0.001) % 1,
      });
    }, 600);
    return () => clearInterval(id);
  }, [roomState, setRoom]);

  // last bubble text per player
  const bubbles = useMemo(() => {
    const m = new Map<string, string>();
    const recent = chat.slice(-10);
    for (const c of recent) {
      if (c.scope === 'system') continue;
      if (Date.now() - c.at < 5500) m.set(c.fromId, c.text);
    }
    return m;
  }, [chat]);

  if (!cat || !roomState) {
    return (
      <div className="absolute inset-0 grid place-items-center text-bone">
        <div className="text-center font-display text-2xl animate-pulse-soft">Slipping into the forest...</div>
      </div>
    );
  }

  const dpr: [number, number] = settings.graphics === 'low' ? [1, 1] : settings.graphics === 'medium' ? [1, 1.5] : [1, 2];
  const shadows = settings.graphics !== 'low';

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      camera={{ fov: 60, near: 0.1, far: 600, position: [0, 6, 8] }}
      gl={{ antialias: settings.graphics !== 'low', powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <World
          timeOfDay={roomState.timeOfDay}
          weather={roomState.weather}
          season={roomState.season}
          graphics={settings.graphics}
        />

        {/* self */}
        <group ref={selfRef as any}>
          <Cat cat={cat} anim={anim as any} carrying={useGameStore.getState().carrying} />
          {bubbles.get(selfId) && <RemoteBubble text={bubbles.get(selfId)!} />}
        </group>

        {/* others */}
        {Object.values(players).map((p) => {
          if (p.socketId === selfId) return null;
          return (
            <group key={p.socketId} position={p.pos} rotation={[0, p.rot, 0]}>
              <Cat cat={p.cat} anim={p.anim as any} />
              <NameTag name={p.cat.name} role={p.cat.role} isLeader={p.isLeader} isDeputy={p.isDeputy} />
              {bubbles.get(p.socketId) && <RemoteBubble text={bubbles.get(p.socketId)!} />}
            </group>
          );
        })}

        {/* prey */}
        {preyList.current.map((p) => (
          <PreyMesh
            key={p.id}
            state={p}
            threat={selfRef.current ? selfRef.current.position : null}
            onCaught={(id) => {
              const found = preyList.current.find((x) => x.id === id);
              if (found) net.sendCatch(id, found.kind);
              const cur = useGameStore.getState();
              cur.setHud({ hunger: Math.min(100, cur.hud.hunger + 18) });
              cur.pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: `You caught a ${found?.kind ?? 'prey'}.`, at: Date.now() });
            }}
          />
        ))}

        <CameraRig target={selfRef as any} yaw={yaw} pitch={pitch} mode={settings.cameraMode} />
        <PlayerController
          selfRef={selfRef as any}
          yaw={yaw}
          pitch={pitch}
          preyList={preyList}
          onAnim={(a) => {
            setAnim(a);
            net.sendMove(
              selfRef.current ? [selfRef.current.position.x, selfRef.current.position.y, selfRef.current.position.z] : [0, 0, 0],
              yaw.current + Math.PI,
              a
            );
          }}
          onCatch={(id, kind) => net.sendCatch(id, kind)}
          onPos={(p, r) => net.sendMove(p, r, anim)}
        />
      </Suspense>
    </Canvas>
  );
}
