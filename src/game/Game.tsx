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
import { SIZE_STATS, type PlayerState } from './types';
import { SilentErrorBoundary } from '@/components/SilentErrorBoundary';
import { terrainHeightAt } from './terrain';
import { getAudioEngine } from './audio';

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
  catYaw,
  yaw,
  pitch,
  onAnim,
  onPos,
  preyList,
  onCatch,
}: {
  selfRef: React.MutableRefObject<THREE.Object3D | null>;
  catYaw: React.MutableRefObject<number>;
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

  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const vy = useRef(0);
  const grounded = useRef(true);
  const lastGroundedAt = useRef(0); // for coyote-frame jump
  const lastSent = useRef(0);
  const lastAnim = useRef('idle');
  const lastPounceMissAt = useRef(0);
  const lastTargetAt = useRef(0);
  const distanceAccum = useRef(0);
  const lastClanVisited = useRef<string | null>(null);

  useEffect(() => {
    if (cat) {
      const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
      pos.current.set(cx, terrainHeightAt(cx, cz), cz);
      // Cat geometry forward is local +X. To make the cat face the camera's
      // forward direction (sin(yaw), 0, cos(yaw)) we need rotation.y so that
      // R_Y(θ)·(1,0,0) = (sin yaw, 0, cos yaw), i.e. θ = atan2(-cos(yaw), sin(yaw)).
      catYaw.current = Math.atan2(-Math.cos(yaw.current), Math.sin(yaw.current));
    }
  }, [cat, catYaw, yaw]);

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

    // Movement direction in world space.
    //   forward (W) goes in the camera's forward direction (sin(yaw), 0, cos(yaw))
    //   strafe  (D = +1) goes to the camera's RIGHT, which in our setup
    //   (camera at (-sin·d, h, -cos·d) looking at origin) is world (-cos(yaw), 0, sin(yaw)).
    //   The previous formula inverted strafe — pressing A walked the cat
    //   to the right of the screen.
    const dir = new THREE.Vector3(
      Math.sin(yaw.current) * fwd - Math.cos(yaw.current) * sd,
      0,
      Math.cos(yaw.current) * fwd + Math.sin(yaw.current) * sd
    );
    if (dir.lengthSq() > 0) dir.normalize();
    pos.current.addScaledVector(dir, speed * dt);

    // Tasks — track total distance walked (in 1-unit chunks) and clan camp
    // visits. We avoid spamming bumpTask by accumulating distance here.
    if (fwd !== 0 || sd !== 0) {
      distanceAccum.current += speed * dt;
      while (distanceAccum.current >= 1) {
        distanceAccum.current -= 1;
        useGameStore.getState().bumpTask('walk-distance', 1);
      }
    }
    // Cheap clan-camp proximity check — every 0.5s
    if (Math.random() < dt * 2) {
      for (const clanId of Object.keys(CLANS)) {
        const c = CLANS[clanId as keyof typeof CLANS];
        const dx = pos.current.x - c.campCenter[0];
        const dz = pos.current.z - c.campCenter[2];
        if (dx * dx + dz * dz < 18 * 18 && lastClanVisited.current !== clanId) {
          lastClanVisited.current = clanId;
          useGameStore.getState().bumpTask('visit-clan', 1, (t) => t.target === clanId);
          break;
        }
      }
    }

    // Training post proximity in your own clan camp gives a small stamina
    // recharge ("you stretch your claws against the post"). Cheap check —
    // each clan camp has a post at offset (-3.5, -3) from its centre.
    {
      const myClan = CLANS[cat.clan];
      const px = myClan.campCenter[0] - 3.5;
      const pz = myClan.campCenter[2] - 3;
      const dx = pos.current.x - px;
      const dz = pos.current.z - pz;
      if (dx * dx + dz * dz < 2.4 * 2.4) {
        // Slowly bring stamina toward 100 while you linger
        useGameStore.getState().setHud({
          stamina: Math.min(100, hud.stamina + 12 * dt),
        });
      }
    }

    // Moonpool — at night a slow reputation drift toward 100 (the spirits
    // approve of cats who walk the silver path).
    {
      const dx = pos.current.x - (-220);
      const dz = pos.current.z - (-220);
      const tod = useGameStore.getState().room?.timeOfDay ?? 0.5;
      const isNight = tod < 0.22 || tod > 0.78;
      if (isNight && dx * dx + dz * dz < 5 * 5) {
        useGameStore.getState().setHud({
          reputation: Math.min(100, hud.reputation + 4 * dt),
        });
      }
    }

    // Clamp horizontal position to the playable disk so the cat can't wander
    // off the terrain plane.
    const maxR = 280;
    const r2 = pos.current.x * pos.current.x + pos.current.z * pos.current.z;
    if (r2 > maxR * maxR) {
      const r = Math.sqrt(r2);
      pos.current.x *= maxR / r;
      pos.current.z *= maxR / r;
    }

    // Ground = analytical terrain height under the cat's feet.
    const groundY = terrainHeightAt(pos.current.x, pos.current.z);

    // Jump physics with a 120ms coyote-frame grace window: if you tap jump
    // a moment AFTER walking off a ledge or after a tiny stamina hop, it
    // still fires. Makes platforming feel forgiving.
    const tNow = performance.now() / 1000;
    if (c.jump && (grounded.current || (tNow - lastGroundedAt.current) < 0.12)) {
      vy.current = 6.5;
      grounded.current = false;
      c.jump = false;
    }
    vy.current -= 18 * dt; // gravity
    pos.current.y += vy.current * dt;
    if (pos.current.y <= groundY) {
      pos.current.y = groundY;
      vy.current = 0;
      if (!grounded.current) lastGroundedAt.current = tNow;
      grounded.current = true;
    } else if (grounded.current) {
      // Just left the ground (e.g. walked off a ledge) — start the grace timer.
      lastGroundedAt.current = tNow;
      grounded.current = false;
    }

    let anim = 'idle';
    if (!grounded.current) anim = 'jump';
    else if (c.pounce) { anim = 'pounce'; c.pounce = false; }
    else if (c.crouch && (fwd !== 0 || sd !== 0)) anim = 'crouch';
    else if (c.crouch) anim = 'sit';
    else if (c.sprint && (fwd !== 0 || sd !== 0)) anim = 'run';
    else if (fwd !== 0 || sd !== 0) anim = 'walk';

    if (hud.hp < 30 && (fwd !== 0 || sd !== 0) && grounded.current) anim = 'limp';

    // stamina / hunger / HP attrition
    const draining = anim === 'run';
    const starving = hud.hunger <= 0;
    // When hunger hits zero, you slowly take damage. HP regenerates slowly
    // when you're well-fed and not running.
    const hpRegen = !starving && !draining && hud.hunger > 30 ? 1.0 : 0;
    const hpDrain = starving ? 1.5 : 0;
    setHud({
      stamina: Math.max(0, Math.min(100, hud.stamina + (draining ? -20 : 8) * dt)),
      hunger: Math.max(0, hud.hunger - 0.4 * dt),
      hp: Math.max(0, Math.min(100, hud.hp + (hpRegen - hpDrain) * dt)),
    });

    // Death — HP hit zero. Respawn back at the camp with a system message,
    // partial hunger restored. A real game would gate this behind StarClan
    // narration, but for now a quick respawn keeps the loop playable.
    if (hud.hp <= 0) {
      const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
      pos.current.set(cx, terrainHeightAt(cx, cz), cz);
      vy.current = 0;
      grounded.current = true;
      setHud({ hp: 60, hunger: 50, stamina: 60 });
      useGameStore.getState().pushChat({
        id: 'sys' + Date.now(),
        fromId: 'system',
        fromName: 'StarClan',
        scope: 'system',
        text: `${cat.name}'s spirit walks among the stars... but you are returned to your clan.`,
        at: Date.now(),
      });
    }

    // attempt to catch nearest prey when pouncing — pounce reach widened
    // from 1.4 → 2.4 so a well-aimed lunge actually lands. Crouching gives
    // a small extra reach bonus to reward stalking.
    if (anim === 'pounce') {
      const closest = preyList.current
        .filter((p) => p.alive)
        .map((p) => ({ p, d: p.pos.distanceTo(pos.current) }))
        .sort((a, b) => a.d - b.d)[0];
      const reach = c.crouch ? 2.8 : 2.4;
      if (closest && closest.d < reach) {
        closest.p.alive = false;
        onCatch(closest.p.id, closest.p.kind);
        if (!carrying) setCarrying(closest.p.kind);
        // Tasks: any catch, kind-specific, and the no-miss streak.
        const store = useGameStore.getState();
        store.bumpTask('catch-any-n', 1);
        if (closest.p.kind === 'mouse') store.bumpTask('catch-mouse-n', 1);
        if (closest.p.kind === 'fish') store.bumpTask('catch-fish-n', 1);
        store.bumpTask('pounce-streak', 1);
      } else {
        // Missed — give the player audible + chat feedback so the pounce
        // doesn't feel like the input vanished. Throttle to once per second
        // so a held button doesn't spam.
        const nowS = performance.now() / 1000;
        if (nowS - lastPounceMissAt.current > 1.0) {
          lastPounceMissAt.current = nowS;
          try { getAudioEngine().playStinger('miss'); } catch {}
          // Reset the no-miss streak by replacing each in-progress streak
          // task — bumpTask with a -progress is awkward so we just nudge the
          // task system to reset by setting progress to 0 via a fresh roll.
          const cur = useGameStore.getState();
          const reset = cur.tasks.map((t) =>
            t.kind === 'pounce-streak' ? { ...t, progress: 0 } : t
          );
          (useGameStore as any).setState({ tasks: reset });
          cur.pushChat({
            id: 'sys' + Date.now(),
            fromId: 'system',
            fromName: 'StarClan',
            scope: 'system',
            text: 'Missed! Sneak closer next time.',
            at: Date.now(),
          });
        }
      }
    }

    // Update the highlight target every ~0.2s — the prey closest to the
    // cat that is actually within a comfortable pounce range. Throttled so
    // we don't spam re-renders of the prey list.
    const tgtNow = performance.now();
    if (tgtNow - (lastTargetAt.current ?? 0) > 200) {
      lastTargetAt.current = tgtNow;
      let bestId: string | null = null;
      let bestD = Infinity;
      const reach = c.crouch ? 3.4 : 3.0;
      for (const p of preyList.current) {
        if (!p.alive) continue;
        const d = p.pos.distanceTo(pos.current);
        if (d < reach && d < bestD) { bestD = d; bestId = p.id; }
      }
      const cur = useGameStore.getState().targetPreyId;
      if (cur !== bestId) useGameStore.getState().setTargetPreyId(bestId);
    }

    // Cat body rotation: only follow the movement direction, NOT the camera.
    // The camera yaw is just for looking around. The cat keeps its own facing
    // and turns smoothly when you actually walk somewhere new.
    //
    // The cat geometry's natural forward is local +X (head at +X, tail at -X).
    // To rotate the body so its +X axis points along (dir.x, 0, dir.z) we need
    // R_Y(θ)·(1,0,0) = (cos θ, 0, -sin θ) = (dir.x, 0, dir.z), i.e.
    // θ = atan2(-dir.z, dir.x). The previous atan2(dir.x, dir.z) assumed +Z
    // forward, which made the cat appear to walk sideways and "forward" feel
    // broken.
    if (fwd !== 0 || sd !== 0) {
      const moveYaw = Math.atan2(-dir.z, dir.x);
      // shortest-path lerp
      let delta = moveYaw - catYaw.current;
      while (delta >  Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      // Faster turn so the cat's body doesn't visibly lag behind the input.
      const turnRate = c.sprint ? 16 : 10;
      catYaw.current += delta * Math.min(1, dt * turnRate);
    }

    if (selfRef.current) {
      selfRef.current.position.copy(pos.current);
      selfRef.current.rotation.y = catYaw.current;
    }

    if (anim !== lastAnim.current) {
      lastAnim.current = anim;
      onAnim(anim);
    }

    const now = performance.now();
    if (now - lastSent.current > 80) {
      lastSent.current = now;
      onPos([pos.current.x, pos.current.y, pos.current.z], catYaw.current);
    }
  });

  return null;
}

// Remote players send a position roughly every 80ms via Socket.io or
// BroadcastChannel. Setting `<group position={p.pos}>` directly only updates
// when React re-renders, which is fine but produces visibly choppy movement
// at 12fps. RemoteCat wraps each remote player and runs a per-frame lerp
// toward the latest target position/rotation so movement looks smooth even
// though the network stream is sparse.
function RemoteCat({ player, bubble, viewerRef }: { player: PlayerState; bubble?: string; viewerRef: React.MutableRefObject<THREE.Object3D | null> }) {
  const ref = useRef<THREE.Group>(null);
  const target = useRef({
    pos: new THREE.Vector3(player.pos[0], player.pos[1], player.pos[2]),
    rot: player.rot,
  });
  target.current.pos.set(player.pos[0], player.pos[1], player.pos[2]);
  target.current.rot = player.rot;

  // Distance-based culling for HTML overlays — beyond ~60 forest units the
  // text is unreadable anyway, and rendering DOM nodes for distant players
  // hurts perf for nothing visible.
  const [overlayVisible, setOverlayVisible] = useState(true);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = Math.min(1, dt * 14);
    g.position.lerp(target.current.pos, a);
    let delta = target.current.rot - g.rotation.y;
    while (delta >  Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    g.rotation.y += delta * a;

    const me = viewerRef.current?.position;
    if (me) {
      const dx = g.position.x - me.x;
      const dz = g.position.z - me.z;
      const close = (dx * dx + dz * dz) < (60 * 60);
      if (close !== overlayVisible) setOverlayVisible(close);
    }
  });

  return (
    <group
      ref={ref}
      position={[player.pos[0], player.pos[1], player.pos[2]]}
      rotation={[0, player.rot, 0]}
    >
      <Cat cat={player.cat} anim={player.anim as any} />
      {overlayVisible && (
        <NameTag name={player.cat.name} role={player.cat.role} isLeader={player.isLeader} isDeputy={player.isDeputy} />
      )}
      {overlayVisible && bubble && <RemoteBubble text={bubble} />}
    </group>
  );
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

function PreyList({
  preyList,
  selfRef,
  netSendCatch,
}: {
  preyList: React.MutableRefObject<PreyState[]>;
  selfRef: React.MutableRefObject<THREE.Object3D | null>;
  netSendCatch: (id: string, kind: string) => void;
}) {
  const targetId = useGameStore((s) => s.targetPreyId);
  // We re-render rarely (only when target changes), so the cost is low and
  // we get a clean reactive highlight without polling per frame in JSX.
  return (
    <>
      {preyList.current.map((p) => (
        <PreyMesh
          key={p.id}
          state={p}
          threat={selfRef.current ? selfRef.current.position : null}
          highlight={targetId === p.id}
          onCaught={(id) => {
            const found = preyList.current.find((x) => x.id === id);
            if (found) netSendCatch(id, found.kind);
            const cur = useGameStore.getState();
            cur.setHud({ hunger: Math.min(100, cur.hud.hunger + 18) });
            cur.pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: `You caught a ${found?.kind ?? 'prey'}.`, at: Date.now() });
          }}
        />
      ))}
    </>
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
  const catYaw = useRef(0); // cat body facing — independent of the camera yaw
  const [anim, setAnim] = useState<string>('idle');
  const preyList = useRef<PreyState[]>(spawnPrey(60));

  // Wait ~400ms after mount before creating the Canvas so the editor's
  // previous WebGL context has time to be torn down by the browser. iPad
  // Safari can otherwise refuse to allocate a second GL context if the
  // first one is still pending release.
  const [canvasReady, setCanvasReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setCanvasReady(true), 400);
    return () => clearTimeout(id);
  }, []);

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

  // Audio mode selection — drives crickets at night, dramatic music while
  // hunting (crouch/pounce), battle bed when other cats are very close, and
  // a calm day pad otherwise.
  useEffect(() => {
    const engine = getAudioEngine();
    engine.setVolume(settings.sound);
    engine.setMuted(settings.sound <= 0.001);
  }, [settings.sound]);

  useEffect(() => {
    if (!roomState || !cat) return;
    const engine = getAudioEngine();
    const tick = () => {
      const tod = roomState.timeOfDay;
      const isNight = tod < 0.22 || tod > 0.78;
      const here = selfRef.current?.position;
      let nearbyCat = false;
      if (here) {
        for (const p of Object.values(useGameStore.getState().players)) {
          if (p.socketId === useGameStore.getState().selfId) continue;
          const dx = p.pos[0] - here.x, dz = p.pos[2] - here.z;
          if (dx * dx + dz * dz < 36) { nearbyCat = true; break; }
        }
      }
      let mode: 'day' | 'night' | 'hunt' | 'battle' = isNight ? 'night' : 'day';
      if (anim === 'crouch' || anim === 'pounce') mode = 'hunt';
      if (nearbyCat && (anim === 'pounce' || anim === 'run')) mode = 'battle';
      engine.setMode(mode);
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [roomState, cat, anim]);

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

  if (!cat || !roomState || !canvasReady) {
    return (
      <div className="absolute inset-0 grid place-items-center text-bone">
        <div className="text-center font-display text-2xl animate-pulse-soft">Slipping into the forest...</div>
      </div>
    );
  }

  // Higher DPR caps so high-DPI displays (iPad / retina laptops) actually
  // render at native resolution and stop looking pixelated. Capped at 2 to
  // keep the GPU budget reasonable.
  const dpr: [number, number] = settings.graphics === 'low' ? [1, 1.25] : settings.graphics === 'medium' ? [1, 1.6] : [1, 2];
  // Shadows only on the highest graphics setting. On medium/low (and on iPad
  // Safari especially) requesting shadow framebuffers can crash WebGL context
  // creation, leaving an empty black canvas.
  const shadows = settings.graphics === 'high';

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      camera={{ fov: 60, near: 0.1, far: 600, position: [0, 6, 8] }}
      gl={{
        antialias: settings.graphics !== 'low',
        powerPreference: settings.graphics === 'high' ? 'high-performance' : 'default',
        failIfMajorPerformanceCaveat: false,
        alpha: false,
        preserveDrawingBuffer: false,
      }}
      onCreated={({ gl }) => {
        try { gl.setClearColor(new THREE.Color('#7ec8e3')); } catch {}
        // Crisper, more cinematic look. sRGB output makes colours match
        // their source values; ACES tone mapping gives a soft filmic curve
        // instead of a harsh linear clamp on bright pixels.
        try {
          (gl as any).outputColorSpace = (THREE as any).SRGBColorSpace ?? 'srgb';
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        } catch {}
      }}
      onPointerDown={() => {
        // iOS Safari only starts AudioContext from a user gesture
        try { getAudioEngine().ensure(); } catch {}
      }}
    >
      <Suspense fallback={null}>
        <SilentErrorBoundary label="world">
          <World
            timeOfDay={roomState.timeOfDay}
            weather={roomState.weather}
            season={roomState.season}
            graphics={settings.graphics}
          />
        </SilentErrorBoundary>

        {/* self */}
        <SilentErrorBoundary label="self">
          <group ref={selfRef as any}>
            <Cat cat={cat} anim={anim as any} carrying={useGameStore.getState().carrying} />
            {bubbles.get(selfId) && <RemoteBubble text={bubbles.get(selfId)!} />}
          </group>
        </SilentErrorBoundary>

        {/* others */}
        <SilentErrorBoundary label="others">
          {Object.values(players).map((p) => {
            if (p.socketId === selfId) return null;
            return (
              <RemoteCat key={p.socketId} player={p} bubble={bubbles.get(p.socketId)} viewerRef={selfRef} />
            );
          })}
        </SilentErrorBoundary>

        {/* prey */}
        <SilentErrorBoundary label="prey">
          <PreyList preyList={preyList} selfRef={selfRef} netSendCatch={net.sendCatch} />
        </SilentErrorBoundary>

        <CameraRig target={selfRef as any} yaw={yaw} pitch={pitch} mode={settings.cameraMode} />
        <PlayerController
          selfRef={selfRef as any}
          catYaw={catYaw}
          yaw={yaw}
          pitch={pitch}
          preyList={preyList}
          onAnim={(a) => {
            setAnim(a);
            net.sendMove(
              selfRef.current ? [selfRef.current.position.x, selfRef.current.position.y, selfRef.current.position.z] : [0, 0, 0],
              catYaw.current,
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
