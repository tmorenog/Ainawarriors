import type { ClanId } from '@/lib/clans';
import type { RoleId } from '@/lib/roles';

export type SizeTier = 'tiny' | 'small' | 'medium' | 'large' | 'massive';
export type FurPattern = 'solid' | 'tabby' | 'tortoiseshell' | 'calico' | 'point' | 'bicolor' | 'spotted';
export type EarShape = 'standard' | 'tufted' | 'rounded' | 'curl';
export type TailType = 'long' | 'short' | 'fluffy' | 'kink';
export type EyeColor =
  | 'amber' | 'green' | 'blue' | 'yellow' | 'copper' | 'hazel' | 'odd'
  | 'emerald' | 'sky' | 'violet' | 'rose' | 'silver' | 'gold' | 'jade' | 'sunset';

export interface CatAppearance {
  id: string;
  name: string;
  prefix: string;
  suffix: string;
  furBase: string;
  furBelly: string;
  furPattern: FurPattern;
  patternColor: string;
  patternColor2?: string;     // second pattern accent (tabby tertiary stripes, calico patches, tortie depth)
  patternColor3?: string;     // third pattern accent
  eyeColor: EyeColor;
  earShape: EarShape;
  tail: TailType;
  fluffiness: number; // 0..1
  size: SizeTier;
  height: number; // 0.85..1.25
  build: number; // 0.8..1.2
  scars: string[];
  blush?: boolean;            // show pink cheek blush spots
  clan: ClanId;
  role: RoleId;
  bubbleStyle: 'classic' | 'cloud' | 'leaf' | 'stone';
  voicePitch: number; // 0.5..1.5
  // Eye / vision options
  pupilSize?: number;         // 0..1 — relative pupil radius (0=pinprick, 1=full eye)
  vision?: 'normal' | 'half-blind' | 'blind';  // applies a visual handicap in-game
  nightVision?: boolean;      // grants brighter sight at night
}

export const SIZE_STATS: Record<SizeTier, { speed: number; strength: number; stamina: number; hunting: number; scale: number }> = {
  tiny:    { speed: 1.20, strength: 0.7, stamina: 0.85, hunting: 1.20, scale: 0.78 },
  small:   { speed: 1.10, strength: 0.85, stamina: 0.95, hunting: 1.10, scale: 0.88 },
  medium:  { speed: 1.00, strength: 1.00, stamina: 1.00, hunting: 1.00, scale: 1.00 },
  large:   { speed: 0.92, strength: 1.20, stamina: 1.10, hunting: 0.95, scale: 1.12 },
  massive: { speed: 0.82, strength: 1.45, stamina: 1.25, hunting: 0.85, scale: 1.28 },
};

export const PREFIX_OPTIONS = [
  'Oak','Fern','Bramble','Storm','Spotted','Frost','Ash','Cinder','Brook','Reed',
  'Sun','Moon','Star','Snow','Mist','Hawk','Dusk','Dawn','Birch','Briar','Tawny',
  'Russet','Silver','Shadow','Gorse','Heather','Holly','Jay','Robin','Thrush',
];

export const SUFFIX_OPTIONS = [
  'paw','kit','star','heart','claw','fur','tail','pelt','whisker','eye','foot',
  'leap','flight','song','wing','stripe','spots','breeze','light','frost','fall',
];

export const SCAR_OPTIONS = [
  'left-ear-nick','right-ear-tear','muzzle','left-eye','flank','tail-tip','shoulder',
];

export interface PlayerState {
  socketId: string;
  cat: CatAppearance;
  pos: [number, number, number];
  rot: number;
  anim: string;
  hp: number;
  hunger: number;
  stamina: number;
  reputation: number;
  isLeader: boolean;
  isDeputy: boolean;
  carrying?: string | null;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  scope: 'nearby' | 'clan' | 'system';
  text: string;
  at: number;
  emote?: string;
}

export interface RoomState {
  roomId: string;
  leaderId: string | null;
  deputyByClan: Record<string, string | null>;
  leaderByClan: Record<string, string | null>;
  weather: 'clear' | 'rain' | 'fog' | 'snow' | 'storm';
  season: 'newleaf' | 'greenleaf' | 'leaf-fall' | 'leaf-bare';
  timeOfDay: number; // 0..1
  preyAlive: number;
  events: { id: string; kind: string; at: number; payload?: any }[];
}
