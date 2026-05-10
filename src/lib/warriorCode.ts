export interface WarriorCodeRule {
  id: number;
  text: string;
  category: 'loyalty' | 'borders' | 'mentorship' | 'medicine' | 'hunting' | 'leaders';
  reputationLossOnBreak: number;
}

export const WARRIOR_CODE: WarriorCodeRule[] = [
  { id: 1, text: 'Defend your clan, even with your life. Place loyalty above all.', category: 'loyalty', reputationLossOnBreak: 25 },
  { id: 2, text: 'Do not hunt or trespass on another clan’s territory.', category: 'borders', reputationLossOnBreak: 15 },
  { id: 3, text: 'Elders, queens, and kits must be fed before apprentices and warriors.', category: 'hunting', reputationLossOnBreak: 8 },
  { id: 4, text: 'Prey is killed only to be eaten. Give thanks to StarClan.', category: 'hunting', reputationLossOnBreak: 10 },
  { id: 5, text: 'A kit must be at least six moons old to be an apprentice.', category: 'mentorship', reputationLossOnBreak: 6 },
  { id: 6, text: 'Newly appointed warriors keep silent vigil for one night.', category: 'mentorship', reputationLossOnBreak: 4 },
  { id: 7, text: 'A cat cannot be made deputy without having mentored an apprentice.', category: 'leaders', reputationLossOnBreak: 5 },
  { id: 8, text: 'The deputy will become leader when the leader dies, retires, or steps down.', category: 'leaders', reputationLossOnBreak: 10 },
  { id: 9, text: 'A new deputy must be chosen before moonhigh after the previous deputy leaves.', category: 'leaders', reputationLossOnBreak: 6 },
  { id: 10, text: 'A gathering at the full moon is held in truce. No fighting.', category: 'borders', reputationLossOnBreak: 20 },
  { id: 11, text: 'Boundaries must be checked and marked daily.', category: 'borders', reputationLossOnBreak: 4 },
  { id: 12, text: 'No warrior may neglect a kit in pain or danger, even from another clan.', category: 'loyalty', reputationLossOnBreak: 12 },
  { id: 13, text: 'The word of the clan leader is the warrior code.', category: 'leaders', reputationLossOnBreak: 8 },
  { id: 14, text: 'A warrior rejects the soft life of a kittypet.', category: 'loyalty', reputationLossOnBreak: 5 },
  { id: 15, text: 'A medicine cat must do no harm and serve all clans at the Moonpool.', category: 'medicine', reputationLossOnBreak: 18 },
];

export interface CodeViolation {
  ruleId: number;
  at: number;
  detail?: string;
}

export function applyViolation(reputation: number, ruleId: number): number {
  const rule = WARRIOR_CODE.find((r) => r.id === ruleId);
  if (!rule) return reputation;
  return Math.max(0, reputation - rule.reputationLossOnBreak);
}
