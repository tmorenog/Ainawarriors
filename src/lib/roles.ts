export type RoleId =
  | 'Kit'
  | 'Apprentice'
  | 'Warrior'
  | 'MedicineCatApprentice'
  | 'MedicineCat'
  | 'Deputy'
  | 'Leader'
  | 'Elder'
  | 'KittyPet'
  | 'Rogue'
  | 'Loner';

export interface RoleInfo {
  id: RoleId;
  label: string;
  duties: string[];
  abilities: string[];
  canHunt: boolean;
  canFight: boolean;
  canHeal: boolean;
  canCommand: boolean;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  Kit: {
    id: 'Kit',
    label: 'Kit',
    duties: ['Stay near the nursery', 'Listen to elders'],
    abilities: ['Play', 'Pounce on moss-balls'],
    canHunt: false,
    canFight: false,
    canHeal: false,
    canCommand: false,
  },
  Apprentice: {
    id: 'Apprentice',
    label: 'Apprentice',
    duties: ['Train with mentor', 'Care for elders'],
    abilities: ['Hunt', 'Spar', 'Patrol with mentor'],
    canHunt: true,
    canFight: true,
    canHeal: false,
    canCommand: false,
  },
  Warrior: {
    id: 'Warrior',
    label: 'Warrior',
    duties: ['Defend the clan', 'Hunt for the clan'],
    abilities: ['Hunt', 'Fight', 'Mentor', 'Lead a patrol'],
    canHunt: true,
    canFight: true,
    canHeal: false,
    canCommand: false,
  },
  MedicineCatApprentice: {
    id: 'MedicineCatApprentice',
    label: 'Medicine Cat Apprentice',
    duties: ['Learn herbs', 'Tend the wounded'],
    abilities: ['Gather herbs', 'Apply remedies (basic)'],
    canHunt: false,
    canFight: false,
    canHeal: true,
    canCommand: false,
  },
  MedicineCat: {
    id: 'MedicineCat',
    label: 'Medicine Cat',
    duties: ['Heal the clan', 'Receive omens', 'Travel to Moonpool'],
    abilities: ['Diagnose', 'Mix remedies', 'Receive prophecies'],
    canHunt: false,
    canFight: false,
    canHeal: true,
    canCommand: false,
  },
  Deputy: {
    id: 'Deputy',
    label: 'Deputy',
    duties: ['Organize patrols', 'Support leader'],
    abilities: ['Hunt', 'Fight', 'Assign patrols', 'Moderate clan'],
    canHunt: true,
    canFight: true,
    canHeal: false,
    canCommand: true,
  },
  Leader: {
    id: 'Leader',
    label: 'Leader',
    duties: ['Guide the clan', 'Speak with StarClan'],
    abilities: ['Promote', 'Declare war', 'Call gatherings', 'Assign apprentices'],
    canHunt: true,
    canFight: true,
    canHeal: false,
    canCommand: true,
  },
  Elder: {
    id: 'Elder',
    label: 'Elder',
    duties: ['Tell tales', 'Advise the leader'],
    abilities: ['Storyteller bonus to clan reputation'],
    canHunt: false,
    canFight: false,
    canHeal: false,
    canCommand: false,
  },
  KittyPet: {
    id: 'KittyPet',
    label: 'Kitty Pet',
    duties: ['Greet twolegs', 'Nap on cushions'],
    abilities: ['Soft paws (stealth in gardens)'],
    canHunt: false,
    canFight: false,
    canHeal: false,
    canCommand: false,
  },
  Rogue: {
    id: 'Rogue',
    label: 'Rogue',
    duties: ['Survive on your own'],
    abilities: ['Hunt', 'Fight'],
    canHunt: true,
    canFight: true,
    canHeal: false,
    canCommand: false,
  },
  Loner: {
    id: 'Loner',
    label: 'Loner',
    duties: ['Wander the edges'],
    abilities: ['Hunt', 'Survive'],
    canHunt: true,
    canFight: false,
    canHeal: false,
    canCommand: false,
  },
};

export const ROLE_LIST = Object.values(ROLES);

export function defaultRoleForClan(clan: string): RoleId {
  if (clan === 'KittyPet') return 'KittyPet';
  if (clan === 'Rogue') return 'Rogue';
  if (clan === 'Loner') return 'Loner';
  return 'Warrior';
}
