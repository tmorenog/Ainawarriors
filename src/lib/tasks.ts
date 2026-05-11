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
  | 'use-waypoint'
  | 'declare-battle'
  | 'attend-gathering'
  | 'announce-n'
  | 'meet-leader-n'
  | 'eat-fish'
  | 'eat-rabbit'
  | 'rest-fed'
  | 'win-pounce-streak'
  | 'reach-rep'
  | 'visit-twoleg'
  | 'time-crouched'
  | 'pick-up-prey'
  | 'survive-night'
  | 'top-of-rock'
  | 'distance-from-camp'
  | 'use-emote-variety'
  | 'walk-on-river-bank'
  | 'sleep-night-only'
  | 'defend-camp'
  | 'defeat-raider-n'
  | 'rally-defenders'
  | 'survive-raid'
  | 'eat-vole'
  | 'eat-mouse'
  | 'eat-bird'
  | 'eat-frog'
  | 'eat-squirrel'
  | 'eat-shrew'
  | 'feed-elder'
  | 'feed-queen'
  | 'feed-kits'
  | 'visit-windclan'
  | 'visit-shadowclan'
  | 'visit-riverclan'
  | 'visit-thunderclan'
  | 'meet-firestar'
  | 'meet-tigerstar'
  | 'meet-leopardstar'
  | 'meet-tallstar'
  | 'meet-blackstar'
  | 'cross-river'
  | 'climb-tree'
  | 'survive-disaster'
  | 'witness-disaster'
  | 'sprint-streak'
  | 'crouch-master'
  | 'pile-master'
  | 'gather-marathon'
  | 'long-walk';

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

    // ── leader / clan politics ───────────────────────────────────────
    () => ({ id: newId(), kind: 'declare-battle', goal: 1, progress: 0,
      reward: { rep: 4 },
      description: 'Declare a battle on a rival clan (leader only)' }),
    () => ({ id: newId(), kind: 'attend-gathering', goal: 1, progress: 0,
      reward: { rep: 5 },
      description: 'Attend the full-moon Gathering at Fourtrees' }),
    () => ({ id: newId(), kind: 'announce-n', goal: 1, progress: 0,
      reward: { rep: 2 },
      description: 'Make an announcement from the High Rock (leader only)' }),
    () => ({ id: newId(), kind: 'meet-leader-n', goal: 2 + Math.floor(Math.random() * 3), progress: 0,
      reward: { rep: 3 },
      description: 'Greet 3 different clan leaders' }),

    // ── meals / hunger ───────────────────────────────────────────────
    () => ({ id: newId(), kind: 'eat-fish', goal: 1, progress: 0,
      reward: { hunger: 18, rep: 1 },
      description: 'Eat a fish (catch one and eat it whole)' }),
    () => ({ id: newId(), kind: 'eat-rabbit', goal: 1, progress: 0,
      reward: { hunger: 20, rep: 1 },
      description: 'Eat a rabbit (catch and feast)' }),
    () => ({ id: newId(), kind: 'rest-fed', goal: 1, progress: 0,
      reward: { hp: 14, rep: 1 },
      description: 'Sleep with a full belly (hunger ≥ 80 when you rest)' }),

    // ── streaks / mastery ────────────────────────────────────────────
    () => ({ id: newId(), kind: 'win-pounce-streak', goal: 5, progress: 0,
      reward: { hunger: 25, rep: 4 },
      description: 'Land 5 pounces in a row without missing' }),
    () => ({ id: newId(), kind: 'reach-rep', goal: 60 + Math.floor(Math.random() * 30), progress: 0,
      reward: { rep: 1 },
      description: rand(['Reach reputation 60 in your clan', 'Reach reputation 80 in your clan', 'Reach reputation 90 in your clan']) }),
    () => ({ id: newId(), kind: 'time-crouched', goal: 30 + Math.floor(Math.random() * 30), progress: 0,
      reward: { rep: 2 },
      description: 'Stalk crouched for 30 seconds total' }),

    // ── exploration ──────────────────────────────────────────────────
    () => ({ id: newId(), kind: 'visit-twoleg', goal: 1, progress: 0,
      reward: { rep: 2 },
      description: 'Cross into the Twoleg place — and come back alive' }),
    () => ({ id: newId(), kind: 'top-of-rock', goal: 1, progress: 0,
      reward: { rep: 2 },
      description: 'Stand on top of your clan\'s High Rock' }),
    () => ({ id: newId(), kind: 'distance-from-camp', goal: 100 + Math.floor(Math.random() * 80), progress: 0,
      reward: { rep: 2 },
      description: rand(['Travel 100 paw-lengths from camp', 'Wander 150 paw-lengths from your camp']) }),
    () => ({ id: newId(), kind: 'walk-on-river-bank', goal: 1, progress: 0,
      reward: { rep: 1 },
      description: 'Walk along the river bank' }),

    // ── carry / drop / share ─────────────────────────────────────────
    () => ({ id: newId(), kind: 'pick-up-prey', goal: 3 + Math.floor(Math.random() * 3), progress: 0,
      reward: { rep: 2 },
      description: rand(['Carry 3 pieces of fresh-kill back to camp', 'Carry 5 pieces of fresh-kill in one day']) }),

    // ── survival ─────────────────────────────────────────────────────
    () => ({ id: newId(), kind: 'survive-night', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Survive a night out of camp without dying' }),
    () => ({ id: newId(), kind: 'sleep-night-only', goal: 1, progress: 0,
      reward: { hp: 20 },
      description: 'Curl up and sleep ONLY at night (begin the rest after sundown)' }),

    // ── flair ────────────────────────────────────────────────────────
    () => ({ id: newId(), kind: 'use-emote-variety', goal: 4, progress: 0,
      reward: { rep: 2 },
      description: 'Use 4 different emotes in a single day (purr, hiss, meow, tail-flick…)' }),

    // ── raid defence (declare-battle → enemy warriors come to your camp)
    () => ({ id: newId(), kind: 'defend-camp', goal: 1, progress: 0,
      reward: { rep: 6, hp: 30 },
      description: 'Defend your camp against a rival clan\'s raid' }),
    () => ({ id: newId(), kind: 'defeat-raider-n', goal: 1 + Math.floor(Math.random() * 3), progress: 0,
      reward: { rep: 4 },
      description: rand(['Defeat a raiding warrior', 'Drive 2 raiders out of camp', 'Strike down 3 enemy warriors in a single raid']) }),
    () => ({ id: newId(), kind: 'rally-defenders', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Make an announcement during a raid to rally your warriors' }),
    () => ({ id: newId(), kind: 'survive-raid', goal: 1, progress: 0,
      reward: { rep: 4, hunger: 18 },
      description: 'Survive a full raid without your HP hitting zero' }),

    // ── eat specific prey (carrying-eat path) ───────────────────────
    () => ({ id: newId(), kind: 'eat-vole', goal: 1, progress: 0,
      reward: { hunger: 12 }, description: 'Eat a vole you caught' }),
    () => ({ id: newId(), kind: 'eat-mouse', goal: 1, progress: 0,
      reward: { hunger: 12 }, description: 'Eat a mouse you caught' }),
    () => ({ id: newId(), kind: 'eat-bird', goal: 1, progress: 0,
      reward: { hunger: 14 }, description: 'Eat a bird you caught from the sky' }),
    () => ({ id: newId(), kind: 'eat-frog', goal: 1, progress: 0,
      reward: { hunger: 10 }, description: 'Eat a frog from the marsh' }),
    () => ({ id: newId(), kind: 'eat-squirrel', goal: 1, progress: 0,
      reward: { hunger: 14 }, description: 'Eat a squirrel you brought down' }),
    () => ({ id: newId(), kind: 'eat-shrew', goal: 1, progress: 0,
      reward: { hunger: 10 }, description: 'Eat a shrew' }),

    // ── feed elders / queens / kits (drop-pile while carrying) ─────
    () => ({ id: newId(), kind: 'feed-elder', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Bring fresh-kill to an elder before you eat yourself' }),
    () => ({ id: newId(), kind: 'feed-queen', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Bring fresh-kill to a queen in the nursery' }),
    () => ({ id: newId(), kind: 'feed-kits', goal: 1, progress: 0,
      reward: { rep: 3 },
      description: 'Bring small prey for the kits' }),

    // ── visit each clan camp ────────────────────────────────────────
    () => ({ id: newId(), kind: 'visit-windclan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the WindClan border on the moor' }),
    () => ({ id: newId(), kind: 'visit-shadowclan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the ShadowClan border in the pines' }),
    () => ({ id: newId(), kind: 'visit-riverclan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the RiverClan border by the river' }),
    () => ({ id: newId(), kind: 'visit-thunderclan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Visit ThunderClan camp in the oak forest' }),

    // ── meet specific leaders ───────────────────────────────────────
    () => ({ id: newId(), kind: 'meet-firestar', goal: 1, progress: 0, reward: { rep: 3 },
      description: 'Greet Firestar of ThunderClan' }),
    () => ({ id: newId(), kind: 'meet-tigerstar', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Face Tigerstar of ShadowClan (before he falls)' }),
    () => ({ id: newId(), kind: 'meet-leopardstar', goal: 1, progress: 0, reward: { rep: 3 },
      description: 'Greet Leopardstar of RiverClan' }),
    () => ({ id: newId(), kind: 'meet-tallstar', goal: 1, progress: 0, reward: { rep: 3 },
      description: 'Greet Tallstar of WindClan' }),
    () => ({ id: newId(), kind: 'meet-blackstar', goal: 1, progress: 0, reward: { rep: 4 },
      description: 'Greet Blackstar — ShadowClan\'s new leader' }),

    // ── exploration milestones ──────────────────────────────────────
    () => ({ id: newId(), kind: 'cross-river', goal: 1, progress: 0, reward: { rep: 3 },
      description: 'Wade across the river to the other side' }),
    () => ({ id: newId(), kind: 'climb-tree', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Climb up onto a high rock or tree (jump to a perch)' }),
    () => ({ id: newId(), kind: 'long-walk', goal: 250, progress: 0, reward: { rep: 4 },
      description: 'Walk 250 paw-lengths in one outing' }),

    // ── disaster encounters ─────────────────────────────────────────
    () => ({ id: newId(), kind: 'survive-disaster', goal: 1, progress: 0, reward: { rep: 5, hp: 25 },
      description: 'Survive a forest disaster (fire, flood, or twoleg invasion)' }),
    () => ({ id: newId(), kind: 'witness-disaster', goal: 1, progress: 0, reward: { rep: 1 },
      description: 'Witness a disaster in the forest' }),

    // ── mastery streaks ─────────────────────────────────────────────
    () => ({ id: newId(), kind: 'sprint-streak', goal: 100, progress: 0, reward: { rep: 3 },
      description: 'Sprint 100 paw-lengths in one burst' }),
    () => ({ id: newId(), kind: 'crouch-master', goal: 60, progress: 0, reward: { rep: 3 },
      description: 'Spend 60 seconds total stalking in crouch' }),
    () => ({ id: newId(), kind: 'pile-master', goal: 5, progress: 0, reward: { rep: 5, hunger: 15 },
      description: 'Add 5 fresh-kill pieces to the pile' }),
    () => ({ id: newId(), kind: 'gather-marathon', goal: 8, progress: 0, reward: { rep: 5, hp: 18 },
      description: 'Gather 8 herbs in a single day' }),

    // ─────────────────────────────────────────────────────────────
    // 40 more flavour entries (reuses existing kinds — variety only).
    // ─────────────────────────────────────────────────────────────
    () => ({ id: newId(), kind: 'catch-any-n', goal: 4, progress: 0, reward: { hunger: 24, rep: 2 },
      description: 'A great hunt — catch 4 pieces of prey before sunset' }),
    () => ({ id: newId(), kind: 'catch-any-n', goal: 6, progress: 0, reward: { hunger: 32, rep: 3 },
      description: 'A perfect hunt — bring 6 fresh-kills home in one day' }),
    () => ({ id: newId(), kind: 'catch-mouse-n', goal: 3, progress: 0, reward: { hunger: 18, rep: 2 },
      description: 'Catch 3 mice — the queens are hungry' }),
    () => ({ id: newId(), kind: 'catch-fish-n', goal: 2, progress: 0, reward: { hunger: 22, rep: 3 },
      description: 'Catch 2 fish — show RiverClan how it\'s done' }),
    () => ({ id: newId(), kind: 'catch-rabbit-n', goal: 2, progress: 0, reward: { hunger: 26, rep: 3 },
      description: 'Run down 2 rabbits on the moor' }),
    () => ({ id: newId(), kind: 'catch-vole-n', goal: 3, progress: 0, reward: { hunger: 18, rep: 2 },
      description: 'Catch 3 voles — the small prey count too' }),
    () => ({ id: newId(), kind: 'catch-bird-n', goal: 2, progress: 0, reward: { hunger: 20, rep: 3 },
      description: 'Pounce 2 birds from low branches' }),
    () => ({ id: newId(), kind: 'catch-squirrel-n', goal: 2, progress: 0, reward: { hunger: 22, rep: 3 },
      description: 'Bring down 2 squirrels' }),
    () => ({ id: newId(), kind: 'catch-frog-n', goal: 2, progress: 0, reward: { hunger: 14, rep: 2 },
      description: 'Catch 2 frogs from the marsh' }),
    () => ({ id: newId(), kind: 'gather-herbs-n', goal: 3, progress: 0, reward: { hp: 12, rep: 2 },
      description: 'Forage for 3 cobwebs and leaves' }),
    () => ({ id: newId(), kind: 'gather-herbs-n', goal: 5, progress: 0, reward: { hp: 18, rep: 3 },
      description: 'Stock the medicine den — 5 fresh herbs' }),
    () => ({ id: newId(), kind: 'use-herb-n', goal: 2, progress: 0, reward: { hp: 18 },
      description: 'Use 2 herbs from your pouch' }),
    () => ({ id: newId(), kind: 'sleep', goal: 1, progress: 0, reward: { hp: 25, hunger: 8 },
      description: 'Curl up at the apprentices\' den and rest' }),
    () => ({ id: newId(), kind: 'sleep', goal: 1, progress: 0, reward: { hp: 25, rep: 1 },
      description: 'Rest in the warriors\' den between patrols' }),
    () => ({ id: newId(), kind: 'walk-distance', goal: 200, progress: 0, reward: { rep: 3 },
      description: 'A long ramble — 200 paw-lengths' }),
    () => ({ id: newId(), kind: 'walk-distance', goal: 80, progress: 0, reward: { rep: 1 },
      description: 'A short dawn patrol — 80 paw-lengths' }),
    () => ({ id: newId(), kind: 'sprint-distance', goal: 60, progress: 0, reward: { rep: 2 },
      description: 'Race the wind — sprint 60 paw-lengths' }),
    () => ({ id: newId(), kind: 'sprint-distance', goal: 120, progress: 0, reward: { rep: 3 },
      description: 'Outrun a fox — sprint 120 paw-lengths' }),
    () => ({ id: newId(), kind: 'pounce-streak', goal: 3, progress: 0, reward: { hunger: 18, rep: 3 },
      description: 'Land 3 pounces in a row — no missing' }),
    () => ({ id: newId(), kind: 'pounce-streak', goal: 4, progress: 0, reward: { hunger: 24, rep: 4 },
      description: 'Land 4 pounces in a row' }),
    () => ({ id: newId(), kind: 'drop-pile-n', goal: 2, progress: 0, reward: { rep: 3 },
      description: 'Drop 2 prey on the fresh-kill pile' }),
    () => ({ id: newId(), kind: 'drop-pile-n', goal: 4, progress: 0, reward: { rep: 5, hunger: 8 },
      description: 'Stock the pile — drop 4 prey on it' }),
    () => ({ id: newId(), kind: 'eat-pile-n', goal: 2, progress: 0, reward: { hunger: 16 },
      description: 'Take 2 shares from the fresh-kill pile' }),
    () => ({ id: newId(), kind: 'emote-n', goal: 5, progress: 0, reward: { rep: 2 },
      description: 'Greet your clanmates — 5 emotes today' }),
    () => ({ id: newId(), kind: 'jump-n', goal: 6, progress: 0, reward: { rep: 2 },
      description: 'Pounce-jump 6 times — practice your leap' }),
    () => ({ id: newId(), kind: 'jump-n', goal: 10, progress: 0, reward: { rep: 3 },
      description: 'Pounce-jump 10 times' }),
    () => ({ id: newId(), kind: 'visit-moonpool', goal: 1, progress: 0, reward: { rep: 4 },
      description: 'Walk the silver path — visit the Moonpool at night' }),
    () => ({ id: newId(), kind: 'climb-rock', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Stand at the foot of the High Rock' }),
    () => ({ id: newId(), kind: 'top-of-rock', goal: 1, progress: 0, reward: { rep: 3 },
      description: 'Climb to the very top of the High Rock' }),
    () => ({ id: newId(), kind: 'use-waypoint', goal: 1, progress: 0, reward: { rep: 1 },
      description: 'Plan ahead — set a map waypoint' }),
    () => ({ id: newId(), kind: 'time-crouched', goal: 90, progress: 0, reward: { rep: 4 },
      description: 'Stalk for 90 seconds total' }),
    () => ({ id: newId(), kind: 'reach-rep', goal: 70, progress: 0, reward: { rep: 1 },
      description: 'Earn 70 reputation' }),
    () => ({ id: newId(), kind: 'reach-rep', goal: 85, progress: 0, reward: { rep: 1 },
      description: 'Earn 85 reputation — a senior warrior' }),
    () => ({ id: newId(), kind: 'meet-leader-n', goal: 4, progress: 0, reward: { rep: 5 },
      description: 'Greet all four clan leaders' }),
    () => ({ id: newId(), kind: 'visit-clan', target: 'ThunderClan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the ThunderClan border' }),
    () => ({ id: newId(), kind: 'visit-clan', target: 'RiverClan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the RiverClan border' }),
    () => ({ id: newId(), kind: 'visit-clan', target: 'ShadowClan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the ShadowClan border' }),
    () => ({ id: newId(), kind: 'visit-clan', target: 'WindClan', goal: 1, progress: 0, reward: { rep: 2 },
      description: 'Patrol the WindClan border' }),
    () => ({ id: newId(), kind: 'attend-gathering', goal: 1, progress: 0, reward: { rep: 6 },
      description: 'Attend the next full-moon Gathering' }),
    () => ({ id: newId(), kind: 'defeat-raider-n', goal: 2, progress: 0, reward: { rep: 6, hunger: 12 },
      description: 'Defeat 2 raiding warriors when your camp is attacked' }),
  ];

  return rand(generators)();
}

export function generateTaskBoard(n = 3): Task[] {
  return Array.from({ length: n }, () => generateTask());
}
