'use client';

import { useEffect, useState, type ReactNode } from 'react';

let cached: boolean | null = null;
let cachedReason = '';

function detectWebGL(): { ok: boolean; reason: string } {
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
    // Probe shader precision — this is the API that crashes inside three when GL is broken
    try {
      const probe = gl.getShaderPrecisionFormat?.(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      if (!probe) return { ok: false, reason: 'WebGL precision probe failed' };
    } catch {
      return { ok: false, reason: 'WebGL precision probe threw' };
    }
    return { ok: true, reason: '' };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Unknown WebGL error' };
  }
}

export function getWebGLSupport(): { ok: boolean; reason: string } {
  if (cached !== null) return { ok: cached, reason: cachedReason };
  const r = detectWebGL();
  cached = r.ok;
  cachedReason = r.reason;
  return r;
}

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

export function WebGLGuard({ children, fallbackTitle }: Props) {
  const [state, setState] = useState<{ ok: boolean; reason: string } | null>(null);

  useEffect(() => {
    setState(getWebGLSupport());
  }, []);

  if (state === null) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-forest-900 text-bone">
        <div className="font-display text-2xl animate-pulse-soft">Slipping into the forest...</div>
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-forest-900 text-bone p-6">
        <div className="max-w-md text-center">
          <div className="text-xs uppercase tracking-[0.5em] opacity-70 mb-3">StarClan whispers...</div>
          <h1 className="font-display text-3xl mb-3">{fallbackTitle ?? 'The forest needs WebGL.'}</h1>
          <p className="text-sm opacity-85 mb-4">
            Your browser couldn’t open a 3D view. This usually means WebGL is disabled or hardware
            acceleration is off in your browser settings.
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
          <button
            onClick={() => { try { window.location.reload(); } catch {} }}
            className="rounded-xl bg-thunder hover:bg-thunder/90 px-6 py-3 font-display text-lg shadow"
          >
            Reload Forest
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
