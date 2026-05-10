'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { NPCS } from '@/lib/npcs';

// On-screen waypoint marker that shows where Tigerstar is once Firestar has
// given you the mission. Renders an arrow at the edge of the screen pointing
// toward his world position, so you can't get lost on the way to ShadowClan.
// Disappears once the mission is won.
export function WaypointArrow() {
  const mission = useGameStore((s) => s.mission);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const [angle, setAngle] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (mission !== 'accepted') {
      setAngle(null);
      return;
    }
    const tick = () => {
      const me = useGameStore.getState().players[useGameStore.getState().selfId];
      if (!me) {
        setAngle(null);
        return;
      }
      const tx = NPCS.tigerstar.pos[0];
      const tz = NPCS.tigerstar.pos[2];
      const dx = tx - me.pos[0];
      const dz = tz - me.pos[2];
      const dist = Math.hypot(dx, dz);
      // Convert world-space dx/dz into a screen-relative angle.
      // We don't know the camera yaw from here cheaply, but a top-down angle
      // is good enough to nudge the player roughly the right way.
      const a = Math.atan2(dx, -dz); // 0 = north, +π/2 = east (top-down map)
      setAngle(a);
      setDistance(dist);
    };
    tick();
    tickRef.current = window.setInterval(tick, 250);
    return () => {
      if (tickRef.current != null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [mission, players, selfId]);

  if (mission !== 'accepted' || angle === null) return null;

  // Place the arrow on a circle in screen space, indicating compass bearing.
  const r = 110;
  const cx = 50; // centre %
  const cy = 50;
  const offX = Math.cos(angle - Math.PI / 2) * r;
  const offY = Math.sin(angle - Math.PI / 2) * r;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <div
        className="absolute bg-thunder/90 text-bone rounded-full px-2 py-1 text-[10px] font-display shadow-lg border border-thunder/60 flex items-center gap-1"
        style={{
          left: `calc(${cx}% + ${offX}px)`,
          top: `calc(${cy}% + ${offY}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span style={{ display: 'inline-block', transform: `rotate(${angle}rad)` }}>➤</span>
        <span>Tigerstar · {Math.round(distance)}m</span>
      </div>
    </div>
  );
}
