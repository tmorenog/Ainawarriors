'use client';

import { create } from 'zustand';
import type { CatAppearance, ChatMessage, PlayerState, RoomState } from './types';
import type { GameSettings } from '@/lib/persist';
import { DEFAULT_SETTINGS } from '@/lib/persist';
import { generateTask, generateTaskBoard, type Task, type TaskKind } from '@/lib/tasks';

export interface Raider { id: string; x: number; z: number; hp: number; alive: boolean; clan?: string }
export interface RaidState { fromClan: string; until: number; raiders: Raider[] }

export type Screen = 'title' | 'creator' | 'game';

interface GameStore {
  screen: Screen;
  setScreen: (s: Screen) => void;

  cat: CatAppearance | null;
  setCat: (c: CatAppearance | null) => void;

  selfId: string;
  setSelfId: (id: string) => void;

  players: Record<string, PlayerState>;
  upsertPlayer: (p: PlayerState) => void;
  removePlayer: (id: string) => void;
  setPlayers: (ps: Record<string, PlayerState>) => void;

  room: RoomState | null;
  setRoom: (r: RoomState | null) => void;

  chat: ChatMessage[];
  pushChat: (m: ChatMessage) => void;

  settings: GameSettings;
  setSettings: (s: Partial<GameSettings>) => void;

  hud: {
    hp: number; hunger: number; stamina: number; reputation: number;
  };
  setHud: (h: Partial<GameStore['hud']>) => void;

  carrying: string | null;
  setCarrying: (s: string | null) => void;

  // Id of the prey closest to the player and within pounce reach. The
  // prey render reads this to draw a highlight ring. The PlayerController
  // useFrame keeps it fresh.
  targetPreyId: string | null;
  setTargetPreyId: (id: string | null) => void;

  herbInventory: Record<string, number>;
  addHerb: (id: string, n?: number) => void;
  consumeHerb: (id: string, n?: number) => boolean;

  questText: string;
  setQuest: (q: string) => void;

  // Book Mode — narrative campaign loosely tracking the Warriors books.
  bookMode: boolean;
  setBookMode: (v: boolean) => void;
  chapterIndex: number;
  setChapterIndex: (n: number) => void;
  chapterProgress: number;
  bumpChapterProgress: (n?: number) => void;
  // Timestamp of the last chapter card opening — drives the in/out fade.
  chapterCardAt: number;
  showChapterCard: () => void;
  // Cinematic cutscene currently playing (full-screen overlay). null when
  // gameplay is in control. The various overlays watch this and render
  // their own art / text / audio based on `kind`.
  cutscene: null | { kind: 'wasted' | 'kidnap' | 'firestar-dies' | 'graystripe-flashback' | 'starclan-walk'; startedAt: number };
  setCutscene: (c: GameStore['cutscene']) => void;
  // True after Firestar's StarClan death event has fired so we don't
  // re-trigger it.
  firestarDeadAt: number;
  setFirestarDeadAt: (n: number) => void;
  // Side-quest: heal a wounded clanmate by using a herb. Shows a quest
  // pill in the HUD until the player has used at least one herb.
  healedWarriorAt: number;
  setHealedWarriorAt: (n: number) => void;
  // Wounded clanmate lying near each clan's high rock. The Heal quest
  // requires the player to actually walk up to him and use a herb at
  // his side, not just patch up wherever.
  injuredWarriorHealed: boolean;
  setInjuredWarriorHealed: (v: boolean) => void;

  // Med-cat herb gardens — small fenced plots the medicine cat plants
  // around the territories. Each ripens after ~60s of real time and
  // can then be eaten for a hunger boost. Persisted via localStorage
  // so they survive reloads. After being eaten the plot stays (dirt
  // patch + fence) and the plants regrow another 90s later.
  herbGardens: Array<{ id: string; x: number; z: number; plantedAt: number; herbs: string[]; eatenAt?: number }>;
  plantHerbGarden: (x: number, z: number, herbs: string[]) => void;
  // Mark a garden as eaten (clears the plants for a regrow cycle) but
  // keeps the plot itself in the world.
  eatHerbGarden: (id: string) => void;
  // Hard-remove a garden from the world (kept for back-compat / debug).
  removeHerbGarden: (id: string) => void;
  setHerbGardens: (g: GameStore['herbGardens']) => void;

  // Sleep cutscene — when true the world dims and a soft pad plays for a
  // few seconds before fading back in (also doubles as a Book objective).
  sleeping: boolean;
  setSleeping: (v: boolean) => void;
  // Multi-stage sleep cutscene: 'idle' (not sleeping), 'loaf' (just sat down),
  // 'curl' (curled up), 'deep' (fully asleep), 'waking' (cross-fade out).
  sleepStage: 'idle' | 'loaf' | 'curl' | 'deep' | 'waking';
  setSleepStage: (s: 'idle' | 'loaf' | 'curl' | 'deep' | 'waking') => void;
  dreamText: string;
  setDreamText: (s: string) => void;

  // Gathering cutscene — true while the player is searching for herbs.
  // Prevents stacking multiple gathers and gates the overlay.
  gathering: boolean;
  setGathering: (v: boolean) => void;

  // Firestar / Tigerstar storyline.
  // mission: 'none' before talking to Firestar, 'accepted' after accepting,
  // 'won' once Tigerstar is defeated.
  mission: 'none' | 'accepted' | 'won';
  setMission: (m: 'none' | 'accepted' | 'won') => void;
  tigerstarHp: number;          // 0..100, decreases on each pounce
  setTigerstarHp: (n: number) => void;
  npcDialogId: string | null;   // currently open NPC dialog
  setNpcDialogId: (id: string | null) => void;
  battleActive: boolean;        // true while you're locked in combat with Tigerstar
  setBattleActive: (v: boolean) => void;
  // Cinematic phase of the Tigerstar fight:
  //   'idle'     — no battle
  //   'intro'    — opening cutscene banner ("BATTLE: TIGERSTAR"), 2s
  //   'fighting' — full control, you can pounce (Q) or swipe (F)
  //   'victory'  — closing cutscene banner ("VICTORY"), 2.5s
  battlePhase: 'idle' | 'intro' | 'fighting' | 'victory' | 'defeat';
  setBattlePhase: (p: 'idle' | 'intro' | 'fighting' | 'victory' | 'defeat') => void;
  // Camera shake magnitude — decays each frame; set on every hit
  cameraShake: number;
  setCameraShake: (n: number) => void;
  // Timestamp of the most recent swipe / pounce attack — the SwipeFX
  // overlay watches this and animates a claw-mark slash.
  swipeFlashAt: number;
  swipeFlashKind: 'pounce' | 'swipe' | 'bite';
  triggerSwipeFx: (kind: 'pounce' | 'swipe' | 'bite') => void;

  // Fishing — like gathering, a short cutscene with a chance of failure,
  // but only triggerable when the player is standing in the river.
  fishing: boolean;
  setFishing: (v: boolean) => void;

  // Custom waypoint set by tapping the map. The on-screen arrow points
  // here if it's set, otherwise falls back to Tigerstar during the
  // mission. Cleared when the player gets within ~6 units of it.
  waypoint: { x: number; z: number; label: string } | null;
  setWaypoint: (w: { x: number; z: number; label: string } | null) => void;

  // Personal contributions to the fresh-kill pile. You can only eat from
  // the pile (without carrying prey of your own) if pileContrib > 0 —
  // every meal you take from the pile decrements it. Hunting and dropping
  // your catch on the pile increments it.
  pileContrib: number;
  bumpPileContrib: (n?: number) => void;

  // Full-moon Gathering — true while the four-clan meeting at Fourtrees
  // is in progress. The NPC system spawns four clan leaders at the
  // gathering site whenever this is true so the player can talk to them.
  clanGathering: boolean;
  setClanGathering: (v: boolean) => void;

  // Hard pause — when true, Game.tsx skips its useFrame work.
  paused: boolean;
  setPaused: (v: boolean) => void;

  // Whether the territory map and the chat panel are currently open.
  // Stored centrally so keyboard shortcuts (M, /) can toggle them.
  mapOpen: boolean;
  setMapOpen: (v: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  // Bumped whenever someone requests the chat input get focus (e.g. /).
  chatFocusAt: number;
  focusChat: () => void;

  // Active disaster (random rare event) and its visible kind.
  disaster: null | { kind: 'twoleg' | 'flood' | 'fire' | 'dogpack'; until: number; message: string };
  setDisaster: (d: GameStore['disaster']) => void;

  // Latest StarClan dream — shown as a card during the deep stage of
  // sleep. Cleared once the cutscene ends.
  dreamLine: string | null;
  setDreamLine: (s: string | null) => void;

  // Active raid — enemy warriors marching on the player's camp.
  // Created when a leader declares battle. The Raid component reads
  // this and animates the raiders / handles damage.
  raid: null | RaidState;
  setRaid: (r: RaidState | null) => void;
  updateRaider: (id: string, patch: Partial<Raider>) => void;

  // Rotating ambient task board — three quests at a time, auto-completing
  // as the player plays. Completed tasks are replaced with fresh ones.
  tasks: Task[];
  reseedTasks: () => void;
  bumpTask: (kind: TaskKind, amount?: number, predicate?: (t: Task) => boolean) => void;

  muted: Set<string>;
  toggleMute: (id: string) => void;

  friends: Set<string>;
  toggleFriend: (id: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'title',
  setScreen: (s) => set({ screen: s }),

  cat: null,
  setCat: (c) => set({ cat: c }),

  selfId: '',
  setSelfId: (id) => set({ selfId: id }),

  players: {},
  upsertPlayer: (p) => set((st) => ({ players: { ...st.players, [p.socketId]: p } })),
  removePlayer: (id) =>
    set((st) => {
      const next = { ...st.players };
      delete next[id];
      return { players: next };
    }),
  setPlayers: (ps) => set({ players: ps }),

  room: null,
  setRoom: (r) => set({ room: r }),

  chat: [],
  pushChat: (m) => set((st) => ({ chat: [...st.chat.slice(-50), m] })),

  settings: DEFAULT_SETTINGS,
  setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),

  hud: { hp: 100, hunger: 60, stamina: 100, reputation: 50 },
  setHud: (h) => set((st) => ({ hud: { ...st.hud, ...h } })),

  carrying: null,
  setCarrying: (s) => set({ carrying: s }),

  targetPreyId: null,
  setTargetPreyId: (id) => set({ targetPreyId: id }),

  herbInventory: {},
  addHerb: (id, n = 1) =>
    set((st) => ({ herbInventory: { ...st.herbInventory, [id]: (st.herbInventory[id] ?? 0) + n } })),
  consumeHerb: (id, n = 1) => {
    const cur = get().herbInventory[id] ?? 0;
    if (cur < n) return false;
    set((st) => ({ herbInventory: { ...st.herbInventory, [id]: cur - n } }));
    return true;
  },

  questText: 'Find your bearings in your new clan.',
  setQuest: (q) => set({ questText: q }),

  bookMode: false,
  setBookMode: (v) => set({ bookMode: v }),
  chapterIndex: 0,
  setChapterIndex: (n) => set({ chapterIndex: n, chapterProgress: 0, chapterCardAt: Date.now() }),
  chapterProgress: 0,
  bumpChapterProgress: (n = 1) =>
    set((st) => ({ chapterProgress: st.chapterProgress + n })),
  chapterCardAt: Date.now(),
  showChapterCard: () => set({ chapterCardAt: Date.now() }),
  cutscene: null,
  setCutscene: (c) => set({ cutscene: c }),
  firestarDeadAt: 0,
  setFirestarDeadAt: (n) => set({ firestarDeadAt: n }),
  healedWarriorAt: 0,
  setHealedWarriorAt: (n) => set({ healedWarriorAt: n }),
  injuredWarriorHealed: false,
  setInjuredWarriorHealed: (v) => set({ injuredWarriorHealed: v }),

  herbGardens: [],
  plantHerbGarden: (x, z, herbs) =>
    set((st) => ({
      herbGardens: [
        ...st.herbGardens,
        { id: 'g' + Date.now() + Math.random().toString(36).slice(2, 5), x, z, plantedAt: Date.now(), herbs },
      ],
    })),
  eatHerbGarden: (id) =>
    set((st) => ({
      herbGardens: st.herbGardens.map((g) =>
        g.id === id ? { ...g, eatenAt: Date.now() } : g
      ),
    })),
  removeHerbGarden: (id) =>
    set((st) => ({ herbGardens: st.herbGardens.filter((g) => g.id !== id) })),
  setHerbGardens: (g) => set({ herbGardens: g }),

  sleeping: false,
  setSleeping: (v) => set({ sleeping: v }),
  sleepStage: 'idle',
  setSleepStage: (s) => set({ sleepStage: s }),
  dreamText: '',
  setDreamText: (s) => set({ dreamText: s }),

  gathering: false,
  setGathering: (v) => set({ gathering: v }),

  mission: 'none',
  // Tigerstar mission is a one-way ratchet — once you've defeated him
  // ('won') we don't let anything (saved state, npc dialogs, raid
  // resets) downgrade it. This keeps him permanently dead.
  setMission: (m) => set((st) => ({ mission: st.mission === 'won' ? 'won' : m })),
  tigerstarHp: 100,
  setTigerstarHp: (n) => set({ tigerstarHp: Math.max(0, Math.min(100, n)) }),
  npcDialogId: null,
  setNpcDialogId: (id) => set({ npcDialogId: id }),
  battleActive: false,
  setBattleActive: (v) => set({ battleActive: v }),
  battlePhase: 'idle',
  setBattlePhase: (p) => set({ battlePhase: p }),
  cameraShake: 0,
  setCameraShake: (n) => set({ cameraShake: n }),
  swipeFlashAt: 0,
  swipeFlashKind: 'swipe',
  triggerSwipeFx: (kind) => set({ swipeFlashAt: Date.now(), swipeFlashKind: kind }),

  fishing: false,
  setFishing: (v) => set({ fishing: v }),

  waypoint: null,
  setWaypoint: (w) => set({ waypoint: w }),

  pileContrib: 0,
  bumpPileContrib: (n = 1) => set((st) => ({ pileContrib: Math.max(0, st.pileContrib + n) })),

  clanGathering: false,
  setClanGathering: (v) => set({ clanGathering: v }),

  paused: false,
  setPaused: (v) => set({ paused: v }),

  mapOpen: false,
  setMapOpen: (v) => set({ mapOpen: v }),
  chatOpen: false,
  setChatOpen: (v) => set({ chatOpen: v }),
  chatFocusAt: 0,
  focusChat: () => set({ chatOpen: true, chatFocusAt: Date.now() }),

  disaster: null,
  setDisaster: (d) => set({ disaster: d }),

  dreamLine: null,
  setDreamLine: (s) => set({ dreamLine: s }),

  raid: null,
  setRaid: (r) => set({ raid: r }),
  updateRaider: (id, patch) => set((st) => {
    if (!st.raid) return {};
    return {
      raid: {
        ...st.raid,
        raiders: st.raid.raiders.map((r) => r.id === id ? { ...r, ...patch } : r),
      },
    };
  }),

  tasks: generateTaskBoard(3),
  reseedTasks: () => set({ tasks: generateTaskBoard(3) }),
  bumpTask: (kind, amount = 1, predicate) =>
    set((st) => {
      const next = st.tasks.map((t) => {
        if (t.kind !== kind) return t;
        if (predicate && !predicate(t)) return t;
        const progress = Math.min(t.goal, t.progress + amount);
        return { ...t, progress };
      });
      // Replace any completed task with a fresh one and apply its reward
      let hp = st.hud.hp, hunger = st.hud.hunger, rep = st.hud.reputation;
      const replaced = next.map((t) => {
        if (t.progress >= t.goal) {
          if (t.reward.hp) hp = Math.min(100, hp + t.reward.hp);
          if (t.reward.hunger) hunger = Math.min(100, hunger + t.reward.hunger);
          if (t.reward.rep) rep = Math.min(100, rep + t.reward.rep);
          return generateTask();
        }
        return t;
      });
      return {
        tasks: replaced,
        hud: { ...st.hud, hp, hunger, reputation: rep },
      };
    }),

  muted: new Set<string>(),
  toggleMute: (id) =>
    set((st) => {
      const next = new Set(st.muted);
      next.has(id) ? next.delete(id) : next.add(id);
      return { muted: next };
    }),

  friends: new Set<string>(),
  toggleFriend: (id) =>
    set((st) => {
      const next = new Set(st.friends);
      next.has(id) ? next.delete(id) : next.add(id);
      return { friends: next };
    }),
}));
