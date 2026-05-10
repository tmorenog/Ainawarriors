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

const FUR_BASES = ['#3a2618','#5b3a25','#7a5a3a','#9c8268','#c9b59b','#e3d5b8','#1d1d1d','#444','#888','#bdbdbd','#f4f1ea','#9c4a22','#c46a32','#e2a456','#5a4a2a'];
const FUR_BELLY = ['#f4f1ea','#e3d5b8','#c9b59b','#9c8268','#444'];
const PATTERN_COLORS = ['#3a2618','#1d1d1d','#5b3a25','#9c4a22','#7a5a3a','#888','#444','#222'];
const FUR_PATTERNS: FurPattern[] = ['solid','tabby','tortoiseshell','calico','point','bicolor','spotted'];
const EYE_COLORS: EyeColor[] = ['amber','green','blue','yellow','copper','hazel','odd'];
const EARS: EarShape[] = ['standard','tufted','rounded','curl'];
const TAILS: TailType[] = ['long','short','fluffy','kink'];
const SIZES: SizeTier[] = ['tiny','small','medium','large','massive'];
const BUBBLES: CatAppearance['bubbleStyle'][] = ['classic','cloud','leaf','stone'];

interface Props {
  onSave: (cat: CatAppearance) => void;
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
    eyeColor: rand(EYE_COLORS),
    earShape: 'standard',
    tail: 'long',
    fluffiness: 0.4,
    size: 'medium',
    height: 1.0,
    build: 1.0,
    scars: [],
    clan: 'ThunderClan',
    role: 'Warrior',
    bubbleStyle: 'classic',
    voicePitch: 1.0,
  };
}

export function CharacterCreator({ onSave, onCancel }: Props) {
  const existing = useGameStore((s) => s.cat);
  const [cat, setCat] = useState<CatAppearance>(() => existing ? normalizeCat(existing) : makeDefault());
  const [tab, setTab] = useState<'fur' | 'shape' | 'size' | 'clan' | 'name' | 'voice'>('fur');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    setCat((c) => ({ ...c, name: `${c.prefix}${c.suffix}` }));
  }, [cat.prefix, cat.suffix]);

  const stats = SIZE_STATS[cat.size];
  const clan = CLANS[cat.clan];

  const update = (patch: Partial<CatAppearance>) => setCat((c) => ({ ...c, ...patch }));

  const trySave = () => {
    const safe = safeUsername(cat.name);
    if (!safe) { setNameError('Pick a kinder, simpler name (2–24 letters).'); return; }
    const final: CatAppearance = { ...cat, name: safe };
    patchSave({ cat: final });
    onSave(final);
  };

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr_auto] md:grid-cols-[1fr_420px] md:grid-rows-1 bg-forest-900 text-bone">
      {/* Preview */}
      <div className="relative md:col-start-1 row-start-2 md:row-start-1 min-h-[40vh] bg-gradient-to-b from-forest-700 to-forest-900">
        <Canvas camera={{ position: [2.6, 1.4, 2.6], fov: 38 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={1} castShadow />
          <Cat cat={cat} anim="idle" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[5, 32]} />
            <meshStandardMaterial color={'#3b4d2c'} roughness={1} />
          </mesh>
          <OrbitControls enablePan={false} minDistance={2} maxDistance={6} target={[0, 0.4, 0]} />
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

      {/* Controls */}
      <div className="md:col-start-2 row-start-3 md:row-start-1 flex flex-col bg-forest-900 border-l border-white/10 max-h-screen md:max-h-none overflow-hidden">
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

        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-sm">
          {tab === 'fur' && (
            <>
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
              <Group title="Pattern color">
                <Swatches options={PATTERN_COLORS} value={cat.patternColor} onChange={(v) => update({ patternColor: v })} />
              </Group>
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

        <footer className="p-3 border-t border-white/10 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="rounded-xl border border-white/15 py-2.5">Cancel</button>
          <button onClick={trySave} className="rounded-xl bg-thunder font-display text-lg py-2.5 shadow">SAVE</button>
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
