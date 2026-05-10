'use client';

import type { CatAppearance } from '@/game/types';

export type NpcId = 'firestar' | 'tigerstar';

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

// Both are placed at the front of their clan's camp, slightly off the
// fresh-kill pile so the player can walk up and chat.
// ThunderClan camp center: see CLANS — 'ThunderClan' is at (0, 0, 0)
// ShadowClan camp center: see CLANS — 'ShadowClan' is in the north
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
};
