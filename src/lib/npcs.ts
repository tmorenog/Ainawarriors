'use client';

import type { CatAppearance } from '@/game/types';

export type NpcId = 'firestar' | 'tigerstar' | 'leopardstar' | 'tallstar';

export interface NpcDef {
  id: NpcId;
  cat: CatAppearance;
  // World position chosen near each clan's camp (see CLANS in lib/clans.ts).
  pos: [number, number, number];
  greeting: string;
  // What you can ask / say to them.
  options: { label: string; result: 'accept-battle' | 'goodbye' | 'engage' }[];
}

// Procedural cat appearance per character — these are fed straight into the
// existing <Cat cat={...}/> component so they render with the same proc-gen
// rig as the player.
const FIRESTAR_CAT: CatAppearance = {
  id: 'npc_firestar',
  name: 'Firestar',
  prefix: 'Fire',
  suffix: 'star',
  furBase: '#cf6a2a',
  furBelly: '#f1d2a8',
  furPattern: 'tabby',
  patternColor: '#9a4118',
  patternColor2: '#cf6a2a',
  patternColor3: '#f1d2a8',
  eyeColor: 'green',
  earShape: 'standard',
  tail: 'long',
  fluffiness: 0.45,
  size: 'medium',
  height: 1.05,
  build: 1.0,
  scars: [],
  blush: false,
  clan: 'ThunderClan',
  role: 'Leader',
  bubbleStyle: 'classic',
  voicePitch: 0.95,
  pupilSize: 0.55,
  vision: 'normal',
  nightVision: false,
};

const TIGERSTAR_CAT: CatAppearance = {
  id: 'npc_tigerstar',
  name: 'Tigerstar',
  prefix: 'Tiger',
  suffix: 'star',
  furBase: '#5a3a1a',
  furBelly: '#7a5a3a',
  furPattern: 'tabby',
  patternColor: '#1c0d04',
  patternColor2: '#3a2410',
  patternColor3: '#7a5a3a',
  eyeColor: 'amber',
  earShape: 'standard',
  tail: 'long',
  fluffiness: 0.55,
  size: 'massive',
  height: 1.2,
  build: 1.18,
  scars: ['flank', 'shoulder', 'left-eye'],
  blush: false,
  clan: 'ShadowClan',
  role: 'Leader',
  bubbleStyle: 'stone',
  voicePitch: 0.65,
  pupilSize: 0.35,
  vision: 'normal',
  nightVision: true,
};

const LEOPARDSTAR_CAT: CatAppearance = {
  id: 'npc_leopardstar',
  name: 'Leopardstar',
  prefix: 'Leopard',
  suffix: 'star',
  furBase: '#c8a85e',
  furBelly: '#e8d8a4',
  furPattern: 'spotted',
  patternColor: '#3a2a18',
  patternColor2: '#7a5a30',
  patternColor3: '#c8a85e',
  eyeColor: 'amber',
  earShape: 'standard',
  tail: 'long',
  fluffiness: 0.4,
  size: 'large',
  height: 1.05,
  build: 1.05,
  scars: [],
  blush: false,
  clan: 'RiverClan',
  role: 'Leader',
  bubbleStyle: 'cloud',
  voicePitch: 1.0,
  pupilSize: 0.45,
  vision: 'normal',
  nightVision: false,
};

const TALLSTAR_CAT: CatAppearance = {
  id: 'npc_tallstar',
  name: 'Tallstar',
  prefix: 'Tall',
  suffix: 'star',
  furBase: '#1a1a1a',
  furBelly: '#f4f1ea',
  furPattern: 'bicolor',
  patternColor: '#1a1a1a',
  patternColor2: '#f4f1ea',
  patternColor3: '#aaaaaa',
  eyeColor: 'amber',
  earShape: 'standard',
  tail: 'long',
  fluffiness: 0.35,
  size: 'large',
  height: 1.15,
  build: 0.92,
  scars: [],
  blush: false,
  clan: 'WindClan',
  role: 'Leader',
  bubbleStyle: 'leaf',
  voicePitch: 0.9,
  pupilSize: 0.5,
  vision: 'normal',
  nightVision: true,
};

// World location of the full-moon Gathering (Fourtrees-style clearing). All
// four clan leaders converge here while clanGathering is true. Picked away
// from any single camp so it feels neutral.
export const GATHERING_POS: [number, number, number] = [-100, 0, -90];

// Each leader's seat at the Gathering — small radial offsets so they don't
// stack on top of each other.
export const GATHERING_SEATS: Record<NpcId, [number, number]> = {
  firestar:    [-2, -2],
  tigerstar:   [ 2, -2],
  leopardstar: [-2,  2],
  tallstar:    [ 2,  2],
};

export const NPCS: Record<NpcId, NpcDef> = {
  firestar: {
    id: 'firestar',
    cat: FIRESTAR_CAT,
    pos: [3, 0, 1],
    greeting:
      'Welcome, young warrior. ShadowClan is led by Tigerstar now — a cat with claws steeped in blood. He must be stopped, or every clan will fall. Will you ride with me to challenge him?',
    options: [
      { label: 'I will fight by your side.', result: 'accept-battle' },
      { label: 'Not today.', result: 'goodbye' },
    ],
  },
  tigerstar: {
    id: 'tigerstar',
    cat: TIGERSTAR_CAT,
    // Moved well forward of ShadowClan camp toward the ThunderClan border
    // so the player doesn't have to slog across the whole map for the
    // mission. ~55 forest-units north-east of ThunderClan camp at (0,0,0).
    pos: [-20, 0, 50],
    greeting:
      'You smell of ThunderClan blood. Run home, kit, before I tear out your throat. Or stay — and I will make you part of the forest floor.',
    options: [
      { label: 'Then taste my claws!', result: 'engage' },
      { label: '…Run.', result: 'goodbye' },
    ],
  },
  leopardstar: {
    id: 'leopardstar',
    cat: LEOPARDSTAR_CAT,
    pos: [180, 0, -28], // RiverClan camp
    greeting:
      'RiverClan greets you, traveller. The river runs full this season — we have prey enough to share. What brings you to our reeds?',
    options: [
      { label: 'StarClan light your path, Leopardstar.', result: 'goodbye' },
    ],
  },
  tallstar: {
    id: 'tallstar',
    cat: TALLSTAR_CAT,
    pos: [-198, 0, 62], // WindClan camp
    greeting:
      'The wind brought your scent before you. WindClan holds the moor — be careful where your paws fall, kin of trees.',
    options: [
      { label: 'May your hunt be swift, Tallstar.', result: 'goodbye' },
    ],
  },
};
