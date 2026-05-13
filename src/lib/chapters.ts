// Story chapters — loosely inspired by the Warriors books. Each chapter
// holds a title, a one-line subtitle (shown on the chapter card), and a
// quest the player has to complete to advance. The chapter index lives
// in useGameStore; advancing is handled by `advanceChapter()` below.
//
// Chapters are deliberately DRAMATIC and a little theatrical — they're
// the banner moments of the campaign, not the moment-to-moment chores.

export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  quest: string;
  // The store-level "trigger" key that completes this chapter. Game logic
  // calls advanceChapter(id) when the right event fires.
  completeOn: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'into-the-wild',
    title: 'Chapter 1 — Into the Wild',
    subtitle: 'A young cat steps into the forest for the first time.',
    quest: 'Explore your clan camp and meet your warriors.',
    completeOn: 'visit-own-camp',
  },
  {
    id: 'fire-and-ice',
    title: 'Chapter 2 — Fire and Ice',
    subtitle: 'The river runs cold. The clans test their borders.',
    quest: 'Hunt three prey for the fresh-kill pile.',
    completeOn: 'hunt-three',
  },
  {
    id: 'forest-of-secrets',
    title: 'Chapter 3 — Forest of Secrets',
    subtitle: 'Tigerstar moves in the shadows. Whispers fill the trees.',
    quest: 'Accept Firestar\'s mission and confront Tigerstar.',
    completeOn: 'defeat-tigerstar',
  },
  {
    id: 'rising-storm',
    title: 'Chapter 4 — Rising Storm',
    subtitle: 'Lightning over the lake. Greenleaf turns thunderous.',
    quest: 'Survive a disaster — flood, fire, or twolegs.',
    completeOn: 'survive-disaster',
  },
  {
    id: 'a-dangerous-path',
    title: 'Chapter 5 — A Dangerous Path',
    subtitle: 'Firestar is gone. StarClan walk among the trees again.',
    quest: 'Mourn Firestar at the Moonpool.',
    completeOn: 'mourn-firestar',
  },
  {
    id: 'the-darkest-hour',
    title: 'Chapter 6 — The Darkest Hour',
    subtitle: 'Graystripe was taken by twolegs. Find him.',
    quest: 'Search for Graystripe across the territories.',
    completeOn: 'find-graystripe',
  },
  {
    id: 'starlight',
    title: 'Chapter 7 — Starlight',
    subtitle: 'The clans heal. The stars are bright again.',
    quest: 'Return to your camp as the new Warriors.',
    completeOn: 'return-home',
  },
];

export function chapterAt(index: number): Chapter {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, index))];
}
