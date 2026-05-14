// Shared analytical terrain height field. Used both to build the World mesh
// and to keep the player's paws on the ground (so you can't "walk on the sky").
//
// Keep this in sync with the procedural formula — World samples it per-vertex,
// Game samples it once per frame for the local cat.

// Walkable platforms — when the cat stands within one of these AABBs the
// terrain "ground" is lifted to the platform's top so the cat can stand on
// it. Used for each major clan's High Rock so the leader (and anyone else)
// can climb up. Coordinates are world XZ centres + half-extents in XZ + the
// top Y of the platform. The four clan camps sit at:
//   ThunderClan (0, 0)   RiverClan (180, -30)
//   ShadowClan (-60, 180) WindClan (-200, 60)
// The High Rock geometry (see World.tsx Camps) is at camp + (0, _, -7),
// box [4.2, 2.2, 2.6], so its top is ~2.2 above the local terrain.
const HIGH_ROCKS: { cx: number; cz: number; hx: number; hz: number; top: number }[] = [
  { cx: 0,    cz: -7,        hx: 3.4, hz: 1.5, top: 0.9 },
  { cx: 180,  cz: -30 - 7,   hx: 3.4, hz: 1.5, top: 0.9 },
  { cx: -60,  cz: 180 - 7,   hx: 3.4, hz: 1.5, top: 0.9 },
  { cx: -200, cz: 60 - 7,    hx: 3.4, hz: 1.5, top: 0.9 },
];

function platformHeightAt(x: number, z: number): number {
  for (const r of HIGH_ROCKS) {
    if (Math.abs(x - r.cx) < r.hx && Math.abs(z - r.cz) < r.hz) {
      // Approximate the platform top relative to the local rolling terrain.
      // The platform sits on top of whatever the natural ground is, so we
      // add the top Y to the smooth field.
      return r.top + naturalTerrain(r.cx, r.cz);
    }
  }
  return -Infinity;
}

// The Lake — large circular basin with a small raised island near the
// centre (the Gathering island where the Great Oak grows). Positioned
// fully inside the player's walkable radius (maxR=280 in Game.tsx).
export const LAKE = { x: 40, z: 220, r: 55, islandR: 8 };

// Small stream feeding the lake from the south-west. Centralised here so
// the World colour / foliage exclusion / player ground all agree.
export const STREAM = { xCenter: 80, zMin: 80, zMax: 170, wave: 8, half: 5 };

// Climbable tree trunks — fixed spots where the player can press E to
// scramble up onto a low branch. Shared between Game.tsx (collision +
// climb logic) and World.tsx (renders a chunky standalone oak so they
// stand out from the procedural pine forest).
export const CLIMBABLE_TREES: Array<{ x: number; z: number }> = [
  { x: 12,    z: 6   },
  { x: -10,   z: 14  },
  { x: 170,   z: -18 },
  { x: 192,   z: -42 },
  { x: -50,   z: 195 },
  { x: -72,   z: 168 },
  { x: -190,  z: 78  },
  { x: -212,  z: 50  },
  { x: 40,    z: -40 },
  { x: -30,   z: -60 },
  { x: 80,    z: 30  },
  { x: -90,   z: 100 },
];

// Wounded warrior — fixed spot near the ThunderClan medicine den where
// the "heal a wounded clanmate" side quest's target lies. Shared so
// both the World mesh and the HUD proximity check stay in sync.
// Wounded warrior — small offset from each clan's high rock. The real
// world position is computed at render time as
//   CLANS[player.clan].campCenter + INJURED_WARRIOR_OFFSET
// so every clan has its own wounded clanmate to heal, not just
// ThunderClan. Kept here so World, HUD, and the heal check all agree
// on the same offset.
export const INJURED_WARRIOR_OFFSET = { dx: 5, dz: 8, name: 'Bramblepaw' };
// Back-compat: legacy code path still imports INJURED_WARRIOR. Points
// at the ThunderClan position (campCenter is (0,0) for ThunderClan).
export const INJURED_WARRIOR = { x: INJURED_WARRIOR_OFFSET.dx, z: INJURED_WARRIOR_OFFSET.dz, name: INJURED_WARRIOR_OFFSET.name };

function naturalTerrain(x: number, z: number): number {
  // Base rolling hills (low-frequency)
  let h =
    Math.sin(x * 0.012) * 1.4 +
    Math.cos(z * 0.013) * 1.4 +
    Math.sin((x + z) * 0.005) * 2.4 +
    Math.cos((x - z) * 0.008) * 1.0 +
    // New "lots of hills" octave — bigger ridges and crests.
    Math.sin(x * 0.018 + z * 0.022) * 2.8 +
    Math.cos(x * 0.025 - z * 0.015) * 2.0 +
    // Mid-frequency bumps
    Math.sin(x * 0.04 + z * 0.03) * 0.50 +
    Math.cos(x * 0.06 - z * 0.05) * 0.40;

  // Main river channel along +X (carves a smooth valley)
  const river = Math.exp(-Math.pow((x - 180) / 30, 2));
  h -= river * 3.2;

  // Tributary 1 — winding east-west stream around z = -120, branching
  // off the moor toward the main river.
  const t1Center = -120 + Math.sin(x * 0.02) * 25;
  const trib1 = Math.exp(-Math.pow((z - t1Center) / 10, 2));
  h -= trib1 * 2.2;

  // Tributary 2 — winding north-south stream around x = -50, snaking
  // through ThunderClan territory.
  const t2Center = -50 + Math.sin(z * 0.025) * 20;
  const trib2 = Math.exp(-Math.pow((x - t2Center) / 9, 2));
  h -= trib2 * 2.0;

  // Small stream — narrow winding watercourse feeding the lake from the
  // south. Only cut where it isn't already inside the lake basin.
  const lakeDx = x - LAKE.x;
  const lakeDz = z - LAKE.z;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  if (lakeDist > LAKE.r - 4 && z > STREAM.zMin && z < STREAM.zMax) {
    const sx = STREAM.xCenter + Math.sin(z * 0.04) * STREAM.wave;
    const stream = Math.exp(-Math.pow((x - sx) / STREAM.half, 2));
    h -= stream * 1.0;
  }

  // WindClan moor — flatter but still has rolling hills (was 0.4 → 0.55).
  if (x < -120) h *= 0.55;

  // Lake basin — DELIBERATELY very shallow so the cat appears to wade on
  // the surface (the World water plane sits at y ≈ -0.15) rather than
  // dropping into a deep pit and walking underwater. The depth is
  // visually carried by the blue/sand colouring in makeTerrain, not by
  // an actual hole in the ground.
  if (lakeDist < LAKE.r) {
    const t = lakeDist / LAKE.r;
    // -0.25 at the centre, smoothly back up to 0 at the rim.
    const lakeFloor = -0.25 + Math.pow(t, 2) * 0.25;
    h = Math.min(h, lakeFloor);
    // Gathering island — smooth dome that meets the lake floor at the
    // island edge so there's no vertical step at the shore.
    if (lakeDist < LAKE.islandR) {
      const it = lakeDist / LAKE.islandR;
      const islandTop = -0.25 + Math.cos((it * Math.PI) / 2) * 1.45;
      h = Math.max(h, islandTop);
    }
  }

  return h;
}

export function terrainHeightAt(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const platform = platformHeightAt(x, z);
  if (platform > -Infinity) return platform;
  return naturalTerrain(x, z);
}

// Solid obstacle blockers — circles in XZ that the player can't walk
// through. Used by PlayerController to push the cat out of buildings,
// rock piles, big tree trunks, ruined walls, etc. We deliberately keep
// the radii a little smaller than the visual footprint so the cat can
// brush past hedges and corners without getting glued to them.
export interface Blocker { x: number; z: number; r: number }
export const BLOCKERS: Blocker[] = [
  // ---- ThunderClan camp High Rock --------------------------------------
  { x: 0,    z: -7,        r: 2.0 },
  // ---- RiverClan camp High Rock ----------------------------------------
  { x: 180,  z: -37,       r: 2.0 },
  // ---- ShadowClan camp High Rock ---------------------------------------
  { x: -60,  z: 173,       r: 2.0 },
  // ---- WindClan camp High Rock -----------------------------------------
  { x: -200, z: 53,        r: 2.0 },
  // ---- Snakerocks (cluster) — one bigger circle around the pile --------
  { x: 60,   z: 70,        r: 6.5 },
  // ---- Ancient Oak trunk ------------------------------------------------
  { x: -10,  z: -80,       r: 1.4 },
  // ---- Great Oak (Gathering island) — trunk -----------------------------
  { x: 40,   z: 220,       r: 1.6 },
  // ---- Moonstone mound (Highstones) -------------------------------------
  { x: -280, z: -260,      r: 6.5 },
  // ---- Abandoned twoleg nest --------------------------------------------
  { x: 130,  z: 110,       r: 4.5 },
  // ---- SkyClan camp gathering ledge -------------------------------------
  { x: 220,  z: 58,        r: 3.0 },
  // ---- Twoleg place houses (rough cluster around (260, 240)) ------------
  // The TwolegPlace component places houses on either side of a crossing
  // path; we block the bulk footprints of each row.
  { x: 260 - 18, z: 240 - 10, r: 3.0 }, // north row
  { x: 260 - 6,  z: 240 - 10, r: 3.0 },
  { x: 260 + 6,  z: 240 - 10, r: 3.0 },
  { x: 260 - 18, z: 240 + 10, r: 3.0 }, // south row
  { x: 260 - 6,  z: 240 + 10, r: 3.0 },
  { x: 260 + 6,  z: 240 + 10, r: 3.0 },
  { x: 260 - 22, z: 240 - 8,  r: 3.0 }, // west row
  { x: 260 - 22, z: 240 + 8,  r: 3.0 },
  { x: 260 + 22, z: 240 - 8,  r: 3.0 }, // east row
  { x: 260 + 22, z: 240 + 8,  r: 3.0 },
  { x: 260 + 18, z: 240 - 22, r: 3.2 }, // barn / shop corner
  { x: 260 - 20, z: 240 + 22, r: 3.2 },
  // ---- Horseplace barns -------------------------------------------------
  { x: 240,      z: -180,     r: 4.0 },
  { x: 240 + 14, z: -180,     r: 4.0 },
  { x: 240 - 14, z: -180,     r: 4.0 },
  // ---- Greenleaf cabins (lake shore) ------------------------------------
  { x: 60 - 8,   z: 145,      r: 2.0 },
  { x: 60,       z: 145,      r: 2.0 },
  { x: 60 + 8,   z: 145,      r: 2.0 },
];

export function resolveBlockers(x: number, z: number, padding = 0.45): [number, number] {
  let nx = x, nz = z;
  for (const b of BLOCKERS) {
    const dx = nx - b.x;
    const dz = nz - b.z;
    const minR = b.r + padding;
    const d2 = dx * dx + dz * dz;
    if (d2 < minR * minR && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = (minR - d);
      nx += (dx / d) * push;
      nz += (dz / d) * push;
    } else if (d2 <= 1e-6) {
      // Directly on top — pop straight out in +x so we don't divide by 0
      nx = b.x + (b.r + padding);
    }
  }
  return [nx, nz];
}

// Approximate slope from the analytical field (used for sliding/orientation).
export function terrainNormalAt(x: number, z: number): [number, number, number] {
  const e = 0.5;
  const hL = terrainHeightAt(x - e, z);
  const hR = terrainHeightAt(x + e, z);
  const hD = terrainHeightAt(x, z - e);
  const hU = terrainHeightAt(x, z + e);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
