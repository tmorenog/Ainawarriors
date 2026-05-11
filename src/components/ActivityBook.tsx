'use client';

import { useState } from 'react';

// "What can I actually do?" reference — different from the rotating task
// board, different from the Warriors Guide. This is a flat list of every
// activity the game supports, grouped by theme, so a player who picks the
// game up cold knows the full menu.

interface Section {
  title: string;
  emoji: string;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'Hunting & survival',
    emoji: '🐾',
    items: [
      'Stalk prey by crouching (C), then pounce (Q).',
      'Catch mice, voles, shrews, rabbits, squirrels, frogs, sparrows, blackbirds, birds.',
      'Fish in the RiverClan river — 🐟 Fish button shows up at the bank.',
      'Gather herbs (sometimes you find nothing).',
      'Use a herb from your pouch to heal when you\'re hurt.',
      'Sleep at a den to recover stamina and HP — full sleep cinematic plays.',
      'Eat from the fresh-kill pile (E key, or tap the floating eat button) — must contribute first.',
    ],
  },
  {
    title: 'Exploring the territory',
    emoji: '🌳',
    items: [
      'Open the 🗺 map and tap anywhere to drop a waypoint.',
      'Patrol each clan border — ThunderClan, RiverClan, ShadowClan, WindClan.',
      'Climb to the top of your High Rock (jump up onto it from camp).',
      'Cross the river to the other bank.',
      'Visit the Twoleg place at the edge of the map.',
      'Find the Moonpool — and stand in it at night for a reputation boost.',
      'Walk along the river bank for a quick reward.',
    ],
  },
  {
    title: 'Camp life',
    emoji: '🏠',
    items: [
      'Drop your prey on the fresh-kill pile (Drop button).',
      'Stand near the training post in camp to slowly recharge stamina.',
      'Pop into the Leader / Warriors / Medicine / Nursery / Elders\' / Apprentices\' dens.',
      'Tap "Sleep at den" any time of day; the camera orbits the cat as it loafs, curls, sleeps, then wakes at dawn.',
    ],
  },
  {
    title: 'Battle',
    emoji: '⚔',
    items: [
      'Pounce (Q) — heavy hit (18 hp). Swipe (F or B) — quick hit (10 hp).',
      'Defeat Tigerstar in single combat (Firestar leads you to him).',
      'Defend your camp when raiders attack — your Declare Battle button summons them.',
      'You CAN lose — if your HP hits zero in combat, StarClan claims you and you respawn at camp.',
    ],
  },
  {
    title: 'Spirit & dreams',
    emoji: '🌟',
    items: [
      'Sometimes a dead clanmate sends you a dream while you sleep — warnings or prophecies of greatness.',
      'Look up at night — you can see clan warriors in the stars as faint constellations.',
      'Walk into the Moonpool at midnight for StarClan\'s blessing.',
    ],
  },
  {
    title: 'Social',
    emoji: '💬',
    items: [
      'Chat with other tabs / players — open the 💬 panel.',
      'Type "purr", "hiss", "meow", "ear flick", or "tail flick" and you\'ll perform the action AND say the sound.',
      'Talk to Firestar, Tigerstar (before he falls), Blackstar (after), Leopardstar, or Tallstar — say anything, they\'ll reply.',
      'Send and receive private nearby/clan chat.',
    ],
  },
  {
    title: 'Leader actions (when you\'re a leader)',
    emoji: '★',
    items: [
      '📣 Type an announcement from the High Rock — broadcast to your clan.',
      '⚔ Declare battle on a rival — 3 raiders march on your camp.',
      'Organize hunting / border patrols.',
      'Call a Gathering at Fourtrees.',
      'Promote, appoint deputy, or assign apprentices.',
    ],
  },
  {
    title: 'Special events',
    emoji: '🌕',
    items: [
      'Once a "month" the four clans meet at Fourtrees under the full moon — talk to every leader there.',
      'Random disasters (~rare) — twoleg invasion, river flood, forest fire. Survive them for reputation.',
      'Whispers between clans — overhear rumors and rude clanmate banter every minute or so.',
      'Rotating tasks (⛰ Tasks panel) — three live goals that auto-complete as you play.',
      'Book Mode (📖 button on the right edge) — narrative campaign with chapters.',
    ],
  },
  {
    title: 'Make your cat your own',
    emoji: '🎨',
    items: [
      'Choose fur, belly, pattern, ear shape, tail, fluffiness, build, height, size.',
      'Pupil size slider — tiny pinprick to wide-blown.',
      'Vision options — normal, half-blind, fully blind (each has a visible effect in-game).',
      'Toggle night vision.',
      'Add scars, change name prefix / suffix, pick voice pitch.',
    ],
  },
];

export function ActivityBook() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 top-[150px] z-30 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur w-9 h-9 grid place-items-center text-bone text-sm shadow-lg pointer-events-auto border border-white/15"
        title="Activity Book — everything you can do"
        aria-label="Open activity book"
      >
        📕
      </button>
    );
  }
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm pointer-events-auto p-6">
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-forest-900 border border-thunder/40 shadow-2xl text-bone p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-2xl">📕 Activity Book</div>
          <button onClick={() => setOpen(false)} className="text-xs opacity-60 hover:opacity-100 underline">close</button>
        </div>
        <p className="text-[11px] opacity-70 mb-3">
          Everything you can do for fun in the forest — tap a section to expand.
        </p>
        <div className="space-y-2">
          {SECTIONS.map((s, i) => (
            <details key={i} className="bg-white/5 rounded-lg p-3" open={i === 0}>
              <summary className="cursor-pointer font-display text-base flex items-center gap-2">
                <span className="text-lg">{s.emoji}</span>
                <span>{s.title}</span>
              </summary>
              <ul className="opacity-90 mt-2 space-y-1 text-sm list-disc list-inside leading-relaxed">
                {s.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
