'use client';

// Rotating ambient quest system. Three random tasks are active at any time,
// each tracking real in-game progress (catches, herbs, distance walked,
// camp visits, pounce streaks, etc). Completing one rolls a fresh task into
// its slot so there's always something to do — no clicking "accept quest".

export type TaskKind =
  | 'catch-any-n'
  | 'catch-mouse-n'
  | 'catch-fish-n'
  | 'gather-herbs-n'
  | 'visit-clan'
  | 'sleep'
  | 'walk-distance'
  | 'pounce-streak'
  | 'use-herb-n';

export interface Task {
  id: string;
  kind: TaskKind;
  target?: string;       // for visit-clan
  goal: number;          // amount needed
  progress: number;
  reward: { hunger?: number; hp?: number; rep?: number };
  description: string;
}

const CLAN_NAMES = ['ThunderClan', 'RiverClan', 'ShadowClan', 'WindClan'] as const;

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let _seq = 0;
function newId() { return 'task_' + (++_seq) + '_' + Math.random().toString(36).slice(2, 6); }

export function generateTask(): Task {
  const k = rand([
    'catch-any-n', 'catch-any-n',          // weight catches a bit
    'catch-mouse-n', 'catch-fish-n',
    'gather-herbs-n', 'gather-herbs-n',
    'visit-clan', 'sleep',
    'walk-distance', 'pounce-streak',
    'use-herb-n',
  ] as const);

  switch (k) {
    case 'catch-any-n': {
      const goal = 1 + Math.floor(Math.random() * 3); // 1..3
      return {
        id: newId(), kind: k, goal, progress: 0,
        reward: { hunger: 8 + goal * 4, rep: 1 },
        description: `Catch ${goal} piece${goal === 1 ? '' : 's'} of prey`,
      };
    }
    case 'catch-mouse-n': {
      const goal = 1 + Math.floor(Math.random() * 2);
      return {
        id: newId(), kind: k, goal, progress: 0,
        reward: { hunger: 10, rep: 1 },
        description: `Catch ${goal} mouse for the elders`,
      };
    }
    case 'catch-fish-n': {
      return {
        id: newId(), kind: k, goal: 1, progress: 0,
        reward: { hunger: 15, rep: 2 },
        description: 'Catch a fish from the river',
      };
    }
    case 'gather-herbs-n': {
      const goal = 2 + Math.floor(Math.random() * 3);
      return {
        id: newId(), kind: k, goal, progress: 0,
        reward: { hp: 8, rep: 1 },
        description: `Gather ${goal} herbs for the medicine cat`,
      };
    }
    case 'visit-clan': {
      const target = rand(CLAN_NAMES);
      return {
        id: newId(), kind: k, target, goal: 1, progress: 0,
        reward: { rep: 2 },
        description: `Patrol the ${target} border`,
      };
    }
    case 'sleep': {
      return {
        id: newId(), kind: k, goal: 1, progress: 0,
        reward: { hp: 20 },
        description: 'Curl up and rest at camp — StarClan may speak to you',
      };
    }
    case 'walk-distance': {
      const goal = 60 + Math.floor(Math.random() * 80); // 60..140 units
      return {
        id: newId(), kind: k, goal, progress: 0,
        reward: { rep: 1 },
        description: `Walk ${goal} paw-lengths through the territory`,
      };
    }
    case 'pounce-streak': {
      const goal = 2 + Math.floor(Math.random() * 2);
      return {
        id: newId(), kind: k, goal, progress: 0,
        reward: { hunger: 20, rep: 2 },
        description: `Land ${goal} pounces in a row without missing`,
      };
    }
    case 'use-herb-n': {
      return {
        id: newId(), kind: k, goal: 1, progress: 0,
        reward: { hp: 12 },
        description: 'Use a herb from your pouch on yourself',
      };
    }
  }
}

export function generateTaskBoard(n = 3): Task[] {
  return Array.from({ length: n }, () => generateTask());
}
