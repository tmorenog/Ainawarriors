'use client';

import * as THREE from 'three';
import type { FurPattern } from '@/game/types';

// Hash a string into a deterministic seed so every cat keeps the same pattern.
export function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return h || 1;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export interface FurInputs {
  pattern: FurPattern;
  base: string;
  patternColor: string;
  patternColor2?: string;
  patternColor3?: string;
  belly: string;
  seed: number;
}

/**
 * Build a deterministic fur texture for a cat. The texture wraps around the
 * body / head / leg geometry as their UVs allow.
 *
 * Returns null for solid coats (no texture map needed).
 */
export function buildFurTexture(input: FurInputs): THREE.CanvasTexture | null {
  if (input.pattern === 'solid') return null;
  if (typeof document === 'undefined') return null;

  const W = 256;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rand = seeded(input.seed);
  const { base, patternColor, belly, pattern } = input;
  const c2 = input.patternColor2 || patternColor;
  const c3 = input.patternColor3 || c2;
  const palette = [patternColor, c2, c3];

  // Base coat
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  switch (pattern) {
    case 'tabby': {
      // Bold tiger stripes that radiate sideways from a darker spine band along the top of the texture.
      // The texture wraps around the body so the top of the canvas maps to the cat's spine.

      // 1. Deep spine band in patternColor3 (or fallback)
      const spine = ctx.createLinearGradient(0, 0, 0, H);
      spine.addColorStop(0, c3);
      spine.addColorStop(0.18, c3);
      spine.addColorStop(0.55, 'rgba(0,0,0,0)');
      ctx.fillStyle = spine;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(0, 0, W, H * 0.5);
      ctx.globalAlpha = 1;

      // 2. Bold dark stripes in patternColor — wider, jagged, dropping from spine down the flanks
      ctx.fillStyle = patternColor;
      const count = 24;
      for (let i = 0; i < count; i++) {
        const cx = (i / count) * W + (rand() - 0.5) * 6;
        const topY = 0;
        const bottomY = H * (0.55 + rand() * 0.4);  // varying length
        const baseW = 6 + rand() * 7;               // wide stroke
        ctx.beginPath();
        // Left edge of stripe (jagged)
        for (let y = topY; y <= bottomY; y += 4) {
          const wig = Math.sin(y * 0.18 + i) * 2.5 + (rand() - 0.5) * 1.5;
          const x = cx - baseW / 2 + wig;
          if (y === topY) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // Right edge back up
        for (let y = bottomY; y >= topY; y -= 4) {
          const wig = Math.sin(y * 0.22 + i + 1.7) * 2.5 + (rand() - 0.5) * 1.5;
          const x = cx + baseW / 2 + wig;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }

      // 3. Secondary thinner accent stripes in patternColor2 between primaries
      ctx.fillStyle = c2;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < count; i++) {
        const cx = (i / count) * W + W / (count * 2);
        const topY = H * 0.05;
        const bottomY = H * (0.45 + rand() * 0.35);
        const baseW = 2 + rand() * 2.5;
        ctx.beginPath();
        for (let y = topY; y <= bottomY; y += 4) {
          const wig = Math.sin(y * 0.25 + i * 1.3) * 2;
          const x = cx - baseW / 2 + wig;
          if (y === topY) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let y = bottomY; y >= topY; y -= 4) {
          const wig = Math.sin(y * 0.28 + i * 1.3 + 1.5) * 2;
          const x = cx + baseW / 2 + wig;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 4. Lighter belly strip (bottom of texture) so the underside reads brighter
      const belly2 = ctx.createLinearGradient(0, H * 0.65, 0, H);
      belly2.addColorStop(0, 'rgba(255,255,255,0)');
      belly2.addColorStop(1, belly || '#f5efe2');
      ctx.fillStyle = belly2;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, H * 0.65, W, H * 0.35);
      ctx.globalAlpha = 1;
      break;
    }

    case 'spotted': {
      // Mix of spot colors from the palette so each "spot" can be a different shade
      const count = 100;
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
        const x = rand() * W;
        const y = rand() * H;
        const r = 4 + rand() * 9;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.85 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'tortoiseshell': {
      // Alternating patches of every pattern color → classic tortie marbling
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = palette[i % palette.length];
        const x = rand() * W;
        const y = rand() * H;
        const r = 22 + rand() * 36;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.55 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // A few lighter base-color speckles for depth
      ctx.fillStyle = base;
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 32; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const r = 5 + rand() * 12;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'calico': {
      // White / belly + each pattern color gets its own patches
      const layers = [belly || '#f5efe2', patternColor, c2, c3];
      for (const fill of layers) {
        ctx.fillStyle = fill;
        for (let i = 0; i < 6; i++) {
          const x = rand() * W;
          const y = rand() * H;
          const r = 22 + rand() * 28;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * (0.55 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'point': {
      // Darker bands at the texture edges → ends up on extremities (face / paws / tail tip)
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, patternColor);
      g.addColorStop(0.18, base);
      g.addColorStop(0.82, base);
      g.addColorStop(1, patternColor);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      break;
    }

    case 'bicolor': {
      // White / belly color across the lower portion with a soft fade
      ctx.fillStyle = belly || '#f5efe2';
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.6);
      g.addColorStop(0, base);
      g.addColorStop(1, belly || '#f5efe2');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.45, W, H * 0.15);
      break;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  // Three r152+: srgb. Older versions: encoding. Try the modern path.
  // @ts-ignore
  if ('SRGBColorSpace' in THREE) tex.colorSpace = (THREE as any).SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
