'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onMove: (x: number, y: number) => void;
  onLook: (dx: number, dy: number) => void;
  onSprint: (down: boolean) => void;
  onCrouch: () => void;
  onPounce: () => void;
  onJump: () => void;
  onSwipe: () => void;
}

export function MobileControls({ onMove, onLook, onSprint, onCrouch, onPounce, onJump, onSwipe }: Props) {
  const [coarse, setCoarse] = useState(false);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const isCoarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    setCoarse(isCoarse);
    const t = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(t);
  }, []);

  // On desktop we still want a touch-friendly layout? Keep on-screen
  // Jump/Look buttons everywhere so the controls are always visible.
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {coarse && <Joystick onChange={onMove} className="absolute left-3 bottom-24" />}

      {/* Explicit D-pad — always visible alongside the joystick. Players who
          can't get the joystick to register movement (or who prefer tap
          controls) can use these buttons to walk in cardinal directions. */}
      {coarse && <DPad onMove={onMove} />}

      {/* Look pad covers the right ~60% of the screen on mobile (drag anywhere to look). */}
      {coarse && <LookPad onChange={onLook} />}

      {/* Look hint */}
      {coarse && showHint && (
        <div className="absolute right-4 top-1/3 -translate-y-1/2 text-bone bg-black/45 backdrop-blur rounded-xl px-3 py-2 text-xs pointer-events-none">
          ↻ Drag here to turn / look
        </div>
      )}

      {/* Action buttons — always visible */}
      <div className="absolute right-3 bottom-24 flex flex-col gap-2 pointer-events-auto">
        <Btn label="Jump" onClick={onJump} accent="thunder" />
        <Btn label="Pounce" onClick={onPounce} />
        <Btn label="Swipe" onClick={onSwipe} />
        <Btn label="Crouch" onClick={onCrouch} />
        <Btn label="Run" onPressChange={onSprint} hold />
      </div>

      {/* Desktop look-around helpers (drag the small pad in the corner if pointer-lock is unavailable) */}
      {!coarse && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-auto">
          <DragLookButton onChange={onLook} />
        </div>
      )}
    </div>
  );
}

function Btn({ label, onClick, hold = false, onPressChange, accent }: { label: string; onClick?: () => void; hold?: boolean; onPressChange?: (down: boolean) => void; accent?: 'thunder' }) {
  return (
    <button
      onPointerDown={() => { hold ? onPressChange?.(true) : onClick?.(); }}
      onPointerUp={() => hold && onPressChange?.(false)}
      onPointerCancel={() => hold && onPressChange?.(false)}
      className={`w-16 h-16 rounded-full border border-white/20 text-bone text-xs font-display tracking-wide active:scale-95 transition select-none shadow-lg
        ${accent === 'thunder' ? 'bg-thunder/80 hover:bg-thunder' : 'bg-black/55 hover:bg-black/70'}`}
    >{label}</button>
  );
}

// A simple tap-and-hold D-pad. Each button calls onMove with a fixed unit
// vector while held and (0, 0) on release. We use small absolute positioning
// instead of a flex grid so the buttons can sit comfortably above the
// joystick without overlapping the action buttons on the right.
function DPad({ onMove }: { onMove: (x: number, y: number) => void }) {
  const held = useRef<{ x: number; y: number } | null>(null);
  const press = (vx: number, vy: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    held.current = { x: vx, y: vy };
    onMove(vx, vy);
  };
  const release = (e: React.PointerEvent) => {
    e.preventDefault();
    if (held.current) {
      held.current = null;
      onMove(0, 0);
    }
  };
  const cls = 'pointer-events-auto w-12 h-12 rounded-full bg-black/55 border border-white/20 text-bone text-xl grid place-items-center select-none active:scale-95 transition shadow';
  return (
    <div className="absolute left-44 bottom-28 w-[140px] h-[140px] pointer-events-none">
      <button onPointerDown={press(0, 1)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        className={`${cls} absolute left-1/2 -translate-x-1/2 top-0`}>↑</button>
      <button onPointerDown={press(0, -1)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        className={`${cls} absolute left-1/2 -translate-x-1/2 bottom-0`}>↓</button>
      <button onPointerDown={press(-1, 0)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        className={`${cls} absolute top-1/2 -translate-y-1/2 left-0`}>←</button>
      <button onPointerDown={press(1, 0)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
        className={`${cls} absolute top-1/2 -translate-y-1/2 right-0`}>→</button>
    </div>
  );
}

function Joystick({ onChange, className }: { onChange: (x: number, y: number) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const active = useRef(false);
  const center = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const radius = 56;
    const start = (e: PointerEvent) => {
      active.current = true;
      const r = el.getBoundingClientRect();
      center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      el.setPointerCapture(e.pointerId);
      move(e);
    };
    const move = (e: PointerEvent) => {
      if (!active.current) return;
      let dx = e.clientX - center.current.x;
      let dy = e.clientY - center.current.y;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      setPos({ x: dx, y: dy });
      onChange(dx / radius, -dy / radius);
    };
    const end = () => { active.current = false; setPos({ x: 0, y: 0 }); onChange(0, 0); };
    el.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      el.removeEventListener('pointerdown', start);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onChange]);

  return (
    <div ref={ref} className={`pointer-events-auto w-36 h-36 rounded-full bg-black/40 border-2 border-white/25 backdrop-blur ${className ?? ''}`}>
      <div className="absolute" style={{ left: '50%', top: '50%', transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}>
        <div className="w-14 h-14 rounded-full bg-bone/90 border border-white/30 shadow" />
      </div>
      <div className="absolute inset-0 grid place-items-center text-[10px] text-bone/60 pointer-events-none">move</div>
    </div>
  );
}

function LookPad({ onChange }: { onChange: (dx: number, dy: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let id: number | null = null;
    let last = { x: 0, y: 0 };
    const start = (e: PointerEvent) => { id = e.pointerId; last = { x: e.clientX, y: e.clientY }; el.setPointerCapture(id); };
    const move = (e: PointerEvent) => {
      if (id === null || e.pointerId !== id) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      onChange(dx, dy);
    };
    const end = () => { id = null; };
    el.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      el.removeEventListener('pointerdown', start);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onChange]);
  // Right 60% of screen, top 75% (avoid action buttons)
  return <div ref={ref} className="pointer-events-auto absolute right-0 top-0 w-3/5 h-3/4" />;
}

function DragLookButton({ onChange }: { onChange: (dx: number, dy: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let id: number | null = null;
    let last = { x: 0, y: 0 };
    const start = (e: PointerEvent) => {
      e.stopPropagation();
      id = e.pointerId; last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(id);
    };
    const move = (e: PointerEvent) => {
      if (id === null || e.pointerId !== id) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      onChange(dx, dy);
    };
    const end = () => { id = null; };
    el.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      el.removeEventListener('pointerdown', start);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onChange]);
  return (
    <div
      ref={ref}
      title="Drag to turn / look around"
      className="w-12 h-24 rounded-full bg-black/40 border border-white/15 text-bone text-[10px] grid place-items-center cursor-grab active:cursor-grabbing select-none"
    >
      ↻ look
    </div>
  );
}
