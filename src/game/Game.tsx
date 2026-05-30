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
import { terrainHeightAt, resolveBlockers, LAKE, CLIMBABLE_TREES } from './terrain';
import { nearestMonsterDistance, MONSTER_KILL_RADIUS, MONSTER_WARN_RADIUS } from './vehicles';
import { getAudioEngine } from './audio';
import { Npcs } from './Npcs';
import { NPCS } from '@/lib/npcs';
import { Raids } from './Raids';

export interface GameNetHandle {
  sendMove: (pos: [number, number, number], rot: number, anim: string) => void;
  sendCatch: (preyId: string, kind: string) => void;
}

interface GameProps {
  room: string;
  net: GameNetHandle;
}

// Shared post-victory rewards — Firestar's gift of fresh-kill, full
// stats, and a celebratory chat line.
function grantTigerstarVictory() {
  const s = useGameStore.getState();
  s.bumpTask('defeat-tigerstar', 1);
  s.pushChat({
    id: 'fs' + Date.now(),
    fromId: 'system',
    fromName: 'Firestar',
    scope: 'system',
    text: "Well done, young warrior! As a prize for doing this, I'll give you some fresh-kill — eat well, and rest tonight.",
    at: Date.now(),
  });
  // Drop a piece of fresh-kill into the player's carrying slot if it's
  // free, otherwise just credit hunger directly.
  if (!s.carrying) s.setCarrying('rabbit');
  s.setHud({
    hp: 100,
    stamina: 100,
    hunger: Math.min(100, s.hud.hunger + 35),
    reputation: Math.min(100, s.hud.reputation + 25),
  });
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
  // When Tigerstar last bit / clawed the player on his own. Used to give
  // him an autonomous attack rhythm during the fight.
  const lastTigerAttackAt = useRef(0);
  // True while the cat is currently overlapping a monster — used to make
  // the shake fire ONCE per contact instead of every single frame.
  const lastMonsterContactHit = useRef(false);
  // Tree-climbing state. While `climbing` is true the cat is perched
  // ~3 units above the trunk it was standing next to. Pressing E while
  // climbing drops back down; pressing E near a tree starts a climb.
  const climbing = useRef(false);
  const climbTreeRef = useRef<{ x: number; z: number } | null>(null);
  // Reusable list of climbable tree trunks (seeded once on mount). We
  // pre-compute them so the E handler can find the closest one fast.
  const treeTrunksRef = useRef<Array<{ x: number; z: number }>>([]);

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
    if (useGameStore.getState().paused) return; // hard pause
    const c = controlsRef.current;
    yaw.current += c.yaw; c.yaw = 0;
    pitch.current += c.pitch; c.pitch = 0;
    pitch.current = Math.max(-0.8, Math.min(0.8, pitch.current));

    if (c.toggleCamera) {
      c.toggleCamera = false;
      useGameStore.getState().setSettings({ cameraMode: settings.cameraMode === 'first' ? 'third' : 'first' });
    }

    // E (interact) — at the moment the only interaction is "eat from the
    // fresh-kill pile", which fires when E is pressed within ~3 units of
    // the player's own clan camp pile. The same pile shows a tappable
    // button on touch devices via FreshKillPile.
    // Window-level helper so HUD buttons can trigger the same interact
    // path as pressing E (used by the touchscreen "Climb tree" button).
    try { (window as any).__WOTC_INTERACT__ = () => { c.interact = true; }; } catch {}
    if (c.interact) {
      c.interact = false;
      const myClan = CLANS[cat.clan];
      const px = myClan ? myClan.campCenter[0] : 0;
      const pz = myClan ? myClan.campCenter[2] + 2 : 0;
      const dx = pos.current.x - px;
      const dz = pos.current.z - pz;
      const atPile = myClan && dx * dx + dz * dz < 3 * 3;
      // Tree climbing — toggle. E near a climbable tree starts a climb;
      // E again drops back down. Beats eating priority because climbing
      // is a deliberate "I want to escape that monster" action.
      if (climbing.current) {
        climbing.current = false;
        climbTreeRef.current = null;
      } else {
        let closest: { x: number; z: number; d: number } | null = null;
        for (const t of CLIMBABLE_TREES) {
          const tdx = pos.current.x - t.x;
          const tdz = pos.current.z - t.z;
          const d2 = tdx * tdx + tdz * tdz;
          if (d2 < 5 * 5 && (!closest || d2 < closest.d)) {
            closest = { x: t.x, z: t.z, d: d2 };
          }
        }
        if (closest) {
          climbing.current = true;
          climbTreeRef.current = { x: closest.x, z: closest.z };
        } else if (atPile) {
          eatFromPile();
        } else if (useGameStore.getState().carrying) {
          eatCarried();
        }
      }
    }


    const stats = SIZE_STATS[cat.size];
    const clanBonus = (CLANS[cat.clan].bonuses.speed ?? 1) as number;
    const base = 6 * stats.speed * clanBonus;
    // Swimming — when the cat is inside the lake basin (excluding the
    // small Gathering island in the middle), movement slows to roughly
    // half. This is the closest thing to a "swim" state the procedural
    // cat rig has today; the visual is a slow wade rather than a stroke
    // animation, but it reads clearly as "in the water".
    const lakeDx = pos.current.x - LAKE.x;
    const lakeDz = pos.current.z - LAKE.z;
    const lakeDist2 = lakeDx * lakeDx + lakeDz * lakeDz;
    const inLake = lakeDist2 < (LAKE.r - 1) * (LAKE.r - 1) && lakeDist2 > LAKE.islandR * LAKE.islandR;
    // Crouch is a deliberate slow stalk — slower than before so the
    // player can creep up on prey instead of zipping past them.
    const speed = (c.sprint ? base * 1.7 : base) * (c.crouch ? 0.32 : 1) * (hud.stamina < 5 ? 0.5 : 1) * (inLake ? 0.45 : 1);
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

    // Solid-object collision — push the cat out of buildings / big trunks
    // / rock piles. Cheap radial resolution (see resolveBlockers).
    {
      const [nx, nz] = resolveBlockers(pos.current.x, pos.current.z);
      pos.current.x = nx;
      pos.current.z = nz;
    }

    // Twoleg monster (vehicle) collision on the Thunderpath. The big
    // metal monsters do not slow down for warriors — touching one is an
    // instant kill. We trigger the WASTED cutscene directly here so the
    // same-frame HP-regen path can't accidentally restore HP back to
    // ~100 (which was happening when we only wrote hp = 0 and relied
    // on the death check below to fire on the next frame).
    {
      const now = Date.now();
      const { distance } = nearestMonsterDistance(pos.current.x, pos.current.z, now);
      if (distance < MONSTER_KILL_RADIUS) {
        const s = useGameStore.getState();
        if (!lastMonsterContactHit.current && !s.cutscene) {
          s.setCameraShake(0.8);
          s.pushChat({
            id: 'sys' + Date.now(),
            fromId: 'system',
            fromName: 'StarClan',
            scope: 'system',
            text: 'A monster strikes! Your bones are crushed beneath its wheels.',
            at: Date.now(),
          });
          s.setHud({ hp: 0 });
          s.setCutscene({ kind: 'wasted', startedAt: Date.now() });
          lastMonsterContactHit.current = true;
        }
      } else if (distance > MONSTER_KILL_RADIUS + 0.6) {
        lastMonsterContactHit.current = false;
      }
    }

    // Tasks — track total distance walked (in 1-unit chunks) and clan camp
    // visits. We avoid spamming bumpTask by accumulating distance here.
    if (fwd !== 0 || sd !== 0) {
      distanceAccum.current += speed * dt;
      while (distanceAccum.current >= 1) {
        distanceAccum.current -= 1;
        useGameStore.getState().bumpTask('walk-distance', 1);
        if (c.sprint) useGameStore.getState().bumpTask('sprint-distance', 1);
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
        useGameStore.getState().bumpTask('visit-moonpool', 1);
      }
    }

    // Standing on your own High Rock — counts for both the simple
    // climb-rock task and the harder "stand ON TOP" task that requires
    // the player's actual Y to be near the rock's surface.
    {
      const myClan = CLANS[cat.clan];
      if (myClan) {
        const rx = myClan.campCenter[0];
        const rz = myClan.campCenter[2] - 7;
        const dx = pos.current.x - rx;
        const dz = pos.current.z - rz;
        if (dx * dx + dz * dz < 2 * 2) {
          useGameStore.getState().bumpTask('climb-rock', 1);
          if (pos.current.y > 1.5) {
            useGameStore.getState().bumpTask('top-of-rock', 1);
          }
        }
        // Distance from camp counts for the wander-far task.
        const cdx = pos.current.x - myClan.campCenter[0];
        const cdz = pos.current.z - myClan.campCenter[2];
        const distFromCamp = Math.hypot(cdx, cdz);
        if (distFromCamp > 30 && Math.random() < dt * 4) {
          useGameStore.getState().bumpTask('distance-from-camp', Math.round(distFromCamp));
        }
      }
      // Walking along the river bank — within ~22 of x=180 in the +Z half.
      if (Math.abs(pos.current.x - 180) < 22 && Math.random() < dt * 2) {
        useGameStore.getState().bumpTask('walk-on-river-bank', 1);
      }
      // Twoleg place — group at world (260, 240) within 12u.
      const txl = pos.current.x - 260;
      const tzl = pos.current.z - 240;
      if (txl * txl + tzl * tzl < 12 * 12 && Math.random() < dt * 2) {
        useGameStore.getState().bumpTask('visit-twoleg', 1);
      }
    }

    // Stalking time accumulator — credits 1 every second of crouch.
    if (c.crouch) {
      const stalkAccum = (state: any) => {};
      // Use a ref-free counter on the controlsRef shape — accumulate
      // milliseconds via dt and bump the task every full second.
      if (typeof (c as any).__stalkAccum !== 'number') (c as any).__stalkAccum = 0;
      (c as any).__stalkAccum += dt;
      while ((c as any).__stalkAccum >= 1) {
        (c as any).__stalkAccum -= 1;
        useGameStore.getState().bumpTask('time-crouched', 1);
      }
    }

    // Reputation milestones — when current reputation reaches the task's
    // goal, complete it instantly by bumping a large amount (capped at goal).
    if (Math.random() < dt * 2) {
      const rep = useGameStore.getState().hud.reputation;
      useGameStore.getState().bumpTask('reach-rep', 999, (t) => rep >= t.goal && t.progress < t.goal);
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
      useGameStore.getState().bumpTask('jump-n', 1);
    }
    if (climbing.current && climbTreeRef.current) {
      // Perched on a tree — snap to the trunk, lifted ~3.6 units above
      // the ground. Movement is ignored; pressing E again drops you.
      pos.current.x = climbTreeRef.current.x;
      pos.current.z = climbTreeRef.current.z;
      pos.current.y = terrainHeightAt(climbTreeRef.current.x, climbTreeRef.current.z) + 3.6;
      vy.current = 0;
    } else if (grounded.current) {
      // Pin the cat to the analytical terrain when walking — no gravity,
      // no per-frame Y micro-dip / snap-back. This kills the "everything
      // shakes when I walk" feel that gravity-then-clamp was producing.
      pos.current.y = groundY;
      vy.current = 0;
    } else {
      vy.current -= 18 * dt;
      pos.current.y += vy.current * dt;
      if (pos.current.y <= groundY) {
        pos.current.y = groundY;
        vy.current = 0;
        lastGroundedAt.current = tNow;
        grounded.current = true;
      }
    }

    let anim = 'idle';
    // Sleep cutscene overrides every other animation choice — the cat
    // sits (loaf), eyelids droop in 'doze' (curl & waking), eyes fully
    // close in 'sleep' (deep).
    const sleepStage = useGameStore.getState().sleepStage;
    if (sleepStage === 'loaf') anim = 'sit';
    else if (sleepStage === 'curl' || sleepStage === 'waking') anim = 'doze';
    else if (sleepStage === 'deep') anim = 'sleep';
    else if (!grounded.current) anim = 'jump';
    else if (c.pounce) { anim = 'pounce'; c.pounce = false; }
    else if (c.crouch && (fwd !== 0 || sd !== 0)) anim = 'crouch';
    else if (c.crouch) anim = 'sit';
    else if (c.sprint && (fwd !== 0 || sd !== 0)) anim = 'run';
    else if (fwd !== 0 || sd !== 0) anim = 'walk';

    if (hud.hp < 30 && (fwd !== 0 || sd !== 0) && grounded.current) anim = 'limp';

    // Override movement anim with 'swim' when the cat is in the lake.
    // Swim animation lowers the body so the cat reads as submerged.
    if (inLake && grounded.current && sleepStage === 'idle') {
      anim = 'swim';
    }
    // Override with 'climb' when the player is currently clinging to a
    // tree. The climbing state is set/cleared by the E key handler.
    if (climbing.current) {
      anim = 'climb';
    }

    // stamina / hunger / HP attrition
    const draining = anim === 'run';
    const starving = hud.hunger <= 0;
    const sick = useGameStore.getState().sick;
    // Drowning — once the cat is deep enough in the lake basin (close
    // to its centre, away from the island) the water is over its head
    // and HP drains fast. Wading near the bank is still safe.
    const lakeDist = Math.sqrt(lakeDist2);
    const drowning = inLake && lakeDist < LAKE.r * 0.45;
    // HP regenerates slowly when fed and not running; drains on starve,
    // on sickness, and rapidly while drowning.
    const hpRegen = !starving && !sick && !drowning && !draining && hud.hunger > 30 ? 1.0 : 0;
    const hpDrain = (starving ? 1.5 : 0) + (sick ? 0.6 : 0) + (drowning ? 14 : 0);
    setHud({
      stamina: Math.max(0, Math.min(100, hud.stamina + (draining ? -20 : 8) * dt)),
      hunger: Math.max(0, hud.hunger - 0.06 * dt),
      hp: Math.max(0, Math.min(100, hud.hp + (hpRegen - hpDrain) * dt)),
    });
    // Rare chance to fall sick. Roughly once every 20 minutes of
    // active play. Sickness only ticks while not already sick and not
    // already in a cutscene. Cured by using a herb (see HUD).
    if (!sick && !useGameStore.getState().cutscene && Math.random() < dt * (1 / 1200)) {
      useGameStore.getState().setSick(true);
      useGameStore.getState().pushChat({
        id: 'sys' + Date.now(),
        fromId: 'system',
        fromName: 'StarClan',
        scope: 'system',
        text: 'A chill creeps into your bones — you have fallen sick. Find a herb to cure it.',
        at: Date.now(),
      });
    }

    // Death — HP hit zero. Trigger the WASTED cutscene (which then rolls
    // into the StarClan walk and respawns the cat at camp). The cutscene
    // overlay handles the actual respawn via __WOTC_RESPAWN__.
    if (hud.hp <= 0) {
      const dStore = useGameStore.getState();
      if (dStore.battleActive) {
        // Defeat path during the Tigerstar fight — keep mission='accepted'
        // so the player can come back and try again.
        dStore.setBattlePhase('defeat');
        dStore.pushChat({
          id: 'sys' + Date.now(),
          fromId: 'system',
          fromName: 'Firestar',
          scope: 'system',
          text: 'You are in StarClan\'s hands now, brave one.',
          at: Date.now(),
        });
        setTimeout(() => {
          const s = useGameStore.getState();
          s.setBattleActive(false);
          s.setBattlePhase('idle');
          s.setTigerstarHp(100);
          s.setHud({ hp: 70, stamina: 70, hunger: 50 });
        }, 3000);
      } else if (!dStore.cutscene) {
        // Normal HP-zero death — show WASTED, then walk in StarClan, then
        // respawn. Set HP to 1 immediately so we don't re-trigger every
        // frame while the cutscene plays.
        dStore.setHud({ hp: 1 });
        dStore.setCutscene({ kind: 'wasted', startedAt: Date.now() });
      }
    }

    // Honour respawn requests from cutscene overlays — the WASTED /
    // kidnap flows poke a global with the target XZ once they finish.
    {
      const req = (window as any).__WOTC_RESPAWN__;
      if (req && typeof req.x === 'number' && typeof req.z === 'number') {
        pos.current.set(req.x, terrainHeightAt(req.x, req.z), req.z);
        vy.current = 0;
        grounded.current = true;
        try { delete (window as any).__WOTC_RESPAWN__; } catch {}
      }
    }

    // While the battle is active and the player is close, Tigerstar bites
    // and claws on his own roughly every 1.6 seconds. Drains player HP and
    // shakes the camera. Independent of whether the player attacks.
    {
      const sNow = performance.now() / 1000;
      const sStore = useGameStore.getState();
      if (sStore.battleActive && sStore.battlePhase === 'fighting') {
        const tx = NPCS.tigerstar.pos[0], tz = NPCS.tigerstar.pos[2];
        const tdx = pos.current.x - tx;
        const tdz = pos.current.z - tz;
        if (tdx * tdx + tdz * tdz < 4.5 * 4.5 && sNow - lastTigerAttackAt.current > 1.6) {
          lastTigerAttackAt.current = sNow;
          sStore.setHud({ hp: Math.max(0, hud.hp - 7) });
          sStore.setCameraShake(0.5);
          sStore.triggerSwipeFx('bite');
          sStore.pushChat({
            id: 'sys' + Date.now(),
            fromId: 'system',
            fromName: 'Tigerstar',
            scope: 'system',
            text: 'Tigerstar bites you!',
            at: Date.now(),
          });
        }
      }
    }

    // F (swipe) — fast claw attack. Less damage than pounce but no
    // wind-up, and only meaningful while a battle is active OR a raid
    // is in progress.
    if (c.attack) {
      c.attack = false;
      const sStore = useGameStore.getState();
      // First, raiders — if any raider is in melee range, hit the closest.
      if (sStore.raid) {
        const here = pos.current;
        let bestId: string | null = null;
        let bestD = 3.0 * 3.0;
        for (const r of sStore.raid.raiders) {
          if (!r.alive) continue;
          const ddx = here.x - r.x, ddz = here.z - r.z;
          const dsq = ddx * ddx + ddz * ddz;
          if (dsq < bestD) { bestD = dsq; bestId = r.id; }
        }
        if (bestId) {
          const target = sStore.raid.raiders.find((r) => r.id === bestId)!;
          const nextHp = Math.max(0, target.hp - 14);
          const alive = nextHp > 0;
          sStore.updateRaider(bestId, { hp: nextHp, alive });
          sStore.setCameraShake(0.4);
          sStore.triggerSwipeFx('swipe');
          if (!alive) {
            sStore.bumpTask('defeat-raider-n', 1);
            sStore.pushChat({
              id: 'rd' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
              text: 'You strike down a raider!', at: Date.now(),
            });
            const aliveLeft = sStore.raid.raiders.some((r) => r.id !== bestId && r.alive);
            if (!aliveLeft) {
              sStore.pushChat({
                id: 'rd' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
                text: 'The raiders are routed! Your camp holds.', at: Date.now(),
              });
              sStore.bumpTask('defend-camp', 1);
              sStore.bumpTask('survive-raid', 1);
              sStore.setRaid(null);
            }
          }
          return; // skip the Tigerstar branch this attack
        }
      }
      if (sStore.battleActive && sStore.battlePhase === 'fighting') {
        const tx = NPCS.tigerstar.pos[0], tz = NPCS.tigerstar.pos[2];
        const tdx = pos.current.x - tx;
        const tdz = pos.current.z - tz;
        if (tdx * tdx + tdz * tdz < 3.0 * 3.0) {
          const next = Math.max(0, sStore.tigerstarHp - 10);
          sStore.setTigerstarHp(next);
          sStore.setHud({ hp: Math.max(0, hud.hp - 4) });
          sStore.setCameraShake(0.45);
          sStore.triggerSwipeFx('swipe');
          try { getAudioEngine().playStinger('miss'); } catch {}
          if (next <= 0) {
            sStore.setMission('won');
            sStore.setNpcDialogId(null);
            sStore.setBattlePhase('victory');
            setTimeout(() => {
              const s = useGameStore.getState();
              s.setBattleActive(false);
              s.setBattlePhase('idle');
            }, 2500);
            sStore.pushChat({
              id: 'sys' + Date.now(),
              fromId: 'system',
              fromName: 'StarClan',
              scope: 'system',
              text: 'Your final swipe finds his throat. Tigerstar collapses — the forest exhales.',
              at: Date.now(),
            });
            grantTigerstarVictory();
          } else {
            sStore.pushChat({
              id: 'sys' + Date.now(),
              fromId: 'system',
              fromName: 'StarClan',
              scope: 'system',
              text: `You swipe Tigerstar! (${next}/100 hp left)`,
              at: Date.now(),
            });
          }
        }
      }
    }

    // attempt to catch nearest prey when pouncing — pounce reach widened
    // from 1.4 → 2.4 so a well-aimed lunge actually lands. Crouching gives
    // a small extra reach bonus to reward stalking.
    if (anim === 'pounce') {
      const store = useGameStore.getState();
      // First, raiders — a pounce kills almost any single raider in one hit.
      if (store.raid) {
        const here = pos.current;
        let bestId: string | null = null;
        let bestD = 4.5 * 4.5;
        for (const r of store.raid.raiders) {
          if (!r.alive) continue;
          const ddx = here.x - r.x, ddz = here.z - r.z;
          const dsq = ddx * ddx + ddz * ddz;
          if (dsq < bestD) { bestD = dsq; bestId = r.id; }
        }
        if (bestId) {
          const target = store.raid.raiders.find((r) => r.id === bestId)!;
          const nextHp = Math.max(0, target.hp - 28);
          const alive = nextHp > 0;
          store.updateRaider(bestId, { hp: nextHp, alive });
          store.setHud({ hp: Math.max(0, hud.hp - 6) });
          store.setCameraShake(0.55);
          store.triggerSwipeFx('pounce');
          if (!alive) {
            store.bumpTask('defeat-raider-n', 1);
            const aliveLeft = store.raid.raiders.some((r) => r.id !== bestId && r.alive);
            if (!aliveLeft) {
              store.pushChat({ id: 'rd' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
                text: 'The raiders are routed! Your camp holds.', at: Date.now() });
              store.bumpTask('defend-camp', 1);
              store.bumpTask('survive-raid', 1);
              store.setRaid(null);
            } else {
              store.pushChat({ id: 'rd' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
                text: 'You strike down a raider!', at: Date.now() });
            }
          }
          return; // skip the Tigerstar / prey branches this pounce
        }
      }
      // Tigerstar fight — if the battle is active and the player pounces
      // within reach of Tigerstar, do damage. Each hit drops his HP by 18.
      if (store.battleActive) {
        const tx = NPCS.tigerstar.pos[0], tz = NPCS.tigerstar.pos[2];
        const tdx = pos.current.x - tx;
        const tdz = pos.current.z - tz;
        if (tdx * tdx + tdz * tdz < 3.5 * 3.5) {
          const next = Math.max(0, store.tigerstarHp - 18);
          store.setTigerstarHp(next);
          // Tigerstar bites back — the player loses some HP too.
          store.setHud({ hp: Math.max(0, hud.hp - 8) });
          store.setCameraShake(0.6);
          store.triggerSwipeFx('pounce');
          if (next <= 0) {
            store.setMission('won');
            store.setNpcDialogId(null);
            store.setBattlePhase('victory');
            store.setCameraShake(0.8);
            // Hold the victory banner for 2.5s, then exit battle mode.
            setTimeout(() => {
              const s = useGameStore.getState();
              s.setBattleActive(false);
              s.setBattlePhase('idle');
            }, 2500);
            store.pushChat({
              id: 'sys' + Date.now(),
              fromId: 'system',
              fromName: 'StarClan',
              scope: 'system',
              text: 'Tigerstar collapses. The forest exhales — your name will be sung in every clan.',
              at: Date.now(),
            });
            grantTigerstarVictory();
          } else {
            store.pushChat({
              id: 'sys' + Date.now(),
              fromId: 'system',
              fromName: 'StarClan',
              scope: 'system',
              text: `You strike Tigerstar! (${next}/100 hp left)`,
              at: Date.now(),
            });
          }
          return; // skip the prey branch this frame
        }
      }
      const closest = preyList.current
        .filter((p) => p.alive)
        .map((p) => ({ p, d: p.pos.distanceTo(pos.current) }))
        .sort((a, b) => a.d - b.d)[0];
      // Pounce reach is generous now — 4.0 stand, 5.0 crouch — so casual
      // taps catch prey without pixel-perfect positioning.
      const reach = c.crouch ? 5.0 : 4.0;
      if (closest && closest.d < reach) {
        closest.p.alive = false;
        onCatch(closest.p.id, closest.p.kind);
        if (!carrying) setCarrying(closest.p.kind);
        // Tasks: any catch, kind-specific, and the no-miss streak.
        const store = useGameStore.getState();
        store.bumpTask('catch-any-n', 1);
        const k = closest.p.kind;
        if (k === 'mouse') store.bumpTask('catch-mouse-n', 1);
        if (k === 'fish') store.bumpTask('catch-fish-n', 1);
        if (k === 'rabbit') store.bumpTask('catch-rabbit-n', 1);
        if (k === 'vole') store.bumpTask('catch-vole-n', 1);
        if (k === 'squirrel') store.bumpTask('catch-squirrel-n', 1);
        if (k === 'frog') store.bumpTask('catch-frog-n', 1);
        if (k === 'bird' || k === 'sparrow' || k === 'blackbird') store.bumpTask('catch-bird-n', 1);
        store.bumpTask('pounce-streak', 1);
        store.bumpTask('win-pounce-streak', 1);
        store.bumpTask('pick-up-prey', 1);
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
            (t.kind === 'pounce-streak' || t.kind === 'win-pounce-streak') ? { ...t, progress: 0 } : t
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
      // Highlight ring should match the actual pounce reach so the
      // player sees what they'll hit.
      const reach = c.crouch ? 5.5 : 4.4;
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
// Floating "Eat" button anchored above the player's own clan fresh-kill
// pile. Visible only when the player is within ~3 units of the pile. Tap
// it on mobile (or press E on a keyboard — wired in PlayerController) to
// eat a piece of prey: hunger goes up, a system chat fires, and a small
// throttle prevents spam.
function FreshKillPile({ viewerRef }: { viewerRef: React.MutableRefObject<THREE.Object3D | null> }) {
  const cat = useGameStore((s) => s.cat);
  const ref = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);

  // Each clan's pile sits at camp.centre + (0, 0, 2) — see World.tsx Camps.
  // Players only see/interact with their OWN clan's pile.
  const pile = useMemo(() => {
    if (!cat) return null;
    const c = CLANS[cat.clan];
    if (!c) return null;
    return { x: c.campCenter[0], z: c.campCenter[2] + 2 };
  }, [cat]);

  useFrame(() => {
    const me = viewerRef.current?.position;
    if (!me || !pile) return;
    const dx = me.x - pile.x;
    const dz = me.z - pile.z;
    const close = dx * dx + dz * dz < 3 * 3;
    if (close !== near) setNear(close);
  });

  if (!pile) return null;
  return (
    <group ref={ref} position={[pile.x, terrainHeightAt(pile.x, pile.z) + 0.4, pile.z]}>
      {near && (
        <Html position={[0, 1.2, 0]} center distanceFactor={9}>
          <button
            onClick={() => eatFromPile()}
            className="px-3 py-1 rounded-full bg-thunder/95 hover:bg-thunder text-bone text-[11px] font-display shadow border border-thunder/60 pointer-events-auto whitespace-nowrap"
          >
            🍖 Eat from pile (E)
          </button>
        </Html>
      )}
    </group>
  );
}

// Shared "eat from the fresh-kill pile" action — used by both the on-screen
// button and the E key in PlayerController. Mild throttle so it can't be
// spammed every frame. If you're already carrying prey, dropping it onto
// the pile gives a richer meal.
let _lastEatAt = 0;

// Eat the prey you're carrying right where you stand — no need to walk
// it back to the pile. Smaller hunger gain (20 vs the 35 the pile route
// gives) since you're not sharing.
function eatCarried() {
  const now = performance.now();
  if (now - _lastEatAt < 800) return;
  _lastEatAt = now;
  const s = useGameStore.getState();
  if (!s.carrying) return;
  const piece = s.carrying;
  s.setCarrying(null);
  s.setHud({ hunger: Math.min(100, s.hud.hunger + 20) });
  s.bumpTask('eat-pile-n', 1);
  if (piece === 'fish') s.bumpTask('eat-fish', 1);
  if (piece === 'rabbit') s.bumpTask('eat-rabbit', 1);
  s.pushChat({
    id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
    text: `You crouch over your ${piece} and eat it where you caught it.`,
    at: Date.now(),
  });
}

function eatFromPile() {
  const now = performance.now();
  if (now - _lastEatAt < 800) return;
  _lastEatAt = now;
  const s = useGameStore.getState();
  if (s.hud.hunger >= 100) {
    s.pushChat({
      id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
      text: 'Your belly is already full — leave some for the elders.',
      at: Date.now(),
    });
    return;
  }
  if (s.carrying) {
    // Drop your prey first → a real meal. Hunger restores 35.
    const piece = s.carrying;
    s.setCarrying(null);
    s.setHud({ hunger: Math.min(100, s.hud.hunger + 35) });
    s.bumpPileContrib(1);
    s.bumpTask('drop-pile-n', 1);
    if (piece === 'fish') s.bumpTask('eat-fish', 1);
    if (piece === 'rabbit') s.bumpTask('eat-rabbit', 1);
    s.pushChat({
      id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
      text: `You eat the ${piece} you brought in. Strength returns to your paws.`,
      at: Date.now(),
    });
    return;
  }
  // Eating from the pile without bringing prey requires a previous
  // contribution. Warriors who haven't hunted today can't take from the
  // shared store.
  if (s.pileContrib <= 0) {
    s.pushChat({
      id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
      text: 'You haven\'t added to the pile today — go hunt before you eat.',
      at: Date.now(),
    });
    return;
  }
  s.bumpPileContrib(-1);
  s.bumpTask('eat-pile-n', 1);
  s.setHud({ hunger: Math.min(100, s.hud.hunger + 18) });
  s.pushChat({
    id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
    text: 'You take a vole from the fresh-kill pile and crunch it down.',
    at: Date.now(),
  });
}

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
      <div className="relative px-3 py-2 rounded-2xl text-xs whitespace-nowrap max-w-[220px]"
           style={{
             backgroundColor: '#f3e7c9',
             color: '#3a2418',
             border: '3px solid #5a3a20',
             boxShadow: '0 2px 0 rgba(0,0,0,0.18)',
             fontFamily: 'inherit',
           }}>
        {text}
        {/* tail */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '14px',
            bottom: '-10px',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '12px solid #5a3a20',
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '17px',
            bottom: '-5px',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '8px solid #f3e7c9',
          }}
        />
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
    // Drive the day/night cycle whenever we are NOT being told what time
    // of day it is by a real server. Both the pure offline mode
    // (roomId === 'offline') and the BroadcastChannel mode (roomId
    // 'local-…') run on the client, so they both need the local tick.
    if (!roomState) return;
    if (!(roomState.roomId === 'offline' || roomState.roomId.startsWith('local-'))) return;
    const id = setInterval(() => {
      setRoom({
        ...roomState,
        // ~2-minute day/night cycle (was ~10 min) — bumped from +0.001 to
        // +0.005 per 0.6s tick.
        timeOfDay: (roomState.timeOfDay + 0.005) % 1,
      });
    }, 600);
    return () => clearInterval(id);
  }, [roomState, setRoom]);

  // Auto-end a raid when its timer runs out (truce). Won/lost outcomes
  // are handled inline by the pounce/swipe branches and the player
  // death respawn path.
  useEffect(() => {
    const id = setInterval(() => {
      const s = useGameStore.getState();
      if (s.raid && Date.now() > s.raid.until) {
        s.pushChat({ id: 'rd' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
          text: 'The raid breaks off — the rivals retreat to lick their wounds.', at: Date.now() });
        s.setRaid(null);
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Random disasters — every ~60s we roll. Only one active at a time.
  // Each runs 45s. When one fires we fan it out via the dual-channel
  // broadcaster (BC + localStorage) so every multiplayer tab gets the
  // SAME disaster at the SAME time. While a disaster is active we also
  // re-broadcast it every 5s so any tab that joined late catches up.
  useEffect(() => {
    let lastRebroadcastAt = 0;
    // First disaster fires ~40 min after the game loads, not immediately
    // on game start. Anchor the timer to "now" so the cadence starts
    // counting from when the player actually entered the forest.
    let lastRollAt = Date.now();
    const broadcast = (msg: any) => {
      try {
        const w = window as any;
        if (typeof w.__WOTC_SEND__ === 'function') w.__WOTC_SEND__(msg);
        else if (w.__WOTC_BC__) (w.__WOTC_BC__ as BroadcastChannel).postMessage(msg);
      } catch {}
    };
    const id = setInterval(() => {
      const s = useGameStore.getState();
      if (s.disaster && Date.now() < s.disaster.until) {
        // Disaster damage / capture (the outer tick fires every 4s):
        //   - Flood / fire deal real HP damage so disasters feel deadly.
        //   - Dog pack: very rare, tears a big chunk of HP per tick (~22).
        //   - Twoleg: no HP damage; instead a chance to kidnap you.
        if (!s.cutscene) {
          if (s.disaster.kind === 'flood') {
            s.setHud({ hp: Math.max(0, s.hud.hp - 10) });
          } else if (s.disaster.kind === 'fire') {
            s.setHud({ hp: Math.max(0, s.hud.hp - 14) });
          } else if (s.disaster.kind === 'dogpack') {
            s.setHud({ hp: Math.max(0, s.hud.hp - 22) });
            useGameStore.getState().setCameraShake(0.5);
          } else if (s.disaster.kind === 'twoleg' && Math.random() < 0.18) {
            // Kitty Pets and Kits aren't dragged off by twolegs — kitty
            // pets *belong* to twolegs, and kits stay in the nursery
            // where the warriors protect them. Both are immune to the
            // kidnap cutscene (the rest of the clan still suffers it).
            const myRole = s.cat?.role;
            const myClan = s.cat?.clan;
            const immune = myRole === 'Kit' || myRole === 'KittyPet' || myClan === 'KittyPet';
            if (!immune) {
              s.setCutscene({ kind: 'kidnap', startedAt: Date.now() });
            }
            try { (window as any).__WOTC_TRIGGER__?.('survive-disaster'); } catch {}
          }
        }
        // While active, re-broadcast every 5s so late joiners sync up.
        if (Date.now() - lastRebroadcastAt > 5000) {
          lastRebroadcastAt = Date.now();
          broadcast({ kind: 'disaster', disaster: s.disaster });
        }
        return;
      }
      // Disaster just ended. If the player survived (cutscene didn't fire),
      // credit the survive-disaster trigger so chapter 4 can advance.
      if (s.disaster && Date.now() >= s.disaster.until) {
        try { (window as any).__WOTC_TRIGGER__?.('survive-disaster'); } catch {}
      }
      if (s.disaster && Date.now() >= s.disaster.until) {
        s.setDisaster(null);
        s.pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
          text: 'The danger has passed. The forest holds its breath.', at: Date.now() });
        return;
      }
      // Independent of the 40-min cadence, every 4s tick there's a tiny
      // 0.1% chance a dog pack bursts through a fence and tears across
      // the territories. Shorter window (15s) but very high damage.
      if (Math.random() < 0.001) {
        const d = {
          kind: 'dogpack' as const,
          until: Date.now() + 15_000,
          message: 'DOG PACK in the territories! Run! Run! Their teeth will tear you apart!',
        };
        s.setDisaster(d);
        s.pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
          text: d.message, at: Date.now() });
        broadcast({ kind: 'disaster', disaster: d });
        lastRebroadcastAt = Date.now();
        return;
      }
      // Roll a fresh disaster on a long cadence — about every 40 minutes
      // of play. The tick still runs every 4s so an active disaster's
      // re-broadcast stays responsive, but rolling only fires when the
      // 40-minute window has elapsed (then guaranteed to pick one).
      if (Date.now() - lastRollAt < 40 * 60 * 1000) return;
      lastRollAt = Date.now();
      const roll = Math.random();
      const pick: 'twoleg' | 'flood' | 'fire' = roll < 1 / 3 ? 'twoleg' : roll < 2 / 3 ? 'flood' : 'fire';
      const messages: Record<typeof pick, string> = {
        twoleg: 'TWOLEGS in the forest! Hide, or they will carry you away in a cage!',
        flood:  'The river bursts its banks — a flood pours through RiverClan! Higher ground, now!',
        fire:   'Smoke on the wind — FIRE in the pines! Run for water!',
      };
      const d = { kind: pick, until: Date.now() + 45_000, message: messages[pick] };
      s.setDisaster(d);
      s.pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system',
        text: messages[pick], at: Date.now() });
      broadcast({ kind: 'disaster', disaster: d });
      lastRebroadcastAt = Date.now();
    }, 4_000);
    return () => clearInterval(id);
  }, []);

  // Random inter-clan drama + rude clanmate banter — every ~75s a one-off
  // message from an unseen warrior. Flavour only, no mechanics.
  useEffect(() => {
    const dramatic = [
      'A WindClan patrol crossed our scent markers near the moor — Bramblepaw saw them.',
      'RiverClan brags about fish — they always do.',
      'ShadowClan deputies whisper about a new alliance against the river.',
      'The kits stole a vole from the elders\' den again.',
      'Mistyfoot called the apprentices lazy. She wasn\'t wrong.',
      'An elder swears she saw a fox-shape at dusk near the Thunderpath.',
      'A loner hissed at a ThunderClan patrol and ran — strange.',
    ];
    const rude = [
      'You walk too loud, kit. Even a deaf squirrel would hear you.',
      'Did your mother teach you how to crouch? She did a bad job.',
      'I have caught more prey before dawn than you all moon.',
      'Move, mouse-brain. I have actual hunting to do.',
      'Half-tail couldn\'t track a fish in a puddle.',
    ];
    const id = setInterval(() => {
      const s = useGameStore.getState();
      const r = Math.random();
      if (r < 0.5) {
        s.pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'Whispers', scope: 'system',
          text: dramatic[Math.floor(Math.random() * dramatic.length)], at: Date.now() });
      } else {
        const speakers = ['Dustpelt', 'Mistyfoot', 'Thornclaw', 'Whitestorm', 'Sandstorm'];
        s.pushChat({ id: 'sys' + Date.now(), fromId: 'npc:rude', fromName: speakers[Math.floor(Math.random() * speakers.length)], scope: 'nearby',
          text: rude[Math.floor(Math.random() * rude.length)], at: Date.now() });
      }
    }, 75_000);
    return () => clearInterval(id);
  }, []);

  // Full-moon Gathering — once per "month" (every ~12 minutes of real
  // time) and lasts 6 minutes. All four leader NPCs converge at
  // Fourtrees. Pure client-side timer so it works in offline mode too.
  useEffect(() => {
    const PERIOD = 12 * 60 * 1000;   // ~12 min between gatherings
    const DURATION = 6 * 60 * 1000;  // ~6 min open
    const tick = () => {
      const t = Date.now() % PERIOD;
      const open = t < DURATION;
      const cur = useGameStore.getState();
      if (open !== cur.clanGathering) {
        cur.setClanGathering(open);
        cur.pushChat({
          id: 'sys' + Date.now(),
          fromId: 'system',
          fromName: 'StarClan',
          scope: 'system',
          text: open
            ? '🌕 The full moon rises — a Gathering begins at Fourtrees. Walk in peace.'
            : 'The Gathering ends. Each clan returns to its territory.',
          at: Date.now(),
        });
        if (open) cur.bumpTask('attend-gathering', 1);
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

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
      if (anim === 'crouch' || anim === 'pounce' || useGameStore.getState().targetPreyId) mode = 'hunt';
      if (nearbyCat && (anim === 'pounce' || anim === 'run')) mode = 'battle';
      // Tigerstar fight forces full-on battle music for the entire encounter.
      if (useGameStore.getState().battleActive) mode = 'battle';
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

        {/* NPCs — Firestar in ThunderClan camp, Tigerstar in ShadowClan camp */}
        <Npcs viewerRef={selfRef} />

        {/* Enemy warriors that march on your camp when battle is declared */}
        <Raids viewerRef={selfRef} />

        {/* Tap-to-eat prompt over the player's own fresh-kill pile */}
        <FreshKillPile viewerRef={selfRef} />

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
