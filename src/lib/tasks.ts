'use client';

// Rotating ambient quest system. Three random tasks are active at any time,
// each tracking real in-game progress (catches, herbs, distance walked,
// camp visits, pounce streaks, etc). Completing one rolls a fresh task into
// its slot so there's always something to do — no clicking "accept quest".

export type TaskKind =
  | 'catch-any-n'
  | 'catch-mouse-n'
  | 'catch-fish-n'
  | 'catch-rabbit-n'
  | 'catch-vole-n'
  | 'catch-bird-n'
  | 'catch-squirrel-n'
  | 'catch-frog-n'
  | 'gather-herbs-n'
  | 'visit-clan'
  | 'visit-moonpool'
  | 'climb-rock'
  | 'sleep'
  | 'walk-distance'
  | 'pounce-streak'
  | 'use-herb-n'
  | 'drop-pile-n'
  | 'eat-pile-n'
  | 'emote-n'
  | 'jump-n'
  | 'sprint-distance'
  | 'accept-mission'
  | 'defeat-tigerstar'
  | 'use-waypoint';

export interface Task {
  id: string;
  kind: TaskKind;
  target?: string;
  goal: number;
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
  // Each entry is a generator; we pick one randomly. Some generators emit
  // tweakable goals so the same kind can show up with different numbers.
  const generators: Array<() => Task> = [
    // ── catches by kind ──────────────────────────────────────────────
    () => {
      const goal = 1 + Math.floor(Math.random() * 3); // 1..3
      const flavours = [
        `Catch ${goal} piece${goal === 1 ? '' : 's'} of prey`,
        `Bring ${goal} fresh-kill back to camp`,
        `Hunt ${goal} for the elders before sundown`,
        `Make ${goal} clean catch${goal === 1 ? '' : 'es'} this day`,
      ];
      return { id: newId(), kind: 'catch-any-n', goal, progress: 0,
        reward: { hunger: 8 + goal * 4, rep: 1 },
        description: rand(flavours) };
    },
    () => ({ id: newId(), kind: 'catch-mouse-n', goal: 1 + Math.floor(Math.random() * 2), progress: 0,
      reward: { hunger: 10, rep: 1 },
      description: rand(['Catch a mouse for the elders', 'Find a mouse — the queens are hungry', 'Catch 2 mice on a moonlit hunt']) }),
    () => ({ id: newId(), kind: 'catch-fish-n', goal: 1, progress: 0,
      reward: { hunger: 15, rep: 2 },
      description: rand(['Catch a fish from the river', 'Crouch over the river bank — bring a fish home', 'A trout for the medicine cat']) }),
    () => ({ id: newId(), kind: 'catch-rabbit-n', goal: 1, progress: 0,
      reward: { hunger: 18, rep: 2 },
      description: rand(['Run down a rabbit on the moor', 'A fat rabbit for the warriors\' den', 'Catch a windrunner — a single rabbit']) }),
    () => ({ id: newId(), kind: 'catch-vole-n', goal: 1 + Math.floor(Math.random() * 2), progress: 0,
      reward: { hunger: 9, rep: 1 },
      description: rand(['Hunt voles in the underbrush', 'Catch 2 voles before sunhigh']) }),
    () => ({ id: newId(), kind: 'catch-bird-n', goal: 1, progress: 0,
      reward: { hunger: 11, rep: 2 },
      description: rand(['Catch a bird from a low branch', 'A sparrow or blackbird for the pile', 'Pounce on a bird mid-flight']) }),
    () => ({ id: newId(), kind: 'catch-squirrel-n', goal: 1, progress: 0,
      reward: { hunger: 13, rep: 2 },
      description: 'Bring down a squirrel from a tree' }),
    () => ({ id: newId(), kind: 'catch-frog-n', goal: 1, progress: 0,
      reward: { hunger: 8, rep: 1 },
      description: 'Snatch a frog from the marsh' }),

    // ── gather / use herbs ───────────────────────────────────────────
    () => {
      const goal = 2 + Math.floor(Math.random() * 3);
      return { id: newId(), kind: 'gather-herbs-n', goal, progress: 0,
        reward: { hp: 8, rep: 1 },
        description: rand([
          `Gather ${goal} herbs for the medicine cat`,
          `Find ${goal} healing leaves before nightfall`,
          `Forage ${goal} fresh herbs in the undergrowth`,
        ]) };
    },
    () => ({ id: newId(), kind: 'use-herb-n', goal: 1, progress: 0,
      reward: { hp: 12 },
      description: rand(['Use a herb on yourself', 'Treat a wound with a leaf from your pouch']) }),

    // ── travel / patrol ──────────────────────────────────────────────
    () => {
      const target = rand(CLAN_NAMES);
      return { id: newId(), kind: 'visit-clan', target, goal: 1, progress: 0,
        reward: { rep: 2 },
        description: `Patrol the ${target} border` };
    },
    () => ({ id: newId(), kind: 'visit-moonpool', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Visit the Moonpool — go alone, at night' }),
    () => ({ id: newId(), kind: 'climb-rock', goal: 1, progress: 0,
      reward: { rep: 2 },
      description: 'Stand on the High Rock as a leader does' }),
    () => {
      const goal = 60 + Math.floor(Math.random() * 80);
      return { id: newId(), kind: 'walk-distance', goal, progress: 0,
        reward: { rep: 1 },
        description: `Walk ${goal} paw-lengths through the territory` };
    },
    () => {
      const goal = 30 + Math.floor(Math.random() * 50);
      return { id: newId(), kind: 'sprint-distance', goal, progress: 0,
        reward: { rep: 1 },
        description: `Sprint ${goal} paw-lengths without stopping` };
    },

    // ── sleep / rest ─────────────────────────────────────────────────
    () => ({ id: newId(), kind: 'sleep', goal: 1, progress: 0,
      reward: { hp: 20 },
      description: rand([
        'Curl up and rest at camp — StarClan may speak to you',
        'Sleep through the long night',
        'Take a warrior\'s rest before the dawn patrol',
      ]) }),

    // ── combat / mission ─────────────────────────────────────────────
    () => ({ id: newId(), kind: 'pounce-streak', goal: 2 + Math.floor(Math.random() * 2), progress: 0,
      reward: { hunger: 20, rep: 2 },
      description: 'Land 2 pounces in a row without missing' }),
    () => ({ id: newId(), kind: 'accept-mission', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Speak to Firestar in ThunderClan camp' }),
    () => ({ id: newId(), kind: 'defeat-tigerstar', goal: 1, progress: 0,
      reward: { hp: 50, rep: 20, hunger: 30 },
      description: 'Defeat Tigerstar in single combat' }),

    // ── camp life ────────────────────────────────────────────────────
    () => {
      const goal = 1 + Math.floor(Math.random() * 3);
      return { id: newId(), kind: 'drop-pile-n', goal, progress: 0,
        reward: { rep: 2 },
        description: `Add ${goal} pieces of fresh-kill to the pile` };
    },
    () => {
      const goal = 1 + Math.floor(Math.random() * 2);
      return { id: newId(), kind: 'eat-pile-n', goal, progress: 0,
        reward: { hunger: 12 },
        description: `Eat ${goal} share${goal === 1 ? '' : 's'} from the fresh-kill pile` };
    },

    // ── social / movement flavour ────────────────────────────────────
    () => {
      const goal = 1 + Math.floor(Math.random() * 3);
      return { id: newId(), kind: 'emote-n', goal, progress: 0,
        reward: { rep: 1 },
        description: rand([
          `Greet a clanmate — purr or meow ${goal} time${goal === 1 ? '' : 's'}`,
          `Use ${goal} emote${goal === 1 ? '' : 's'} (hiss / purr / meow / tail-flick)`,
        ]) };
    },
    () => {
      const goal = 3 + Math.floor(Math.random() * 4);
      return { id: newId(), kind: 'jump-n', goal, progress: 0,
        reward: { rep: 1 },
        description: `Pounce-jump ${goal} times in the territory` };
    },
    () => ({ id: newId(), kind: 'use-waypoint', goal: 1, progress: 0,
      reward: { rep: 1 },
      description: 'Use the territory map to set a waypoint' }),
  ];

  return rand(generators)();
}

export function generateTaskBoard(n = 3): Task[] {
  return Array.from({ length: n }, () => generateTask());
}
