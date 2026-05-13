// Shared geometry + state for the Thunderpath and the monsters
// (twoleg vehicles) that prowl it. Both World.tsx and Game.tsx import
// from here so the road mesh and the collision check are guaranteed
// to use the same curve.

import { terrainHeightAt } from './terrain';

// Main Thunderpath — east-west road between ThunderClan and ShadowClan.
export const THUNDERPATH = {
  xMin: -180,
  xMax: 80,
  z0: 95,
  waveAmp: 6,
  waveFreq: 0.015,
  halfWidth: 3,
};

// Map t in [0,1] to a point on the main Thunderpath curve.
export function thunderpathAt(t: number): [number, number] {
  const x = THUNDERPATH.xMin + (THUNDERPATH.xMax - THUNDERPATH.xMin) * t;
  const z = THUNDERPATH.z0 + Math.sin(x * THUNDERPATH.waveFreq) * THUNDERPATH.waveAmp;
  return [x, z];
}

// Tangent of the curve at t (unit-length, in XZ plane).
export function thunderpathTangent(t: number): [number, number] {
  const dt = 1e-3;
  const t0 = Math.max(0, t - dt);
  const t1 = Math.min(1, t + dt);
  const [a, b] = thunderpathAt(t0);
  const [c, d] = thunderpathAt(t1);
  const dx = c - a;
  const dz = d - b;
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

// Monsters — twoleg vehicles driving back and forth. Deterministic so
// the renderer and the player-collision check stay in sync without any
// state-passing. Two monsters loop around at slightly different phases
// and opposite directions.
export const NUM_MONSTERS = 2;
const MONSTER_PERIOD_MS = 18_000;

export interface MonsterState {
  x: number;
  z: number;
  y: number;
  yaw: number;          // facing direction
  dirSign: 1 | -1;
}

export function monsterAt(index: number, nowMs: number): MonsterState {
  const offset = (index * 0.47) % 1;
  const dirSign: 1 | -1 = index % 2 === 0 ? 1 : -1;
  // Smooth t in [0, 1] that wraps.
  let raw = (nowMs / MONSTER_PERIOD_MS + offset) % 1;
  if (raw < 0) raw += 1;
  const t = dirSign === 1 ? raw : 1 - raw;
  const [x, z] = thunderpathAt(t);
  const [tx, tz] = thunderpathTangent(t);
  const facing = dirSign === 1 ? Math.atan2(tx, tz) : Math.atan2(-tx, -tz);
  return {
    x,
    z,
    y: terrainHeightAt(x, z) + 0.5,
    yaw: facing,
    dirSign,
  };
}

// True if the player at (px, pz) is overlapping a monster — used both
// for HP damage and for the warning "honk" sound. Radius is generous so
// you can't dance just past a fender and survive.
export const MONSTER_KILL_RADIUS = 2.4;
export const MONSTER_WARN_RADIUS = 7.5;

export function nearestMonsterDistance(px: number, pz: number, nowMs: number): {
  distance: number;
  monster: MonsterState;
} {
  let best = Infinity;
  let bestM: MonsterState = monsterAt(0, nowMs);
  for (let i = 0; i < NUM_MONSTERS; i++) {
    const m = monsterAt(i, nowMs);
    const dx = m.x - px;
    const dz = m.z - pz;
    const d = Math.hypot(dx, dz);
    if (d < best) { best = d; bestM = m; }
  }
  return { distance: best, monster: bestM };
}
