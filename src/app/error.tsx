'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (typeof console !== 'undefined') console.error('[wotc] runtime error:', error);
  }, [error]);

  return (
    <div className="absolute inset-0 grid place-items-center bg-forest-900 text-bone p-6">
      <div className="max-w-md text-center animate-fade-in">
        <div className="text-xs uppercase tracking-[0.5em] opacity-70 mb-3">StarClan whispers...</div>
        <h1 className="font-display text-3xl mb-3">The warriors have discovered an issue.</h1>
        <p className="text-sm opacity-80 mb-6">
          Something tangled in the brambles. Try returning to the clearing — your cat is still safe in the dens.
        </p>
        <div className="flex flex-col gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-thunder hover:bg-thunder/90 px-6 py-3 font-display text-lg shadow"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              try { window.location.reload(); } catch {}
            }}
            className="rounded-xl border border-white/20 hover:bg-white/5 px-6 py-2 text-sm"
          >
            Reload Forest
          </button>
          <button
            onClick={() => {
              try {
                localStorage.removeItem('wotc_save_v1');
                window.location.reload();
              } catch {}
            }}
            className="text-xs opacity-60 hover:opacity-90 mt-2"
          >
            Reset cat & settings (last resort)
          </button>
        </div>
        {error?.digest && (
          <div className="text-[10px] opacity-40 mt-4 font-mono">{error.digest}</div>
        )}
      </div>
    </div>
  );
}
