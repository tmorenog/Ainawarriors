'use client';

import { useState } from 'react';

// Tiny in-game guide for players who haven't read the books. Original
// short summaries — never copies of book prose. Reachable from a small
// 📖 button at the top-right of the HUD.
const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The four clans',
    body:
      'ThunderClan lives in the oak forest — brave and loyal. ShadowClan lives in the pines — secretive and cunning. RiverClan lives by the river — strong swimmers, fond of fish. WindClan lives on the open moor — fastest runners and far-sighted hunters.',
  },
  {
    title: 'The warrior code',
    body:
      'No clan kills another without need. Help kits and elders before yourself. The medicine cat is sacred and never fights. A leader takes their nine lives from StarClan at the Moonpool. The full moon is a truce — every clan walks in peace at Fourtrees.',
  },
  {
    title: 'StarClan',
    body:
      'Spirits of dead warriors who watch over the living. They send dreams, sometimes to warn, sometimes to praise. You can see them as constellations on a clear night.',
  },
  {
    title: 'How to play',
    body:
      'WASD or the joystick to walk. Shift to sprint. C to crouch (stalk). Q to pounce — get close first! F to swipe in battle. E to interact (eat at the pile). V to switch first/third person camera. P to pause.',
  },
  {
    title: 'Hunting',
    body:
      'Crouch to make prey ignore you. Sneak close, then pounce (Q). Drop your catch on the fresh-kill pile in your camp before you eat — that\'s how the warrior code works. Catch a fish only at the river, in RiverClan territory.',
  },
  {
    title: 'Tigerstar',
    body:
      'Speak to Firestar in ThunderClan camp to begin the mission to defeat Tigerstar. Firestar will lead the way. Pounce or swipe him in battle. If you fail, you wake at camp; try again. Win, and Firestar gives you a fresh-kill prize.',
  },
];

export function WarriorsGuide() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 top-12 z-30 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur w-9 h-9 grid place-items-center text-bone text-sm font-display shadow-lg pointer-events-auto border border-white/15"
        title="Warriors guide — for cats new to the books"
        aria-label="Open warriors guide"
      >
        📖
      </button>
    );
  }
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm pointer-events-auto p-6">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-forest-900 border border-thunder/40 shadow-2xl text-bone p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-2xl">A Warriors Guide</div>
          <button onClick={() => setOpen(false)} className="text-xs opacity-60 hover:opacity-100 underline">close</button>
        </div>
        <p className="text-[11px] opacity-70 mb-3">Short summaries for cats who haven&rsquo;t read the books yet.</p>
        <div className="space-y-3">
          {SECTIONS.map((s, i) => (
            <details key={i} className="bg-white/5 rounded-lg p-3 text-sm" open={i === 0}>
              <summary className="cursor-pointer font-display text-base">{s.title}</summary>
              <p className="opacity-90 mt-2 leading-relaxed">{s.body}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
