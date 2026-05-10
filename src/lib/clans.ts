export type ClanId =
  | 'ThunderClan'
  | 'RiverClan'
  | 'ShadowClan'
  | 'WindClan'
  | 'Rogue'
  | 'Loner'
  | 'KittyPet';

export interface ClanInfo {
  id: ClanId;
  name: string;
  motto: string;
  color: string;
  accent: string;
  territory: string;
  prey: string[];
  bonuses: { speed?: number; stealth?: number; strength?: number; fishing?: number; balance?: number };
  campCenter: [number, number, number];
  borderRadius: number;
  scent: string;
}

export const CLANS: Record<ClanId, ClanInfo> = {
  ThunderClan: {
    id: 'ThunderClan',
    name: 'ThunderClan',
    motto: 'Brave and bold beneath the oaks.',
    color: '#b65a2a',
    accent: '#f3c98b',
    territory: 'Oak forest, sandy hollow, sunningrocks.',
    prey: ['mouse', 'squirrel', 'bird'],
    bonuses: { balance: 1.0 },
    campCenter: [0, 0, 0],
    borderRadius: 90,
    scent: 'oak-leaf and warm earth',
  },
  RiverClan: {
    id: 'RiverClan',
    name: 'RiverClan',
    motto: 'Strength flows like water.',
    color: '#3a78a8',
    accent: '#a7d4ee',
    territory: 'Reed-bed islands, willow groves, slow river.',
    prey: ['fish', 'water-vole', 'bird'],
    bonuses: { fishing: 1.5, stamina: 1.1 } as any,
    campCenter: [180, 0, -30],
    borderRadius: 80,
    scent: 'wet reeds and river silt',
  },
  ShadowClan: {
    id: 'ShadowClan',
    name: 'ShadowClan',
    motto: 'Silent paws, sharper claws.',
    color: '#2b2030',
    accent: '#7d6c8a',
    territory: 'Pine marsh, peat bog, deep shade.',
    prey: ['frog', 'lizard', 'mouse'],
    bonuses: { stealth: 1.4 },
    campCenter: [-60, 0, 180],
    borderRadius: 80,
    scent: 'pine resin and marsh moss',
  },
  WindClan: {
    id: 'WindClan',
    name: 'WindClan',
    motto: 'Run with the moor.',
    color: '#cdb673',
    accent: '#fff3b8',
    territory: 'Open moor, gorse tunnels, rabbit warrens.',
    prey: ['rabbit', 'bird'],
    bonuses: { speed: 1.4, stamina: 1.2 } as any,
    campCenter: [-200, 0, 60],
    borderRadius: 90,
    scent: 'heather and open wind',
  },
  Rogue: {
    id: 'Rogue',
    name: 'Rogue',
    motto: 'Loyal to no one but self.',
    color: '#7a3a3a',
    accent: '#c98686',
    territory: 'Anywhere unwatched.',
    prey: ['mouse', 'rat', 'bird'],
    bonuses: { stealth: 1.2, strength: 1.1 },
    campCenter: [120, 0, 220],
    borderRadius: 30,
    scent: 'iron and stale fur',
  },
  Loner: {
    id: 'Loner',
    name: 'Loner',
    motto: 'Walks alone, owes no debt.',
    color: '#6b6051',
    accent: '#cbbfa5',
    territory: 'Edges of every map.',
    prey: ['mouse', 'bird'],
    bonuses: { balance: 0.9 },
    campCenter: [-220, 0, -220],
    borderRadius: 25,
    scent: 'dust and dry grass',
  },
  KittyPet: {
    id: 'KittyPet',
    name: 'Kitty Pet',
    motto: 'Soft cushions, secret dreams.',
    color: '#d99dbf',
    accent: '#fcd7e8',
    territory: 'Twoleg place gardens.',
    prey: ['mouse'],
    bonuses: { stamina: 0.8 } as any,
    campCenter: [240, 0, 220],
    borderRadius: 20,
    scent: 'milk and twoleg-smoke',
  },
};

export const CLAN_LIST = Object.values(CLANS);
