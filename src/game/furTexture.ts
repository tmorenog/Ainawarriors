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
      // Primary mackerel stripes in patternColor
      ctx.strokeStyle = patternColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const stripes = 22;
      for (let i = 0; i < stripes; i++) {
        const baseX = (i / stripes) * W + (rand() - 0.5) * 6;
        ctx.beginPath();
        for (let y = -8; y <= H + 8; y += 6) {
          const x = baseX + Math.sin(y * 0.045 + i * 0.6) * 9;
          if (y === -8) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Secondary thinner accent stripes in patternColor2 between primaries
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < stripes; i++) {
        const baseX = (i / stripes) * W + W / (stripes * 2);
        ctx.beginPath();
        for (let y = -8; y <= H + 8; y += 6) {
          const x = baseX + Math.sin(y * 0.06 + i * 1.1) * 7;
          if (y === -8) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Spine band uses patternColor3 as the deepest shade if provided
      const spine = ctx.createLinearGradient(0, 0, 0, H);
      spine.addColorStop(0, c3);
      spine.addColorStop(0.4, 'rgba(0,0,0,0)');
      ctx.fillStyle = spine;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, 0, W, H);
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
