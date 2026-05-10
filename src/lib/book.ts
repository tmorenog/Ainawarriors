// Book Mode — story chapters loosely inspired by Erin Hunter's Warriors:
// "Into the Wild" (Book 1). The text here is original short paraphrasing so we
// don't ship copyrighted prose. Each chapter has an in-game objective the
// player can complete with normal gameplay actions (catch prey, gather herbs,
// sleep, walk near a clan camp, etc.).

export type BookObjectiveKind =
  | 'visit-clan'        // walk near a given clan's camp
  | 'catch-any'         // catch any prey
  | 'catch-kind'        // catch a specific prey kind
  | 'gather-herbs'      // gather N herbs
  | 'sleep'             // trigger the sleep cutscene
  | 'free';             // narrative-only, advance with the "Continue" button

export interface BookObjective {
  kind: BookObjectiveKind;
  target?: string;
  count?: number;
  progress?: number;
}

export interface BookChapter {
  id: string;
  title: string;
  text: string;
  objective: BookObjective;
}

export const BOOK_CHAPTERS: BookChapter[] = [
  {
    id: 'ch1',
    title: 'Chapter 1 — A Twoleg Kit',
    text:
      'A young housecat named Rusty has been dreaming of the forest beyond the garden fence. Tonight the dream feels louder. The wind smells of pine, and something inside him wants to answer.',
    objective: { kind: 'free' },
  },
  {
    id: 'ch2',
    title: 'Chapter 2 — Beyond the Fence',
    text:
      'You slip between the wooden slats and into the trees for the first time. The shadows are deeper than you expected. Find your bearings — head toward a clan camp and listen for warrior cats nearby.',
    objective: { kind: 'visit-clan', target: 'ThunderClan' },
  },
  {
    id: 'ch3',
    title: 'Chapter 3 — Your First Catch',
    text:
      'A warrior is watching. They will not speak to you until you can feed yourself. Crouch low, stalk quietly, and pounce on the first piece of prey that crosses your path.',
    objective: { kind: 'catch-any' },
  },
  {
    id: 'ch4',
    title: 'Chapter 4 — Bluestar’s Offer',
    text:
      'The leader of ThunderClan sees something in you. They offer a place in the clan, but warn that the path of a warrior is hard. Accept, and your apprentice training begins.',
    objective: { kind: 'free' },
  },
  {
    id: 'ch5',
    title: 'Chapter 5 — The Hunter',
    text:
      'A real warrior brings prey for the elders, not for themselves. Catch a mouse for the fresh-kill pile.',
    objective: { kind: 'catch-kind', target: 'mouse' },
  },
  {
    id: 'ch6',
    title: 'Chapter 6 — The Medicine Den',
    text:
      'Spottedleaf needs herbs for the queens. Comb the undergrowth and gather three useful plants.',
    objective: { kind: 'gather-herbs', count: 3 },
  },
  {
    id: 'ch7',
    title: 'Chapter 7 — A Warrior’s Rest',
    text:
      'Even warriors must dream. Curl up under the warriors’ oak and sleep — StarClan often speaks loudest in stillness.',
    objective: { kind: 'sleep' },
  },
  {
    id: 'ch8',
    title: 'Chapter 8 — Shadows on the Border',
    text:
      'ShadowClan scent is on our markers. Patrol the border by their camp and let them know ThunderClan is watching.',
    objective: { kind: 'visit-clan', target: 'ShadowClan' },
  },
  {
    id: 'ch9',
    title: 'Chapter 9 — Into the Wild',
    text:
      'You are no longer a kittypet, no longer just an apprentice. You are a warrior of ThunderClan, and the forest belongs to those who can run with it. Run.',
    objective: { kind: 'free' },
  },
];
