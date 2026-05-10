'use client';

import { useEffect, useState, type ReactNode } from 'react';

let cached: boolean | null = null;
let cachedReason = '';

function detectWebGLOnce(): { ok: boolean; reason: string } {
  if (typeof window === 'undefined') return { ok: false, reason: 'No window' };
  try {
    const canvas = document.createElement('canvas');
    const opts: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'default',
      antialias: false,
      preserveDrawingBuffer: false,
    };
    const gl =
      (canvas.getContext('webgl2', opts) as WebGLRenderingContext | null) ||
      (canvas.getContext('webgl', opts) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl', opts) as WebGLRenderingContext | null);
    if (!gl) return { ok: false, reason: 'WebGL context not available' };
    let result: { ok: boolean; reason: string };
    try {
      const probe = gl.getShaderPrecisionFormat?.(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      result = probe ? { ok: true, reason: '' } : { ok: false, reason: 'WebGL precision probe failed' };
    } catch {
      result = { ok: false, reason: 'WebGL precision probe threw' };
    }
    // Free the probe context immediately so we don't hog one of the (very few)
    // WebGL slots iOS Safari allows.
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    return result;
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Unknown WebGL error' };
  }
}

// Try up to 3 times — right after the editor unmounts iPad Safari can take
// a few hundred ms to actually release the previous WebGL context, so the
// first probe in the game screen sometimes fails even though WebGL is fine.
function detectWebGL(): Promise<{ ok: boolean; reason: string }> {
  return new Promise((resolve) => {
    let attempt = 0;
    const tick = () => {
      const r = detectWebGLOnce();
      if (r.ok || attempt >= 2) { resolve(r); return; }
      attempt += 1;
      setTimeout(tick, 180);
    };
    tick();
  });
}

export async function getWebGLSupport(): Promise<{ ok: boolean; reason: string }> {
  if (cached === true) return { ok: true, reason: '' };
  const r = await detectWebGL();
  // Only cache the positive result — a transient false should be retryable
  if (r.ok) { cached = true; cachedReason = ''; }
  return r;
}

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

export function WebGLGuard({ children, fallbackTitle }: Props) {
  const [state, setState] = useState<{ ok: boolean; reason: string } | null>(null);
  const [bypassed, setBypassed] = useState(false);

  const probe = () => {
    setState(null);
    getWebGLSupport().then(setState);
  };

  useEffect(() => { probe(); }, []);

  if (bypassed) return <>{children}</>;

  if (state === null) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-forest-900 text-bone">
        <div className="font-display text-2xl animate-pulse-soft">Slipping into the forest...</div>
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-forest-900 text-bone p-6 overflow-y-auto">
        <div className="max-w-md text-center my-auto">
          <div className="text-xs uppercase tracking-[0.5em] opacity-70 mb-3">StarClan whispers...</div>
          <h1 className="font-display text-3xl mb-3">{fallbackTitle ?? 'The forest needs WebGL.'}</h1>
          <p className="text-sm opacity-85 mb-4">
            Your browser couldn’t open a 3D view yet. This is sometimes a quick hiccup right after
            the character creator closes — try the retry button first.
          </p>
          <ul className="text-xs opacity-80 text-left bg-black/30 rounded-lg p-3 mb-4 space-y-1">
            <li>• <b>Safari (iPad / Mac):</b> Settings → Safari → Advanced → Experimental Features → enable <i>WebGL 2.0</i>.</li>
            <li>• <b>Chrome / Edge:</b> Settings → System → enable <i>Use hardware acceleration</i>, then restart.</li>
            <li>• <b>Firefox:</b> about:config → set <code>webgl.disabled</code> to false.</li>
            <li>• Close other 3D tabs (the browser limits how many WebGL contexts can run at once).</li>
            <li>• Try a different browser if you’re on a private / locked-down profile.</li>
          </ul>
          <details className="text-[11px] opacity-70 text-left bg-black/30 rounded-lg p-2 mb-4">
            <summary className="cursor-pointer">Technical detail</summary>
            <pre className="whitespace-pre-wrap break-all mt-1">{state.reason}</pre>
          </details>
          <div className="flex flex-col gap-2">
            <button
              onClick={probe}
              className="rounded-xl bg-thunder hover:bg-thunder/90 px-6 py-3 font-display text-lg shadow"
            >
              Retry
            </button>
            <button
              onClick={() => setBypassed(true)}
              className="rounded-xl border border-white/25 hover:bg-white/5 px-6 py-2 text-sm"
            >
              Try anyway
            </button>
            <button
              onClick={() => { try { window.location.reload(); } catch {} }}
              className="text-xs opacity-60 hover:opacity-90 mt-1"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
