'use client';

import { useEffect, useState } from 'react';

const TUTORIAL_KEY = 'wotc_tutorial_done_v1';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to the forest, little warrior.',
    body:
      'You have crossed the bramble walls into Clan territory. Your paws are small, but the wind is on your side. Let me show you how things are done here.',
  },
  {
    title: 'Move with WASD or the joystick.',
    body:
      'On a keyboard, hold W / A / S / D (or the arrow keys) to walk. On a phone, drag the left thumb-stick. The right side of the screen looks around — your cat will turn to follow your movement, not your camera.',
  },
  {
    title: 'Run, crouch, pounce.',
    body:
      'Hold Shift to sprint (drains stamina). Tap C to crouch low and stalk prey. Tap Q to pounce — get close enough first! Q while crouched is the classic warrior hunt.',
  },
  {
    title: 'Eat. Sleep. Survive.',
    body:
      'Hunger drops as you run. Catch prey, then drop it onto the fresh-kill pile at the centre of your camp. Resting near the warriors\' den restores health. Hunger zero is dangerous — StarClan does not take kindly to needless deaths.',
  },
  {
    title: 'Try Book Mode.',
    body:
      'Tap the 📖 button on the right edge to enter Book Mode. Each chapter gives you a small in-game objective and tells a story. You can choose to read it yourself, or let the wind read it to you.',
  },
  {
    title: 'Stuck? Just press X.',
    body:
      'Press X on a keyboard, or tap the round "?" button on the right of the screen, to bring this hint screen back any time.',
  },
];

export function Tutorial() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const done = localStorage.getItem(TUTORIAL_KEY) === '1';
      if (!done) setOpen(true);
    } catch {}
  }, []);

  // Press X (or ?) on a keyboard to toggle the hint screen. Listen on
  // both keydown directly AND a window-level "wotc-hint-toggle" custom
  // event — useControls dispatches that too, so this still works if
  // focus is on a weird element where keydown wouldn't bubble normally.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'x' || k === '?') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)) return;
        setOpen((v) => !v);
      }
    };
    const onCustom = () => setOpen((v) => !v);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wotc-hint-toggle', onCustom);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wotc-hint-toggle', onCustom);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch {}
  };

  if (!open) {
    return (
      <button
        onClick={() => { setStep(0); setOpen(true); }}
        className="absolute right-3 top-24 z-30 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur w-9 h-9 grid place-items-center text-bone text-sm font-display shadow-lg pointer-events-auto border border-white/15"
        title="Hint / tutorial — press X on a keyboard"
        aria-label="Show hints"
      >
        ?
      </button>
    );
  }

  const s = STEPS[step];
  const last = step >= STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm pointer-events-auto p-6">
      <div className="max-w-md w-full bg-forest-900 border border-thunder/40 rounded-2xl p-5 text-bone shadow-2xl animate-fade-in">
        <div className="text-[10px] uppercase tracking-[0.5em] opacity-60 mb-2">
          {step + 1} / {STEPS.length}
        </div>
        <h2 className="font-display text-2xl mb-2">{s.title}</h2>
        <p className="text-sm opacity-90 leading-relaxed mb-4">{s.body}</p>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="rounded-lg border border-white/20 hover:bg-white/5 px-3 py-1.5 text-xs"
            >
              Back
            </button>
          )}
          <button
            onClick={dismiss}
            className="ml-auto rounded-lg text-xs opacity-60 hover:opacity-100 px-2"
          >
            Skip
          </button>
          <button
            onClick={() => last ? dismiss() : setStep(step + 1)}
            className="rounded-lg bg-thunder hover:bg-thunder/90 px-4 py-1.5 text-xs font-display"
          >
            {last ? 'Into the forest →' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
