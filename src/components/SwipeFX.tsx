'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';

// Brief diagonal claw-mark slash that flashes whenever the player attacks
// (pounce, swipe, or bite). Driven by a timestamp on the store — every
// time triggerSwipeFx() is called we mount the slash for ~250ms then fade.
export function SwipeFX() {
  const at = useGameStore((s) => s.swipeFlashAt);
  const kind = useGameStore((s) => s.swipeFlashKind);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!at) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 320);
    return () => clearTimeout(id);
  }, [at]);

  if (!visible) return null;

  // Three claw-marks, mirrored slightly per attack kind so pounce and swipe
  // look distinct. Bite is a smaller, lower flash.
  const tilt = kind === 'pounce' ? -28 : kind === 'swipe' ? 16 : -8;
  const length = kind === 'bite' ? 38 : 70;
  const baseColor = kind === 'bite' ? '#ffe1c2' : '#ffffff';

  return (
    <div className="absolute inset-0 z-[55] pointer-events-none overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: `${(i - 1) * 28}px`,
              left: `${-length / 2}vw`,
              width: `${length}vw`,
              height: '6px',
              borderRadius: '999px',
              background: `linear-gradient(90deg, transparent 0%, ${baseColor} 40%, ${baseColor} 60%, transparent 100%)`,
              opacity: 0.85,
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))',
              animation: 'wotcSlash 320ms ease-out forwards',
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes wotcSlash {
          0%   { transform: scaleX(0.2); opacity: 0; }
          25%  { transform: scaleX(1.05); opacity: 1; }
          100% { transform: scaleX(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
