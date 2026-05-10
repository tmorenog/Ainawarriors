'use client';

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Cat } from '@/game/Cat';
import {
  PREFIX_OPTIONS, SUFFIX_OPTIONS, SCAR_OPTIONS, SIZE_STATS,
  type CatAppearance, type EarShape, type EyeColor, type FurPattern, type SizeTier, type TailType,
} from '@/game/types';
import { CLANS, CLAN_LIST, type ClanId } from '@/lib/clans';
import { ROLE_LIST, defaultRoleForClan, type RoleId } from '@/lib/roles';
import { useGameStore } from '@/game/useGameStore';
import { loadSave, patchSave } from '@/lib/persist';
import { safeUsername } from '@/lib/chatFilter';
import { normalizeCat } from '@/lib/normalizeCat';

const FUR_BASES = [
  // browns
  '#1d1206','#2c1a0e','#3a2618','#4a3018','#5b3a25','#6e4a2c','#7a5a3a','#8b6b46','#9c8268','#b89876','#c9b59b','#d8c5a8','#e3d5b8',
  // creams / whites
  '#f4f1ea','#fbf6ec','#fff8e8','#efe6cf','#dccfae',
  // greys / blacks
  '#0d0d0d','#1d1d1d','#2c2c2c','#3a3a3a','#525252','#6c6c6c','#888888','#a8a8a8','#c0c0c0','#d8d8d8',
  // gingers / oranges
  '#7a3010','#9c4a22','#c46a32','#d97a35','#e2a456','#f0c585',
  // unusual
  '#5a4a2a','#3d4a36','#4a3848','#604055','#3a2a3a',
];
const FUR_BELLY = [
  '#f4f1ea','#fff8e8','#fbf6ec','#e3d5b8','#dccfae','#c9b59b','#9c8268','#a89886','#444444','#1d1d1d','#222222',
];
const PATTERN_COLORS = [
  '#1d1d1d','#2c1a0e','#3a2618','#4a3018','#5b3a25','#7a5a3a',
  '#9c4a22','#c46a32','#d97a35','#e2a456',
  '#444444','#666666','#888888','#a0a0a0','#bdbdbd','#dddddd','#ffffff',
  '#0d0d0d','#222222','#3d4a36','#4a3848','#604055',
];
const FUR_PATTERNS: FurPattern[] = ['solid','tabby','tortoiseshell','calico','point','bicolor','spotted'];
const EYE_COLORS: EyeColor[] = ['amber','green','blue','yellow','copper','hazel','odd'];
const EARS: EarShape[] = ['standard','tufted','rounded','curl'];
const TAILS: TailType[] = ['long','short','fluffy','kink'];
const SIZES: SizeTier[] = ['tiny','small','medium','large','massive'];
const BUBBLES: CatAppearance['bubbleStyle'][] = ['classic','cloud','leaf','stone'];

interface Props {
  onSave: (cat: CatAppearance) => void;       // save the morph and stay on the editor
  onPlay: (cat: CatAppearance) => void;       // save and enter the game
  onCancel: () => void;
}

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makeDefault(): CatAppearance {
  const prefix = rand(PREFIX_OPTIONS);
  const suffix = rand(SUFFIX_OPTIONS);
  return {
    id: 'cat_' + Math.random().toString(36).slice(2, 9),
    name: `${prefix}${suffix}`,
    prefix,
    suffix,
    furBase: rand(FUR_BASES),
    furBelly: rand(FUR_BELLY),
    furPattern: rand(FUR_PATTERNS),
    patternColor: rand(PATTERN_COLORS),
    patternColor2: rand(PATTERN_COLORS),
    patternColor3: rand(PATTERN_COLORS),
    eyeColor: rand(EYE_COLORS),
    earShape: 'standard',
    tail: 'long',
    fluffiness: 0.4,
    size: 'medium',
    height: 1.0,
    build: 1.0,
    scars: [],
    blush: false,
    clan: 'ThunderClan',
    role: 'Warrior',
    bubbleStyle: 'classic',
    voicePitch: 1.0,
  };
}

export function CharacterCreator({ onSave, onPlay, onCancel }: Props) {
  const existing = useGameStore((s) => s.cat);
  const [cat, setCat] = useState<CatAppearance>(() => existing ? normalizeCat(existing) : makeDefault());
  const [tab, setTab] = useState<'fur' | 'shape' | 'size' | 'clan' | 'name' | 'voice'>('fur');
  const [nameError, setNameError] = useState('');
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setCat((c) => ({ ...c, name: `${c.prefix}${c.suffix}` }));
  }, [cat.prefix, cat.suffix]);

  const stats = SIZE_STATS[cat.size];
  const clan = CLANS[cat.clan];

  const update = (patch: Partial<CatAppearance>) => setCat((c) => ({ ...c, ...patch }));

  // Randomize the visual morph but keep the player's chosen name, clan, and role.
  const randomizeMorph = () => {
    setCat((c) => ({
      ...c,
      furBase: rand(FUR_BASES),
      furBelly: rand(FUR_BELLY),
      furPattern: rand(FUR_PATTERNS),
      patternColor: rand(PATTERN_COLORS),
      patternColor2: rand(PATTERN_COLORS),
      patternColor3: rand(PATTERN_COLORS),
      eyeColor: rand(EYE_COLORS),
      earShape: rand(EARS),
      tail: rand(TAILS),
      fluffiness: 0.2 + Math.random() * 0.6,
      size: rand(SIZES),
      height: 0.9 + Math.random() * 0.3,
      build: 0.85 + Math.random() * 0.3,
      blush: Math.random() < 0.4,
    }));
  };

  // Validate the cat and return a normalized copy ready to persist, or null on bad name.
  const finalize = (): CatAppearance | null => {
    const safe = safeUsername(cat.name);
    if (!safe) { setNameError('Pick a kinder, simpler name (2–24 letters).'); return null; }
    return { ...cat, name: safe };
  };

  const handleSave = () => {
    const final = finalize();
    if (!final) return;
    patchSave({ cat: final });
    onSave(final);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const handlePlay = () => {
    const final = finalize();
    if (!final) return;
    patchSave({ cat: final });
    onPlay(final);
  };

  return (
    <div className="absolute inset-0 flex flex-col md:grid md:grid-cols-[1fr_420px] md:grid-rows-1 bg-forest-900 text-bone overflow-hidden">
      {/* Preview */}
      <div className="relative md:col-start-1 h-[38vh] md:h-auto md:min-h-0 shrink-0 bg-gradient-to-b from-forest-700 to-forest-900">
        <Canvas
          camera={{ position: [2.6, 1.4, 2.6], fov: 38 }}
          shadows={false}
          dpr={[1, 1.5]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
          }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={1} />
          <Cat cat={cat} anim="idle" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <circleGeometry args={[5, 32]} />
            <meshStandardMaterial color={'#3b4d2c'} roughness={1} />
          </mesh>
          <OrbitControls enablePan={false} minDistance={2} maxDistance={6} />
        </Canvas>
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/40 text-xs">
          {cat.name} · {clan.name} · {cat.role}
        </div>
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Stat label="Speed" v={stats.speed} />
          <Stat label="Strength" v={stats.strength} />
          <Stat label="Stamina" v={stats.stamina} />
          <Stat label="Hunting" v={stats.hunting} />
        </div>
      </div>

      {/* Controls — internal grid: header (auto) · nav (auto) · scrollable middle (1fr, scrolls)
          · footer (auto, always pinned at the bottom). 1fr middle is the only row that flexes,
          everything else stays its content size, so the footer can never disappear. */}
      <div className="md:col-start-2 flex-1 min-h-0 md:h-full grid grid-rows-[auto_auto_minmax(0,1fr)_auto] bg-forest-900 border-t md:border-t-0 md:border-l border-white/10 overflow-hidden">
        <header className="p-4 border-b border-white/10">
          <div className="font-display text-2xl">Create your Warrior</div>
          <div className="text-xs opacity-70">All choices save locally and persist between sessions.</div>
        </header>

        <nav className="grid grid-cols-6 text-xs">
          {(['fur','shape','size','clan','name','voice'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 ${tab === t ? 'bg-white/10 text-bone' : 'opacity-70 hover:opacity-100'}`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="p-4 overflow-y-auto space-y-4 text-sm min-h-0">
          {tab === 'fur' && (
            <>
              <button
                onClick={randomizeMorph}
                className="w-full rounded-xl border border-thunder/50 bg-thunder/15 hover:bg-thunder/25 active:scale-95 transition py-2 text-sm font-display"
              >
                ✨ Surprise me — randomize morph
              </button>
              <Group title="Fur color">
                <Swatches options={FUR_BASES} value={cat.furBase} onChange={(v) => update({ furBase: v })} />
              </Group>
              <Group title="Belly color">
                <Swatches options={FUR_BELLY} value={cat.furBelly} onChange={(v) => update({ furBelly: v })} />
              </Group>
              <Group title="Pattern">
                <div className="flex flex-wrap gap-2">
                  {FUR_PATTERNS.map((p) => (
                    <Pill key={p} active={cat.furPattern === p} onClick={() => update({ furPattern: p })}>{p}</Pill>
                  ))}
                </div>
              </Group>
              <Group title="Pattern color (primary)">
                <Swatches options={PATTERN_COLORS} value={cat.patternColor} onChange={(v) => update({ patternColor: v })} />
              </Group>
              {cat.furPattern !== 'solid' && cat.furPattern !== 'bicolor' && cat.furPattern !== 'point' && (
                <>
                  <Group title="Pattern color 2 (accent)">
                    <Swatches options={PATTERN_COLORS} value={cat.patternColor2 ?? '#888888'} onChange={(v) => update({ patternColor2: v })} />
                  </Group>
                  <Group title="Pattern color 3 (deep)">
                    <Swatches options={PATTERN_COLORS} value={cat.patternColor3 ?? '#5b3a25'} onChange={(v) => update({ patternColor3: v })} />
                  </Group>
                </>
              )}
              <Group title="Eye color">
                <div className="flex flex-wrap gap-2">
                  {EYE_COLORS.map((e) => (
                    <Pill key={e} active={cat.eyeColor === e} onClick={() => update({ eyeColor: e })}>{e}</Pill>
                  ))}
                </div>
              </Group>
              <Group title="Fluffiness">
                <Slider value={cat.fluffiness} min={0} max={1} step={0.05} onChange={(v) => update({ fluffiness: v })} />
              </Group>
              <Group title="Blush">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!cat.blush}
                    onChange={(e) => update({ blush: e.target.checked })}
                  />
                  Show pink cheek blush
                </label>
              </Group>
            </>
          )}

          {tab === 'shape' && (
            <>
              <Group title="Ear shape">
                <div className="flex flex-wrap gap-2">{EARS.map((e) => (<Pill key={e} active={cat.earShape === e} onClick={() => update({ earShape: e })}>{e}</Pill>))}</div>
              </Group>
              <Group title="Tail type">
                <div className="flex flex-wrap gap-2">{TAILS.map((t) => (<Pill key={t} active={cat.tail === t} onClick={() => update({ tail: t })}>{t}</Pill>))}</div>
              </Group>
              <Group title="Height">
                <Slider value={cat.height} min={0.85} max={1.25} step={0.01} onChange={(v) => update({ height: v })} />
              </Group>
              <Group title="Build (weight)">
                <Slider value={cat.build} min={0.8} max={1.2} step={0.01} onChange={(v) => update({ build: v })} />
              </Group>
              <Group title="Scars">
                <div className="flex flex-wrap gap-2">
                  {SCAR_OPTIONS.map((s) => (
                    <Pill key={s} active={cat.scars.includes(s)} onClick={() => update({
                      scars: cat.scars.includes(s) ? cat.scars.filter(x => x !== s) : [...cat.scars, s],
                    })}>{s}</Pill>
                  ))}
                </div>
              </Group>
              <Group title="Pupil size">
                <Slider value={cat.pupilSize ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => update({ pupilSize: v })} />
                <div className="text-[11px] opacity-60 mt-1">Pinprick to wide-blown — affects how alert your cat looks.</div>
              </Group>
              <Group title="Vision">
                <div className="flex flex-wrap gap-2">
                  {(['normal','half-blind','blind'] as const).map((v) => (
                    <Pill key={v} active={(cat.vision ?? 'normal') === v} onClick={() => update({ vision: v })}>{v}</Pill>
                  ))}
                </div>
                <div className="text-[11px] opacity-60 mt-1">Half-blind dims one side of the screen. Blind cats see only soft shapes.</div>
              </Group>
              <Group title="Night vision">
                <button
                  onClick={() => update({ nightVision: !cat.nightVision })}
                  className={`px-3 py-1.5 rounded border text-xs ${cat.nightVision ? 'border-thunder bg-thunder/20' : 'border-white/10 hover:bg-white/5'}`}
                >
                  {cat.nightVision ? '✓ Night vision' : 'No night vision'}
                </button>
                <div className="text-[11px] opacity-60 mt-1">Brightens the world after dusk.</div>
              </Group>
            </>
          )}

          {tab === 'size' && (
            <Group title="Size">
              <div className="grid grid-cols-5 gap-2 text-center">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ size: s })}
                    className={`p-3 rounded border ${cat.size === s ? 'border-thunder bg-thunder/20' : 'border-white/10 hover:bg-white/5'}`}
                  >
                    <div className="text-xs uppercase tracking-wide">{s}</div>
                    <div className="text-[10px] opacity-70 mt-1">×{SIZE_STATS[s].scale.toFixed(2)}</div>
                  </button>
                ))}
              </div>
              <div className="text-xs opacity-70 mt-2">
                Size shapes the cat's place in the forest: tiny cats slip past undergrowth, massive cats overpower in a fight.
              </div>
            </Group>
          )}

          {tab === 'clan' && (
            <>
              <Group title="Clan">
                <div className="grid gap-2">
                  {CLAN_LIST.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => update({ clan: c.id as ClanId, role: defaultRoleForClan(c.id) })}
                      className={`text-left p-3 rounded border flex gap-3 items-start ${cat.clan === c.id ? 'border-bone' : 'border-white/10 hover:bg-white/5'}`}
                    >
                      <div className="w-3 h-3 mt-1 rounded-full" style={{ background: c.color }} />
                      <div>
                        <div className="font-display">{c.name}</div>
                        <div className="text-xs opacity-70">{c.motto}</div>
                        <div className="text-[10px] opacity-60 mt-1">Scent: {c.scent}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Group>
              <Group title="Role">
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_LIST.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => update({ role: r.id as RoleId })}
                      className={`text-left p-2 rounded border ${cat.role === r.id ? 'border-thunder bg-thunder/20' : 'border-white/10 hover:bg-white/5'}`}
                    >
                      <div className="text-xs uppercase">{r.label}</div>
                      <div className="text-[10px] opacity-70 line-clamp-2">{r.duties[0]}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[11px] opacity-60 mt-2">
                  Note: Leader and Deputy are also assigned automatically by who joins a server first.
                </div>
              </Group>
            </>
          )}

          {tab === 'name' && (
            <>
              <Group title="Prefix">
                <SelectGrid options={PREFIX_OPTIONS} value={cat.prefix} onChange={(v) => update({ prefix: v })} />
              </Group>
              <Group title="Suffix">
                <SelectGrid options={SUFFIX_OPTIONS} value={cat.suffix} onChange={(v) => update({ suffix: v })} />
              </Group>
              <Group title="Custom name">
                <input
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm"
                  value={cat.name}
                  maxLength={24}
                  onChange={(e) => { setCat((c) => ({ ...c, name: e.target.value })); setNameError(''); }}
                />
                {nameError && <div className="text-xs text-thunder mt-1">{nameError}</div>}
              </Group>
            </>
          )}

          {tab === 'voice' && (
            <>
              <Group title="Chat bubble style">
                <div className="grid grid-cols-2 gap-2">
                  {BUBBLES.map((b) => (
                    <Pill key={b} active={cat.bubbleStyle === b} onClick={() => update({ bubbleStyle: b })}>{b}</Pill>
                  ))}
                </div>
              </Group>
              <Group title="Voice pitch">
                <Slider value={cat.voicePitch} min={0.5} max={1.5} step={0.01} onChange={(v) => update({ voicePitch: v })} />
                <div className="text-[11px] opacity-60 mt-1">Affects mew pitch on chat sends.</div>
              </Group>
            </>
          )}
        </div>

        <footer className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t-2 border-thunder/40 bg-forest-900 space-y-2 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
          {savedToast && (
            <div className="rounded-lg bg-forest-500/40 border border-forest-300/50 text-forest-50 text-xs text-center py-1.5 animate-fade-in">
              ✓ Morph saved. Keep tweaking, or press Play to enter the forest.
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onCancel}
              className="rounded-xl border-2 border-white/25 bg-black/30 hover:bg-black/50 active:scale-95 transition py-3 text-sm text-bone"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl bg-forest-500 hover:bg-forest-500/90 active:scale-95 transition border-2 border-forest-300/60 text-white font-display text-base py-3 shadow-lg"
              title="Save your morph and keep editing"
            >
              💾 Save
            </button>
            <button
              onClick={handlePlay}
              className="rounded-xl bg-thunder hover:bg-thunder/90 active:scale-95 transition border-2 border-thunder/80 text-white font-display text-base py-3 shadow-lg"
              title="Save and enter the forest"
            >
              ▶ Play
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide opacity-70 mb-2">{title}</div>
      {children}
    </div>
  );
}
function Pill({ active, onClick, children }: any) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs border ${active ? 'bg-thunder/30 border-thunder text-bone' : 'border-white/15 hover:bg-white/5'}`}>
      {children}
    </button>
  );
}
function Swatches({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((c) => (
        <button key={c} onClick={() => onChange(c)} title={c}
          style={{ background: c }}
          className={`w-8 h-8 rounded-full border-2 ${value === c ? 'border-bone' : 'border-white/10'}`} />
      ))}
    </div>
  );
}
function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} className="flex-1"
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      <div className="text-[11px] tabular-nums opacity-80 w-10 text-right">{value.toFixed(2)}</div>
    </div>
  );
}
function SelectGrid({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded text-xs border ${value === o ? 'border-bone bg-white/10' : 'border-white/10 hover:bg-white/5'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  const pct = Math.min(1, v / 1.5);
  return (
    <div className="bg-black/45 rounded-lg px-2.5 py-1.5">
      <div className="flex justify-between text-[10px] uppercase tracking-wide opacity-80">
        <span>{label}</span>
        <span>×{v.toFixed(2)}</span>
      </div>
      <div className="h-1 bg-white/10 rounded mt-1 overflow-hidden">
        <div className="h-full bg-thunder" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
