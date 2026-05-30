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
  | 'long-walk'
  | 'defeat-scourge'
  | 'reach-scourge';

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

    // ── Rise of Scourge arc ─────────────────────────────────────────
    () => ({ id: newId(), kind: 'reach-scourge', goal: 1, progress: 0, reward: { rep: 4 },
      description: 'Find Scourge in the heart of Twoleg place' }),
    () => ({ id: newId(), kind: 'defeat-scourge', goal: 1, progress: 0, reward: { hp: 50, rep: 30, hunger: 30 },
      description: 'Defeat Scourge — the leader of BloodClan' }),

    // ───────────────────────────────────────────────────────────────
    // 200 more flavour entries. All reuse existing kinds — just more
    // variety in description and goal numbers so the rotating task
    // board stays fresh for a much longer play session.
    // ───────────────────────────────────────────────────────────────
    ...(([
      // Catches — across kinds and goal counts
      ['catch-any-n', 1, 'A clean catch — bring one piece of fresh-kill', { hunger: 10 }],
      ['catch-any-n', 2, 'Two pieces of fresh-kill before sundown',     { hunger: 18, rep: 1 }],
      ['catch-any-n', 3, 'Bring three catches home — feed the den',     { hunger: 22, rep: 2 }],
      ['catch-any-n', 4, 'A strong hunt — four pieces of prey',         { hunger: 26, rep: 2 }],
      ['catch-any-n', 5, 'The hunting patrol — five fresh-kills',       { hunger: 30, rep: 3 }],
      ['catch-any-n', 6, 'A great hunt — six pieces of prey',           { hunger: 34, rep: 3 }],
      ['catch-any-n', 8, 'A perfect day — eight catches',               { hunger: 42, rep: 4 }],
      ['catch-any-n', 10, 'Feed the whole clan — ten catches',          { hunger: 50, rep: 6 }],
      ['catch-mouse-n', 1, 'Stalk one mouse in the undergrowth',         { hunger: 10 }],
      ['catch-mouse-n', 2, 'Two mice for the elders',                    { hunger: 14, rep: 1 }],
      ['catch-mouse-n', 3, 'Three mice in a single dusk',                { hunger: 18, rep: 2 }],
      ['catch-mouse-n', 4, 'A mouse-hunter\'s harvest — four',           { hunger: 22, rep: 2 }],
      ['catch-mouse-n', 5, 'Five mice — overflow the pile',              { hunger: 26, rep: 3 }],
      ['catch-fish-n', 1, 'A fish from the river — the cold way',       { hunger: 15, rep: 2 }],
      ['catch-fish-n', 2, 'Two fish — show the RiverClan way',          { hunger: 22, rep: 3 }],
      ['catch-fish-n', 3, 'Three fish — a true river-cat',              { hunger: 28, rep: 4 }],
      ['catch-rabbit-n', 1, 'Run down a rabbit on the moor',             { hunger: 18, rep: 2 }],
      ['catch-rabbit-n', 2, 'Two rabbits — chase them across the heath', { hunger: 24, rep: 3 }],
      ['catch-rabbit-n', 3, 'Three rabbits — outpace a WindClan patrol', { hunger: 30, rep: 4 }],
      ['catch-vole-n', 1, 'A vole from the long grass',                  { hunger: 9, rep: 1 }],
      ['catch-vole-n', 2, 'Two voles in the underbrush',                 { hunger: 13, rep: 2 }],
      ['catch-vole-n', 4, 'Four voles for the kits',                     { hunger: 20, rep: 2 }],
      ['catch-bird-n', 1, 'A bird from a low branch',                    { hunger: 11, rep: 2 }],
      ['catch-bird-n', 2, 'Two birds in mid-flight',                     { hunger: 16, rep: 3 }],
      ['catch-bird-n', 3, 'Three birds — pluck the trees clean',         { hunger: 22, rep: 4 }],
      ['catch-squirrel-n', 1, 'A squirrel from the oak',                 { hunger: 13, rep: 2 }],
      ['catch-squirrel-n', 2, 'Two squirrels in a single hunt',          { hunger: 18, rep: 3 }],
      ['catch-frog-n', 1, 'A frog from the marsh',                       { hunger: 8, rep: 1 }],
      ['catch-frog-n', 3, 'Three frogs from the wet ground',             { hunger: 16, rep: 2 }],
      // Herbs
      ['gather-herbs-n', 1, 'Pick a single leaf for the medicine cat',   { hp: 5 }],
      ['gather-herbs-n', 2, 'Two fresh herbs from the undergrowth',      { hp: 9, rep: 1 }],
      ['gather-herbs-n', 4, 'Four herbs for the medicine den',           { hp: 14, rep: 2 }],
      ['gather-herbs-n', 6, 'Six herbs — a good stock for leaf-bare',    { hp: 18, rep: 3 }],
      ['gather-herbs-n', 9, 'Nine herbs in a single day',                { hp: 22, rep: 4 }],
      ['gather-herbs-n', 12, 'A medicine cat\'s marathon — twelve herbs',{ hp: 28, rep: 5 }],
      ['use-herb-n', 1, 'Use a single herb on a wound',                  { hp: 12 }],
      ['use-herb-n', 3, 'Use three herbs over the day',                  { hp: 20, rep: 1 }],
      ['use-herb-n', 5, 'Heal five wounds — a true healer',              { hp: 30, rep: 2 }],
      // Travel
      ['walk-distance', 50,  'Stretch your paws — fifty paces',          { rep: 1 }],
      ['walk-distance', 100, 'A hundred paces along the border',         { rep: 1 }],
      ['walk-distance', 150, 'A hundred and fifty paces of patrol',      { rep: 2 }],
      ['walk-distance', 200, 'A morning patrol — two hundred paces',     { rep: 3 }],
      ['walk-distance', 300, 'A long ramble — three hundred paces',      { rep: 4 }],
      ['walk-distance', 500, 'Five hundred paces — see the whole forest',{ rep: 6 }],
      ['walk-distance', 800, 'Eight hundred paces — a warrior\'s journey',{ rep: 8 }],
      ['sprint-distance', 30,  'Burst sprint — thirty paces',            { rep: 1 }],
      ['sprint-distance', 60,  'Outrun a fox — sixty paces',             { rep: 2 }],
      ['sprint-distance', 100, 'A hundred paces of pure speed',          { rep: 3 }],
      ['sprint-distance', 150, 'A hundred and fifty paces of sprint',    { rep: 4 }],
      ['sprint-distance', 250, 'Run like a WindClan cat — 250 paces',    { rep: 6 }],
      // Sleep / rest
      ['sleep', 1, 'Curl up in the warriors\' den',                      { hp: 20 }],
      ['sleep', 1, 'Sleep at the apprentices\' den',                     { hp: 18 }],
      ['sleep', 1, 'Doze under the sun on a flat rock',                  { hp: 15 }],
      ['sleep', 1, 'Sleep through a thunderstorm',                       { hp: 22, rep: 1 }],
      ['sleep-night-only', 1, 'Sleep only after sundown — proper rest',  { hp: 24, rep: 1 }],
      // Pounce / combat practice
      ['pounce-streak', 2, 'Two pounces in a row — no misses',           { hunger: 12, rep: 2 }],
      ['pounce-streak', 3, 'Three pounces in a row',                     { hunger: 16, rep: 3 }],
      ['pounce-streak', 4, 'Four pounces in a row — the perfect stalk',  { hunger: 20, rep: 4 }],
      ['pounce-streak', 6, 'Six pounces in a row — a master\'s streak',  { hunger: 28, rep: 6 }],
      ['win-pounce-streak', 3, 'Land three clean pounces',                { hunger: 16, rep: 3 }],
      ['win-pounce-streak', 4, 'Land four clean pounces',                 { hunger: 22, rep: 4 }],
      ['win-pounce-streak', 7, 'Land seven clean pounces',                { hunger: 32, rep: 6 }],
      // Fresh-kill pile
      ['drop-pile-n', 1, 'Drop one piece on the fresh-kill pile',         { rep: 2 }],
      ['drop-pile-n', 3, 'Drop three pieces on the pile',                 { rep: 4, hunger: 4 }],
      ['drop-pile-n', 5, 'Drop five pieces on the pile',                  { rep: 6, hunger: 8 }],
      ['drop-pile-n', 7, 'Drop seven pieces on the pile',                 { rep: 8, hunger: 10 }],
      ['eat-pile-n', 1, 'Eat from the pile',                               { hunger: 12 }],
      ['eat-pile-n', 3, 'Eat three meals from the pile',                   { hunger: 22 }],
      // Emotes
      ['emote-n', 2, 'Greet two clanmates today',                          { rep: 1 }],
      ['emote-n', 3, 'Three emotes — purr, mew, hiss',                     { rep: 2 }],
      ['emote-n', 5, 'Five emotes — chatty paws',                          { rep: 2 }],
      ['emote-n', 8, 'Eight emotes — a true clan greeter',                 { rep: 3 }],
      ['use-emote-variety', 3, 'Three different emotes in a single day',   { rep: 2 }],
      ['use-emote-variety', 5, 'Five different emotes today',              { rep: 4 }],
      ['use-emote-variety', 7, 'Seven different emotes — a charmer',       { rep: 6 }],
      // Jumps
      ['jump-n', 2, 'Two pounce-jumps',                                    { rep: 1 }],
      ['jump-n', 5, 'Five pounce-jumps',                                   { rep: 2 }],
      ['jump-n', 10, 'Ten pounce-jumps — practice your leap',              { rep: 3 }],
      ['jump-n', 20, 'Twenty pounce-jumps — leg day',                      { rep: 5 }],
      // Crouch / stalk
      ['time-crouched', 15, 'Stalk for fifteen seconds',                   { rep: 1 }],
      ['time-crouched', 45, 'Stalk for forty-five seconds',                { rep: 2 }],
      ['time-crouched', 75, 'Stalk for seventy-five seconds',              { rep: 3 }],
      ['time-crouched', 120, 'Stalk for two minutes',                      { rep: 4 }],
      ['time-crouched', 180, 'Stalk for three minutes — patience itself',  { rep: 6 }],
      ['crouch-master', 90, 'Ninety seconds of pure stalk',                { rep: 4 }],
      ['crouch-master', 150, 'Two and a half minutes of stalking',         { rep: 6 }],
      // Reputation milestones
      ['reach-rep', 55, 'Reach reputation 55',                             { rep: 1 }],
      ['reach-rep', 65, 'Reach reputation 65',                             { rep: 1 }],
      ['reach-rep', 75, 'Reach reputation 75',                             { rep: 2 }],
      ['reach-rep', 90, 'Reach reputation 90 — senior warrior',            { rep: 2 }],
      ['reach-rep', 100, 'Reach reputation 100 — a deputy in waiting',     { rep: 3 }],
      // Visit
      ['visit-clan', 1, 'Patrol any clan border',                          { rep: 2 }],
      ['visit-thunderclan', 1, 'Visit ThunderClan camp',                    { rep: 2 }],
      ['visit-riverclan', 1, 'Visit RiverClan camp',                        { rep: 2 }],
      ['visit-shadowclan', 1, 'Visit ShadowClan camp',                      { rep: 2 }],
      ['visit-windclan', 1, 'Visit WindClan camp',                          { rep: 2 }],
      ['visit-moonpool', 1, 'Walk to the Moonpool',                         { rep: 3 }],
      ['visit-moonpool', 1, 'Reach the Moonpool at midnight',               { rep: 5 }],
      ['visit-twoleg', 1, 'Cross into Twoleg place — and come home',        { rep: 3 }],
      ['visit-twoleg', 1, 'Scout the Twoleg place for danger',              { rep: 4 }],
      // Climb
      ['climb-rock', 1, 'Stand at the foot of the High Rock',               { rep: 1 }],
      ['climb-rock', 1, 'Climb up to the High Rock summit',                 { rep: 2 }],
      ['top-of-rock', 1, 'Stand on top of the High Rock',                   { rep: 3 }],
      ['top-of-rock', 1, 'Sun yourself on the High Rock summit',            { rep: 3 }],
      ['climb-tree', 1, 'Climb a tree to a low branch',                     { rep: 2 }],
      ['climb-tree', 1, 'Climb high — see the whole forest from above',    { rep: 3 }],
      // Meet
      ['meet-leader-n', 1, 'Greet a clan leader',                           { rep: 2 }],
      ['meet-leader-n', 2, 'Greet two clan leaders',                        { rep: 3 }],
      ['meet-leader-n', 3, 'Greet three clan leaders',                      { rep: 4 }],
      ['meet-leader-n', 4, 'Greet every clan leader',                        { rep: 6 }],
      ['meet-firestar', 1, 'Greet Firestar — pay your respects',             { rep: 3 }],
      ['meet-tigerstar', 1, 'Face Tigerstar in his ShadowClan camp',         { rep: 3 }],
      ['meet-leopardstar', 1, 'Greet Leopardstar by the river',              { rep: 3 }],
      ['meet-tallstar', 1, 'Greet Tallstar on the moor',                     { rep: 3 }],
      ['meet-blackstar', 1, 'Greet Blackstar of ShadowClan',                 { rep: 4 }],
      // Eat / meals
      ['eat-fish', 1, 'Eat a fish you caught yourself',                      { hunger: 18, rep: 1 }],
      ['eat-rabbit', 1, 'Eat a rabbit you brought down',                     { hunger: 20, rep: 1 }],
      ['eat-vole', 1, 'Eat a vole you caught',                                { hunger: 12 }],
      ['eat-mouse', 1, 'Eat a mouse you caught',                              { hunger: 12 }],
      ['eat-bird', 1, 'Eat a bird you brought down',                          { hunger: 14 }],
      ['eat-frog', 1, 'Eat a frog from the marsh',                            { hunger: 10 }],
      ['eat-squirrel', 1, 'Eat a squirrel',                                   { hunger: 14 }],
      ['eat-shrew', 1, 'Eat a shrew',                                          { hunger: 10 }],
      ['rest-fed', 1, 'Sleep with a full belly (hunger ≥ 80)',                { hp: 14, rep: 1 }],
      // Feed others
      ['feed-elder', 1, 'Bring fresh-kill to an elder',                       { rep: 3 }],
      ['feed-queen', 1, 'Bring fresh-kill to a queen',                        { rep: 3 }],
      ['feed-kits', 1, 'Bring a piece for the kits',                          { rep: 4 }],
      // Long walks / exploration
      ['distance-from-camp', 60,  'Wander sixty paces from your camp',       { rep: 1 }],
      ['distance-from-camp', 120, 'Roam 120 paces from camp',                { rep: 2 }],
      ['distance-from-camp', 180, 'Travel 180 paces from camp',              { rep: 3 }],
      ['distance-from-camp', 250, 'Travel 250 paces — see the borders',       { rep: 4 }],
      ['long-walk', 200, 'A long walk — two hundred paces',                   { rep: 3 }],
      ['long-walk', 350, 'A very long walk — 350 paces',                      { rep: 5 }],
      ['long-walk', 500, 'A trek — 500 paces',                                { rep: 7 }],
      // Carry prey
      ['pick-up-prey', 2, 'Carry two pieces home',                             { rep: 2 }],
      ['pick-up-prey', 4, 'Carry four pieces home over the day',               { rep: 3 }],
      ['pick-up-prey', 8, 'Carry eight pieces home — a busy day',              { rep: 5 }],
      // Survival
      ['survive-night', 1, 'Survive a night out of camp',                      { rep: 3 }],
      ['survive-night', 1, 'Survive a night in another clan\'s territory',     { rep: 5 }],
      ['survive-disaster', 1, 'Survive a forest disaster',                     { rep: 5, hp: 25 }],
      ['witness-disaster', 1, 'Witness a forest disaster',                     { rep: 2 }],
      // Riverbank / map
      ['walk-on-river-bank', 1, 'Stroll along the river bank',                 { rep: 2 }],
      ['walk-on-river-bank', 1, 'Patrol the river bank end-to-end',            { rep: 4 }],
      ['cross-river', 1, 'Wade across the river',                              { rep: 3 }],
      ['cross-river', 1, 'Cross the river twice — there and back',             { rep: 5 }],
      ['use-waypoint', 1, 'Set a map waypoint',                                { rep: 1 }],
      ['use-waypoint', 1, 'Plan a patrol — set a map waypoint',                { rep: 2 }],
      // Defence / raids
      ['declare-battle', 1, 'Declare a battle on a rival (leader only)',       { rep: 5 }],
      ['announce-n', 1, 'Make an announcement from the High Rock',             { rep: 2 }],
      ['announce-n', 2, 'Make two announcements today',                        { rep: 4 }],
      ['defend-camp', 1, 'Defend your camp against a raid',                     { rep: 6, hp: 25 }],
      ['rally-defenders', 1, 'Rally your warriors during a raid',               { rep: 3 }],
      ['survive-raid', 1, 'Survive a raid without dying',                       { rep: 5, hunger: 15 }],
      ['defeat-raider-n', 1, 'Defeat a raider',                                 { rep: 3 }],
      ['defeat-raider-n', 3, 'Defeat three raiders',                            { rep: 6 }],
      ['defeat-raider-n', 5, 'Defeat five raiders in one day',                  { rep: 10 }],
      // Gathering
      ['attend-gathering', 1, 'Attend the full-moon Gathering',                 { rep: 6 }],
      ['attend-gathering', 1, 'Speak at the next Gathering',                    { rep: 8 }],
      // Mastery / streak goals
      ['pile-master', 6, 'Pile up six pieces on the pile',                      { rep: 6, hunger: 16 }],
      ['pile-master', 10, 'Pile up ten pieces on the pile',                     { rep: 10, hunger: 24 }],
      ['gather-marathon', 10, 'Gather ten herbs in a single day',               { rep: 6, hp: 20 }],
      ['sprint-streak', 80, 'Sprint eighty paces in one burst',                  { rep: 3 }],
      ['sprint-streak', 150, 'Sprint 150 paces in one burst',                   { rep: 5 }],
      ['sprint-streak', 220, 'Sprint 220 paces in one burst',                   { rep: 7 }],
      // Mission / scourge
      ['accept-mission', 1, 'Speak to Firestar in ThunderClan camp',            { rep: 3 }],
      ['defeat-tigerstar', 1, 'Defeat Tigerstar in single combat',              { hp: 50, rep: 20, hunger: 30 }],
      ['reach-scourge', 1, 'Track Scourge through the Twoleg place',            { rep: 5 }],
      ['defeat-scourge', 1, 'Defeat Scourge — leader of BloodClan',             { hp: 60, rep: 35, hunger: 35 }],
      // Quick variety fillers
      ['catch-any-n', 1, 'A small catch — anything counts',                    { hunger: 8 }],
      ['catch-any-n', 2, 'A modest hunt — two catches',                        { hunger: 14 }],
      ['gather-herbs-n', 3, 'Three herbs — keep the medicine den stocked',     { hp: 11, rep: 1 }],
      ['use-herb-n', 2, 'Two herbs — patch up two wounds',                     { hp: 16 }],
      ['emote-n', 1, 'One greeting today',                                     { rep: 1 }],
      ['jump-n', 3, 'Three pounce-jumps',                                       { rep: 1 }],
      ['walk-distance', 40,  'A short stroll — forty paces',                    { rep: 1 }],
      ['walk-distance', 75,  'A morning walk — seventy-five paces',             { rep: 1 }],
      ['walk-distance', 125, 'A meandering 125 paces',                          { rep: 2 }],
      ['walk-distance', 400, 'Four hundred paces — go far',                     { rep: 5 }],
      ['sleep', 1, 'A short nap in the sun',                                    { hp: 12 }],
      ['sleep', 1, 'Sleep in the medicine den',                                 { hp: 26, rep: 1 }],
      ['drop-pile-n', 2, 'Drop two pieces on the pile',                          { rep: 3 }],
      ['drop-pile-n', 4, 'Drop four pieces on the pile',                          { rep: 5 }],
      ['drop-pile-n', 6, 'Drop six pieces on the pile',                            { rep: 7, hunger: 8 }],
      ['eat-pile-n', 2, 'Eat two shares from the pile',                            { hunger: 18 }],
      ['eat-pile-n', 3, 'Eat three shares from the pile',                          { hunger: 24, rep: 1 }],
      ['visit-clan', 1, 'Patrol any rival clan border',                            { rep: 3 }],
      ['climb-rock', 1, 'Climb onto a low boulder',                                { rep: 1 }],
      ['top-of-rock', 1, 'Sit on the High Rock summit',                            { rep: 4 }],
      ['climb-tree', 1, 'Find a perch high in a tree',                             { rep: 3 }],
      ['use-waypoint', 1, 'Mark a hunting spot on the map',                        { rep: 2 }],
      ['time-crouched', 60, 'Stalk for a full minute',                              { rep: 3 }],
      ['time-crouched', 30, 'Stalk for thirty seconds',                             { rep: 1 }],
      ['emote-n', 4, 'Four greetings today',                                        { rep: 2 }],
      ['use-emote-variety', 4, 'Use four different emotes in a day',                { rep: 3 }],
      ['gather-herbs-n', 7, 'Seven herbs — restock the leaf-bare cache',            { hp: 20, rep: 3 }],
      ['gather-herbs-n', 11, 'Eleven herbs in a single day',                        { hp: 26, rep: 4 }],
      ['walk-on-river-bank', 1, 'Pad along the river edge',                         { rep: 1 }],
      ['cross-river', 1, 'Swim across at the narrow ford',                          { rep: 4 }],
      ['catch-mouse-n', 6, 'Six mice in a single dusk',                             { hunger: 30, rep: 3 }],
      ['catch-bird-n', 4, 'Four birds — clear the low branches',                    { hunger: 26, rep: 4 }],
      ['catch-fish-n', 4, 'Four fish — a true RiverClan haul',                      { hunger: 36, rep: 5 }],
      ['catch-rabbit-n', 4, 'Four rabbits — outrun the wind',                       { hunger: 36, rep: 5 }],
      ['catch-vole-n', 5, 'Five voles in one day',                                  { hunger: 24, rep: 3 }],
      ['catch-squirrel-n', 3, 'Three squirrels from the oaks',                      { hunger: 24, rep: 4 }],
      ['catch-frog-n', 4, 'Four frogs from the marsh',                              { hunger: 20, rep: 3 }],
      ['pounce-streak', 5, 'Five pounces in a row',                                 { hunger: 24, rep: 5 }],
      ['pounce-streak', 8, 'Eight pounces in a row — perfect form',                  { hunger: 36, rep: 8 }],
      ['win-pounce-streak', 6, 'Land six clean pounces',                             { hunger: 28, rep: 5 }],
      ['sprint-distance', 80,  'Sprint eighty paces',                                 { rep: 2 }],
      ['sprint-distance', 200, 'Sprint two hundred paces',                            { rep: 5 }],
      ['rest-fed', 1, 'Sleep when well-fed — proper recovery',                       { hp: 18, rep: 1 }],
      ['use-herb-n', 4, 'Use four herbs — a busy medicine cat',                       { hp: 26, rep: 2 }],
      ['use-herb-n', 7, 'Use seven herbs — a healer\'s day',                          { hp: 36, rep: 4 }],
      ['drop-pile-n', 8, 'Stock the pile — eight pieces',                             { rep: 10, hunger: 14 }],
      ['drop-pile-n', 10, 'Build the pile — ten pieces',                              { rep: 12, hunger: 18 }],
      ['feed-elder', 1, 'Feed an elder before yourself',                               { rep: 4 }],
      ['feed-queen', 1, 'Feed a nursing queen',                                        { rep: 4 }],
      ['feed-kits', 1, 'Bring small prey to the kits',                                 { rep: 5 }],
      ['visit-moonpool', 1, 'Visit the Moonpool under a clear sky',                   { rep: 4 }],
      ['visit-moonpool', 1, 'Visit the Moonpool during leaf-bare',                    { rep: 6 }],
      ['climb-tree', 1, 'Climb a tree and watch the territory',                       { rep: 3 }],
      ['sleep-night-only', 1, 'Sleep only after sundown — three nights running',     { hp: 30, rep: 3 }],
      ['use-emote-variety', 6, 'Use six different emotes today',                      { rep: 5 }],
      ['use-emote-variety', 8, 'Use eight different emotes today — a charmer',         { rep: 8 }],
      ['announce-n', 3, 'Make three announcements from the High Rock',                 { rep: 6 }],
      ['rally-defenders', 2, 'Rally your warriors twice during raids',                 { rep: 5 }],
      ['defeat-raider-n', 4, 'Defeat four raiders today',                             { rep: 8 }],
      ['defeat-raider-n', 6, 'Defeat six raiders today',                              { rep: 12 }],
      ['survive-raid', 1, 'Survive a raid without an injury',                          { rep: 6, hunger: 18 }],
      ['attend-gathering', 1, 'Cross to Fourtrees on the full moon',                   { rep: 7 }],
      ['attend-gathering', 1, 'Attend two Gatherings in a row',                        { rep: 10 }],
      ['pile-master', 4, 'Build the pile — four pieces in one day',                    { rep: 5, hunger: 12 }],
      ['gather-marathon', 6, 'Gather six herbs in a day',                              { rep: 4, hp: 14 }],
      ['sprint-streak', 50, 'Sprint fifty paces without slowing',                       { rep: 2 }],
      ['sprint-streak', 300, 'Sprint three hundred paces',                              { rep: 9 }],
      ['accept-mission', 1, 'Take up Firestar\'s mission',                              { rep: 3 }],
      ['walk-distance', 600, 'Six hundred paces — circle the territory',               { rep: 7 }],
      ['walk-distance', 1000, 'A thousand paces — paws of iron',                       { rep: 12 }],
      ['distance-from-camp', 80,  'Wander eighty paces from camp',                     { rep: 2 }],
      ['distance-from-camp', 220, 'Travel 220 paces from camp',                         { rep: 4 }],
      ['distance-from-camp', 280, 'Travel 280 paces from camp — see the borders',      { rep: 5 }],
    ] as const).map(([kind, goal, description, reward]) =>
      () => ({ id: newId(), kind, goal, progress: 0, reward, description })
    )),
  ];

  return rand(generators)();
}

export function generateTaskBoard(n = 3): Task[] {
  return Array.from({ length: n }, () => generateTask());
}
