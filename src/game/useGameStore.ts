'use client';

import { create } from 'zustand';
import type { CatAppearance, ChatMessage, PlayerState, RoomState } from './types';
import type { GameSettings } from '@/lib/persist';
import { DEFAULT_SETTINGS } from '@/lib/persist';
import { generateTask, generateTaskBoard, type Task, type TaskKind } from '@/lib/tasks';

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

  // Fishing — like gathering, a short cutscene with a chance of failure,
  // but only triggerable when the player is standing in the river.
  fishing: boolean;
  setFishing: (v: boolean) => void;

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
  setChapterIndex: (n) => set({ chapterIndex: n, chapterProgress: 0 }),
  chapterProgress: 0,
  bumpChapterProgress: (n = 1) =>
    set((st) => ({ chapterProgress: st.chapterProgress + n })),

  sleeping: false,
  setSleeping: (v) => set({ sleeping: v }),
  sleepStage: 'idle',
  setSleepStage: (s) => set({ sleepStage: s }),
  dreamText: '',
  setDreamText: (s) => set({ dreamText: s }),

  gathering: false,
  setGathering: (v) => set({ gathering: v }),

  mission: 'none',
  setMission: (m) => set({ mission: m }),
  tigerstarHp: 100,
  setTigerstarHp: (n) => set({ tigerstarHp: Math.max(0, Math.min(100, n)) }),
  npcDialogId: null,
  setNpcDialogId: (id) => set({ npcDialogId: id }),
  battleActive: false,
  setBattleActive: (v) => set({ battleActive: v }),

  fishing: false,
  setFishing: (v) => set({ fishing: v }),

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
