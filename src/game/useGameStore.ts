'use client';

import { create } from 'zustand';
import type { CatAppearance, ChatMessage, PlayerState, RoomState } from './types';
import type { GameSettings } from '@/lib/persist';
import { DEFAULT_SETTINGS } from '@/lib/persist';

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
