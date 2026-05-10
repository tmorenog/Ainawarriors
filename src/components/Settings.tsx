'use client';

import { useGameStore } from '@/game/useGameStore';
import { patchSave } from '@/lib/persist';
import { WARRIOR_CODE } from '@/lib/warriorCode';

interface Props {
  onClose: () => void;
  onEditCat: () => void;
}

export function SettingsPanel({ onClose, onEditCat }: Props) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);

  const change = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    patchSave({ settings: next });
  };

  return (
    <div className="absolute inset-0 z-40 bg-black/65 backdrop-blur grid place-items-center text-bone p-4 pointer-events-auto">
      <div className="w-full max-w-md bg-forest-900 border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-2xl">Settings</div>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">close</button>
        </div>

        <Section title="Graphics">
          <div className="grid grid-cols-3 gap-2">
            {(['low','medium','high'] as const).map((g) => (
              <button key={g} onClick={() => change({ graphics: g })}
                className={`py-2 rounded ${settings.graphics === g ? 'bg-thunder' : 'bg-white/5 hover:bg-white/10'}`}>
                {g}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Camera">
          <div className="grid grid-cols-2 gap-2">
            {(['third','first'] as const).map((m) => (
              <button key={m} onClick={() => change({ cameraMode: m })}
                className={`py-2 rounded ${settings.cameraMode === m ? 'bg-thunder' : 'bg-white/5 hover:bg-white/10'}`}>
                {m === 'third' ? 'Third-person' : 'First-person'}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Audio">
          <div className="flex flex-col gap-2 text-xs">
            <label>Sound: {(settings.sound * 100).toFixed(0)}%
              <input type="range" min={0} max={1} step={0.05} value={settings.sound} onChange={(e) => change({ sound: parseFloat(e.target.value) })} className="w-full" />
            </label>
            <label>Music: {(settings.music * 100).toFixed(0)}%
              <input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => change({ music: parseFloat(e.target.value) })} className="w-full" />
            </label>
          </div>
        </Section>

        <Section title="Accessibility">
          <label className="text-xs">UI Scale: {settings.uiScale.toFixed(2)}×
            <input type="range" min={0.85} max={1.4} step={0.05} value={settings.uiScale} onChange={(e) => change({ uiScale: parseFloat(e.target.value) })} className="w-full" />
          </label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(['none','protanopia','deuteranopia','tritanopia'] as const).map((m) => (
              <button key={m} onClick={() => change({ colorblind: m })}
                className={`py-1.5 rounded text-xs ${settings.colorblind === m ? 'bg-thunder' : 'bg-white/5 hover:bg-white/10'}`}>
                {m}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-2 text-xs">
            <input type="checkbox" checked={settings.invertY} onChange={(e) => change({ invertY: e.target.checked })} /> Invert Y look
          </label>
        </Section>

        <Section title="Warrior Code">
          <ol className="text-[11px] opacity-90 space-y-1 list-decimal pl-4 max-h-40 overflow-y-auto">
            {WARRIOR_CODE.map((r) => <li key={r.id}>{r.text}</li>)}
          </ol>
        </Section>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={onEditCat} className="rounded-xl bg-white/10 hover:bg-white/20 py-2.5">Edit Cat</button>
          <button onClick={onClose} className="rounded-xl bg-thunder py-2.5 font-display">Done</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wide opacity-70 mb-1">{title}</div>
      {children}
    </div>
  );
}
