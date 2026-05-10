'use client';

import { useGameStore } from '@/game/useGameStore';

// Cinematic banner overlay for the Tigerstar fight. Shows a short
// title-card during the 'intro' and 'victory' phases. During 'fighting'
// the banner is hidden and the player has full control.
export function BattleOverlay() {
  const phase = useGameStore((s) => s.battlePhase);
  const tigerHp = useGameStore((s) => s.tigerstarHp);

  if (phase === 'idle' || phase === 'fighting') {
    // While fighting, only show a small static cue at the top of the screen
    // so the player knows they're in combat (Q / F are now offensive).
    if (phase === 'fighting') {
      return (
        <div className="absolute left-1/2 -translate-x-1/2 top-12 z-40 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-thunder/85 text-bone text-[11px] font-display shadow border border-thunder/60">
            ⚔ Battle — Q pounce · F swipe · Tigerstar {tigerHp}/100
          </div>
        </div>
      );
    }
    return null;
  }

  const title = phase === 'intro' ? 'BATTLE!' : 'VICTORY';
  const subtitle = phase === 'intro' ? 'Tigerstar bares his fangs.' : 'Tigerstar walks the Dark Forest.';
  const tone = phase === 'intro' ? '#c64a4a' : '#cdb673';

  return (
    <div className="absolute inset-0 z-50 pointer-events-none grid place-items-center">
      <div
        className="text-center animate-fade-in"
        style={{ textShadow: '0 6px 30px rgba(0,0,0,0.85)' }}
      >
        <div
          className="font-display tracking-[0.4em]"
          style={{ color: tone, fontSize: 'min(18vw, 92px)', lineHeight: 1 }}
        >
          {title}
        </div>
        <div className="font-display text-bone/90 mt-2 text-base md:text-xl italic">
          {subtitle}
        </div>
      </div>
      {/* Soft vignette behind the title */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 60%, rgba(0,0,0,0))',
        }}
      />
    </div>
  );
}
