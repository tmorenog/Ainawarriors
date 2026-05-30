import type { CatAppearance } from '@/game/types';
import { normalizeCat } from '@/lib/normalizeCat';

const KEY = 'wotc_save_v1';

export interface SaveData {
  cat: CatAppearance | null;
  settings: GameSettings;
  friends: string[];
  muted: string[];
  reputation: number;
  unlocks: string[];
  lastClan: string | null;
  guestId: string;
  // Story state — keeps Tigerstar permanently dead once he's been
  // defeated, instead of respawning every time the page reloads.
  mission: 'none' | 'accepted' | 'won';
  // Med-cat herb gardens — persisted so they don't disappear on reload.
  herbGardens: Array<{ id: string; x: number; z: number; plantedAt: number; herbs: string[] }>;
  // Heal-a-warrior side quest — once you've patched up Bramblepaw next
  // to the medicine den, the wounded mesh stays healed across reloads.
  injuredWarriorHealed: boolean;
  // Rise of Scourge — once defeated, he stays gone across reloads.
  scourgeDefeated: boolean;
}

export interface GameSettings {
  graphics: 'low' | 'medium' | 'high';
  cameraMode: 'third' | 'first';
  sound: number;
  music: number;
  uiScale: number;
  colorblind: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  invertY: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  // Start at the safest setting — low triggers no shadow framebuffers and
  // light geometry. Players can bump to medium/high in Settings if their
  // device handles it.
  graphics: 'low',
  cameraMode: 'third',
  sound: 0.7,
  music: 0.4,
  uiScale: 1,
  colorblind: 'none',
  invertY: false,
};

function newGuestId() {
  return 'guest_' + Math.random().toString(36).slice(2, 10);
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') {
    return {
      cat: null,
      settings: DEFAULT_SETTINGS,
      friends: [],
      muted: [],
      reputation: 50,
      unlocks: [],
      lastClan: null,
      guestId: 'guest_ssr',
      mission: 'none',
      herbGardens: [],
      injuredWarriorHealed: false,
      scourgeDefeated: false,
    };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh: SaveData = {
        cat: null,
        settings: DEFAULT_SETTINGS,
        friends: [],
        muted: [],
        reputation: 50,
        unlocks: [],
        lastClan: null,
        guestId: newGuestId(),
        mission: 'none',
        herbGardens: [],
        injuredWarriorHealed: false,
        scourgeDefeated: false,
      };
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      cat: parsed.cat ? normalizeCat(parsed.cat) : null,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      muted: Array.isArray(parsed.muted) ? parsed.muted : [],
      reputation: typeof parsed.reputation === 'number' ? parsed.reputation : 50,
      unlocks: Array.isArray(parsed.unlocks) ? parsed.unlocks : [],
      lastClan: typeof parsed.lastClan === 'string' ? parsed.lastClan : null,
      guestId: typeof parsed.guestId === 'string' ? parsed.guestId : newGuestId(),
      mission: parsed.mission === 'won' || parsed.mission === 'accepted' || parsed.mission === 'none' ? parsed.mission : 'none',
      herbGardens: Array.isArray(parsed.herbGardens) ? parsed.herbGardens : [],
      injuredWarriorHealed: typeof parsed.injuredWarriorHealed === 'boolean' ? parsed.injuredWarriorHealed : false,
      scourgeDefeated: typeof parsed.scourgeDefeated === 'boolean' ? parsed.scourgeDefeated : false,
    };
  } catch {
    return {
      cat: null,
      settings: DEFAULT_SETTINGS,
      friends: [],
      muted: [],
      reputation: 50,
      unlocks: [],
      lastClan: null,
      guestId: newGuestId(),
      mission: 'none',
      herbGardens: [],
      injuredWarriorHealed: false,
      scourgeDefeated: false,
    };
  }
}

export function saveData(data: SaveData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function patchSave(patch: Partial<SaveData>) {
  const current = loadSave();
  const next = { ...current, ...patch };
  saveData(next);
  return next;
}
