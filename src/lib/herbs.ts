export interface Herb {
  id: string;
  name: string;
  treats: string[];
  notes: string;
  rarity: 'common' | 'uncommon' | 'rare';
  habitat: string;
}

export const HERBS: Herb[] = [
  { id: 'marigold', name: 'Marigold', treats: ['cuts', 'infection'], notes: 'Bright orange flower; chew to a poultice.', rarity: 'common', habitat: 'forest edge' },
  { id: 'cobweb', name: 'Cobweb', treats: ['bleeding'], notes: 'Wrap onto wounds to stop bleeding.', rarity: 'common', habitat: 'old logs' },
  { id: 'poppyseed', name: 'Poppy Seed', treats: ['pain', 'shock'], notes: 'Calming; never give to nursing queens.', rarity: 'uncommon', habitat: 'meadow' },
  { id: 'borage', name: 'Borage', treats: ['fever', 'milk-supply'], notes: 'Star-shaped blue flowers.', rarity: 'uncommon', habitat: 'sunny patches' },
  { id: 'catmint', name: 'Catmint', treats: ['greencough', 'whitecough'], notes: 'Highly prized in leaf-bare.', rarity: 'rare', habitat: 'twoleg gardens' },
  { id: 'tansy', name: 'Tansy', treats: ['cough', 'wounds'], notes: 'Strong sweet scent.', rarity: 'uncommon', habitat: 'forest clearings' },
  { id: 'goldenrod', name: 'Goldenrod', treats: ['stiff-joints', 'wounds'], notes: 'Tall yellow flowers.', rarity: 'common', habitat: 'open ground' },
  { id: 'horsetail', name: 'Horsetail', treats: ['infection'], notes: 'Bristly stalks; chew into pulp.', rarity: 'uncommon', habitat: 'marsh' },
  { id: 'juniper', name: 'Juniper Berries', treats: ['bellyache', 'shortness-of-breath'], notes: 'Dark purple berries.', rarity: 'uncommon', habitat: 'pine slopes' },
  { id: 'thyme', name: 'Thyme', treats: ['shock', 'anxiety'], notes: 'Calms a frightened cat.', rarity: 'common', habitat: 'forest floor' },
];

export const REMEDIES: Record<string, string[]> = {
  cuts: ['marigold', 'cobweb'],
  bleeding: ['cobweb'],
  greencough: ['catmint'],
  whitecough: ['catmint', 'tansy'],
  shock: ['poppyseed', 'thyme'],
  fever: ['borage'],
  bellyache: ['juniper'],
};

export function diagnose(symptom: string): string[] {
  return REMEDIES[symptom] ?? [];
}
