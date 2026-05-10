import type {
  CatAppearance, EarShape, EyeColor, FurPattern, SizeTier, TailType,
} from '@/game/types';

const FUR_BASES = ['#3a2618', '#5b3a25', '#7a5a3a', '#9c8268', '#c9b59b'];
const SIZES: SizeTier[] = ['tiny','small','medium','large','massive'];
const PATTERNS: FurPattern[] = ['solid','tabby','tortoiseshell','calico','point','bicolor','spotted'];
const EYES: EyeColor[] = ['amber','green','blue','yellow','copper','hazel','odd'];
const EARS: EarShape[] = ['standard','tufted','rounded','curl'];
const TAILS: TailType[] = ['long','short','fluffy','kink'];
const BUBBLES: CatAppearance['bubbleStyle'][] = ['classic','cloud','leaf','stone'];

function pick<T>(value: any, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly any[]).includes(value) ? value : fallback;
}
function num(value: any, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}
function str(value: any, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
function color(value: any, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

export function normalizeCat(input: any): CatAppearance {
  const safe = input && typeof input === 'object' ? input : {};
  return {
    id: str(safe.id, 'cat_' + Math.random().toString(36).slice(2, 9)),
    name: str(safe.name, 'Stranger'),
    prefix: str(safe.prefix, 'Stranger'),
    suffix: str(safe.suffix, ''),
    furBase: color(safe.furBase, FUR_BASES[0]),
    furBelly: color(safe.furBelly, '#f4f1ea'),
    furPattern: pick(safe.furPattern, PATTERNS, 'tabby'),
    patternColor: color(safe.patternColor, '#3a2618'),
    eyeColor: pick(safe.eyeColor, EYES, 'amber'),
    earShape: pick(safe.earShape, EARS, 'standard'),
    tail: pick(safe.tail, TAILS, 'long'),
    fluffiness: num(safe.fluffiness, 0.4, 0, 1),
    size: pick(safe.size, SIZES, 'medium'),
    height: num(safe.height, 1.0, 0.85, 1.25),
    build: num(safe.build, 1.0, 0.8, 1.2),
    scars: Array.isArray(safe.scars) ? safe.scars.filter((s: any) => typeof s === 'string') : [],
    clan: str(safe.clan, 'ThunderClan') as CatAppearance['clan'],
    role: str(safe.role, 'Warrior') as CatAppearance['role'],
    bubbleStyle: pick(safe.bubbleStyle, BUBBLES, 'classic'),
    voicePitch: num(safe.voicePitch, 1.0, 0.5, 1.5),
  };
}
