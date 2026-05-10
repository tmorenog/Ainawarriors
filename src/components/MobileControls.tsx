'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onMove: (x: number, y: number) => void;
  onLook: (dx: number, dy: number) => void;
  onSprint: (down: boolean) => void;
  onCrouch: () => void;
  onPounce: () => void;
  onJump: () => void;
}

export function MobileControls({ onMove, onLook, onSprint, onCrouch, onPounce, onJump }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const isCoarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    setVisible(isCoarse);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <Joystick onChange={onMove} className="absolute left-3 bottom-24" />
      <LookPad onChange={onLook} />
      <div className="absolute right-3 bottom-24 flex flex-col gap-2 pointer-events-auto">
        <Btn label="Pounce" onClick={onPounce} />
        <Btn label="Crouch" onClick={onCrouch} />
        <Btn label="Jump" onClick={onJump} />
        <Btn label="Run" onPressChange={onSprint} hold />
      </div>
    </div>
  );
}

function Btn({ label, onClick, hold = false, onPressChange }: { label: string; onClick?: () => void; hold?: boolean; onPressChange?: (down: boolean) => void }) {
  return (
    <button
      onPointerDown={() => { hold ? onPressChange?.(true) : onClick?.(); }}
      onPointerUp={() => hold && onPressChange?.(false)}
      onPointerCancel={() => hold && onPressChange?.(false)}
      className="w-14 h-14 rounded-full bg-black/45 border border-white/15 text-bone text-xs active:bg-thunder/40 select-none"
    >{label}</button>
  );
}

function Joystick({ onChange, className }: { onChange: (x: number, y: number) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const active = useRef(false);
  const center = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const radius = 50;
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
    <div ref={ref} className={`pointer-events-auto w-32 h-32 rounded-full bg-black/30 border border-white/15 ${className ?? ''}`}>
      <div className="absolute" style={{ left: '50%', top: '50%', transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}>
        <div className="w-12 h-12 rounded-full bg-bone/80 border border-white/30" />
      </div>
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
  return <div ref={ref} className="pointer-events-auto absolute right-0 top-0 w-1/2 h-1/2" />;
}
