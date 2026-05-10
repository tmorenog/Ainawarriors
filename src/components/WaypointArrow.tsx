'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { NPCS } from '@/lib/npcs';

// On-screen waypoint marker. The arrow points toward whichever target is
// active — a custom waypoint set on the map takes priority; otherwise the
// Tigerstar mission marker shows up while mission='accepted'. Auto-clears
// the custom waypoint once the player gets within ~6 units of it.
export function WaypointArrow() {
  const mission = useGameStore((s) => s.mission);
  const waypoint = useGameStore((s) => s.waypoint);
  const setWaypoint = useGameStore((s) => s.setWaypoint);
  const [angle, setAngle] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [label, setLabel] = useState('');
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    const target = (() => {
      if (waypoint) return { x: waypoint.x, z: waypoint.z, label: waypoint.label };
      if (mission === 'accepted') return { x: NPCS.tigerstar.pos[0], z: NPCS.tigerstar.pos[2], label: 'Tigerstar' };
      return null;
    })();
    if (!target) {
      setAngle(null);
      return;
    }
    const tick = () => {
      const s = useGameStore.getState();
      const me = s.players[s.selfId];
      if (!me) {
        setAngle(null);
        return;
      }
      const dx = target.x - me.pos[0];
      const dz = target.z - me.pos[2];
      const dist = Math.hypot(dx, dz);
      // Auto-clear the custom waypoint when you've arrived
      if (s.waypoint && dist < 6) {
        s.setWaypoint(null);
        setAngle(null);
        return;
      }
      const a = Math.atan2(dx, -dz);
      setAngle(a);
      setDistance(dist);
      setLabel(target.label);
    };
    tick();
    tickRef.current = window.setInterval(tick, 250);
    return () => {
      if (tickRef.current != null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [mission, waypoint, setWaypoint]);

  if (angle === null) return null;

  const r = 110;
  const offX = Math.cos(angle - Math.PI / 2) * r;
  const offY = Math.sin(angle - Math.PI / 2) * r;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <div
        className="absolute bg-thunder/90 text-bone rounded-full px-2 py-1 text-[10px] font-display shadow-lg border border-thunder/60 flex items-center gap-1 whitespace-nowrap"
        style={{
          left: `calc(50% + ${offX}px)`,
          top: `calc(50% + ${offY}px)`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span style={{ display: 'inline-block', transform: `rotate(${angle}rad)` }}>➤</span>
        <span>{label} · {Math.round(distance)}m</span>
      </div>
    </div>
  );
}
