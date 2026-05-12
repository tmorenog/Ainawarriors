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
  { cx: 0,    cz: -7,        hx: 2.1, hz: 1.3, top: 2.2 },
  { cx: 180,  cz: -30 - 7,   hx: 2.1, hz: 1.3, top: 2.2 },
  { cx: -60,  cz: 180 - 7,   hx: 2.1, hz: 1.3, top: 2.2 },
  { cx: -200, cz: 60 - 7,    hx: 2.1, hz: 1.3, top: 2.2 },
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
// centre (the Gathering island where the Great Oak grows).
export const LAKE = { x: -50, z: 280, r: 60, islandR: 9 };

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
  // west side. Only cut where it isn't already inside the lake basin.
  const sCenter = 240 + Math.sin(x * 0.03) * 10;
  const lakeDx = x - LAKE.x;
  const lakeDz = z - LAKE.z;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  if (lakeDist > LAKE.r - 4 && x < -100 && x > -260) {
    const stream = Math.exp(-Math.pow((z - sCenter) / 6, 2));
    h -= stream * 1.4;
  }

  // WindClan moor — flatter but still has rolling hills (was 0.4 → 0.55).
  if (x < -120) h *= 0.55;

  // Lake basin — flat-ish floor sloping smoothly up to the bank.
  if (lakeDist < LAKE.r) {
    const t = lakeDist / LAKE.r;
    const lakeFloor = -2.6 + Math.pow(t, 2) * 2.3;
    h = Math.min(h, lakeFloor);
    // Gathering island — a shallow dome rising above the water.
    if (lakeDist < LAKE.islandR) {
      const it = lakeDist / LAKE.islandR;
      const islandTop = 1.2 - Math.pow(it, 2) * 0.8;
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
