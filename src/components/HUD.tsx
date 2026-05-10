'use client';

import { useGameStore } from '@/game/useGameStore';
import { CLANS } from '@/lib/clans';
import { HERBS } from '@/lib/herbs';
import { adjustCameraZoom } from '@/game/CameraRig';
import { useState } from 'react';

export function HUD({ onOpenSettings, onOpenLeader }: { onOpenSettings: () => void; onOpenLeader: () => void }) {
  const cat = useGameStore((s) => s.cat);
  const hud = useGameStore((s) => s.hud);
  const room = useGameStore((s) => s.room);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const carrying = useGameStore((s) => s.carrying);
  const setCarrying = useGameStore((s) => s.setCarrying);
  const setHud = useGameStore((s) => s.setHud);
  const herbInventory = useGameStore((s) => s.herbInventory);
  const addHerb = useGameStore((s) => s.addHerb);
  const consumeHerb = useGameStore((s) => s.consumeHerb);
  const questText = useGameStore((s) => s.questText);
  const pushChat = useGameStore((s) => s.pushChat);
  const settings = useGameStore((s) => s.settings);

  const [showHerbs, setShowHerbs] = useState(false);

  if (!cat || !room) return null;
  const me = players[selfId];
  const isLeader = me?.isLeader;
  const isDeputy = me?.isDeputy;

  const time = formatTime(room.timeOfDay);
  const clan = CLANS[cat.clan];

  const drop = () => {
    if (!carrying) return;
    setCarrying(null);
    setHud({ hunger: Math.min(100, hud.hunger + 8) });
    pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: `You added a ${carrying} to the fresh-kill pile.`, at: Date.now() });
  };

  const gather = () => {
    const pool = HERBS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    addHerb(pick.id, 1);
    pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: `You found ${pick.name}.`, at: Date.now() });
  };

  return (
    <div className="absolute inset-0 pointer-events-none text-bone" style={{ fontSize: `${14 * settings.uiScale}px` }}>
      {/* top bar */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-auto">
        <div className="bg-black/45 backdrop-blur rounded-xl px-3 py-2 max-w-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: clan.color }} />
            <span className="font-display text-base">{cat.name}</span>
            {isLeader && <span className="text-[10px] px-1.5 py-0.5 rounded bg-thunder">Leader</span>}
            {isDeputy && <span className="text-[10px] px-1.5 py-0.5 rounded bg-river">Deputy</span>}
          </div>
          <div className="text-[11px] opacity-80">{cat.role} · {clan.name}</div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
            <Bar label="HP" v={hud.hp} color="#c64a4a" />
            <Bar label="Hunger" v={hud.hunger} color="#cdb673" />
            <Bar label="Stamina" v={hud.stamina} color="#5fb85f" />
          </div>
          <div className="text-[10px] mt-1 opacity-70">Reputation: {hud.reputation}/100</div>
        </div>

        <div className="bg-black/45 backdrop-blur rounded-xl px-3 py-2 text-xs text-right">
          <div>{time} · {room.season} · {room.weather}</div>
          <div className="opacity-70">{Object.keys(players).length} cat(s) nearby</div>
          <div className="opacity-60 text-[10px] mt-1">Room: {room.roomId}</div>
        </div>
      </div>

      {/* Quest tracker */}
      <div className="absolute top-24 right-3 bg-black/45 backdrop-blur rounded-xl px-3 py-2 text-xs max-w-[220px] pointer-events-auto">
        <div className="text-[10px] uppercase tracking-wide opacity-70">Quest</div>
        <div>{questText}</div>
      </div>

      {/* bottom-left action buttons */}
      <div className="absolute left-3 bottom-3 flex flex-col gap-2 pointer-events-auto">
        {carrying && (
          <button onClick={drop} className="rounded-full bg-thunder px-3 py-2 text-xs shadow">Drop {carrying} at camp pile</button>
        )}
        <button onClick={gather} className="rounded-full bg-forest-700 px-3 py-2 text-xs shadow">Gather herbs</button>
        <button onClick={() => setShowHerbs((v) => !v)} className="rounded-full bg-forest-700 px-3 py-2 text-xs shadow">
          Herb pouch ({Object.values(herbInventory).reduce((a, b) => a + b, 0)})
        </button>
        {(isLeader || isDeputy) && (
          <button onClick={onOpenLeader} className="rounded-full bg-river px-3 py-2 text-xs shadow">Leader actions</button>
        )}
      </div>

      {/* bottom-right action buttons */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-2 pointer-events-auto">
        <div className="flex flex-col gap-1 items-stretch">
          <button
            onClick={() => adjustCameraZoom(-1.2)}
            className="rounded-t-xl bg-black/55 hover:bg-black/75 px-3 py-2 text-base font-bold shadow border-b border-white/10"
            title="Zoom in (or scroll up / pinch out)"
          >+</button>
          <button
            onClick={() => adjustCameraZoom(1.2)}
            className="rounded-b-xl bg-black/55 hover:bg-black/75 px-3 py-2 text-base font-bold shadow"
            title="Zoom out (or scroll down / pinch in)"
          >−</button>
        </div>
        <button onClick={onOpenSettings} className="rounded-full bg-black/45 px-3 py-2 text-xs shadow">Settings</button>
      </div>

      {showHerbs && (
        <div className="absolute left-3 bottom-32 bg-black/70 backdrop-blur rounded-xl p-3 text-xs max-w-xs pointer-events-auto">
          <div className="font-display mb-1">Herbs</div>
          {Object.entries(herbInventory).filter(([, n]) => n > 0).length === 0 ? (
            <div className="opacity-70">Empty. Press “Gather herbs” when near grass.</div>
          ) : (
            <ul className="space-y-1">
              {Object.entries(herbInventory).map(([id, n]) => {
                if (!n) return null;
                const h = HERBS.find((x) => x.id === id);
                return (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span>{h?.name ?? id} <span className="opacity-60">×{n}</span></span>
                    <button
                      className="px-2 py-0.5 rounded bg-forest-500"
                      onClick={() => {
                        if (consumeHerb(id, 1)) {
                          setHud({ hp: Math.min(100, hud.hp + 12) });
                          pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: `You used ${h?.name ?? id}.`, at: Date.now() });
                        }
                      }}
                    >use</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Crosshair />
      <KeyHints />
      {/* Build marker — lets you verify which bundle is actually loaded.
          If you don't see "build wotc-08" after a hard reload, the deploy
          is serving an older bundle (clear cache / redeploy). */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 text-[10px] opacity-50 pointer-events-none">
        wotc-09 · quality pass
      </div>
    </div>
  );
}

function Bar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div>
      <div className="opacity-80">{label}</div>
      <div className="h-1.5 rounded bg-white/10 overflow-hidden">
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} />
      </div>
    </div>
  );
}

function Crosshair() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-bone/60 hidden md:block" />
  );
}

function KeyHints() {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-3 bg-black/40 rounded-full px-3 py-1.5 text-[10px] hidden md:flex gap-3 opacity-80">
      <span>WASD move</span><span>Shift sprint</span><span>C / Ctrl crouch</span><span>Q pounce</span><span>E interact</span><span>V camera</span>
    </div>
  );
}

function formatTime(t: number) {
  const hours = Math.floor((t * 24 + 6) % 24);
  const mins = Math.floor(((t * 24 * 60) % 60));
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = ((hours + 11) % 12) + 1;
  return `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
}
