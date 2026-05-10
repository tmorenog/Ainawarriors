// Shared analytical terrain height field. Used both to build the World mesh
// and to keep the player's paws on the ground (so you can't "walk on the sky").
//
// Keep this in sync with the procedural formula — World samples it per-vertex,
// Game samples it once per frame for the local cat.

export function terrainHeightAt(x: number, z: number): number {
  // Big rolling hills (low frequency) + medium ridges + fine bumps
  let h =
    Math.sin(x * 0.012) * 1.4 +
    Math.cos(z * 0.013) * 1.4 +
    Math.sin((x + z) * 0.005) * 2.4 +
    Math.cos((x - z) * 0.008) * 1.0 +
    // extra octave for realism — small noisy bumps you actually feel as you walk
    Math.sin(x * 0.04 + z * 0.03) * 0.35 +
    Math.cos(x * 0.06 - z * 0.05) * 0.25;

  // Riverbed channel near +X: carves a smooth valley
  const river = Math.exp(-Math.pow((x - 180) / 30, 2));
  h -= river * 3.2;

  // WindClan moor (low rolling flatland) west of -120
  if (x < -120) h *= 0.4;

  return h;
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
