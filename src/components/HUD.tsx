'use client';

import { useGameStore } from '@/game/useGameStore';
import { CLANS } from '@/lib/clans';
import { HERBS } from '@/lib/herbs';
import { adjustCameraZoom } from '@/game/CameraRig';
import { getAudioEngine } from '@/game/audio';
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

  const gathering = useGameStore((s) => s.gathering);
  const setGathering = useGameStore((s) => s.setGathering);
  const fishing = useGameStore((s) => s.fishing);
  const setFishing = useGameStore((s) => s.setFishing);

  // The river runs at x ≈ 180 (see makeTerrain in World.tsx). We show the
  // "Fish" button only when the player's record places them within that
  // band, so fishing is rooted in the world (RiverClan territory).
  const meForFish = players[selfId];
  const inRiver = !!meForFish && Math.abs(meForFish.pos[0] - 180) < 22;

  const gather = () => {
    if (gathering) return; // already searching
    setGathering(true);
    // ~2 second forage cutscene. Roughly 70% chance of finding something
    // useful, otherwise the player comes up empty — gathering should feel
    // like a real little ritual instead of free clicks.
    setTimeout(() => {
      const success = Math.random() < 0.7;
      if (success) {
        const pool = HERBS;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        addHerb(pick.id, 1);
        useGameStore.getState().bumpTask('gather-herbs-n', 1);
        pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: `You found ${pick.name}.`, at: Date.now() });
      } else {
        const reasons = [
          'Nothing useful grows here today.',
          'A twoleg has trampled the patch — try elsewhere.',
          'You sniff and dig, but the leaves are already gone.',
          'Only ragwort here, and that’s no use.',
        ];
        pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: reasons[Math.floor(Math.random() * reasons.length)], at: Date.now() });
      }
      setGathering(false);
    }, 2000);
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
        <button onClick={gather} disabled={gathering} className={`rounded-full px-3 py-2 text-xs shadow ${gathering ? 'bg-forest-700/40 cursor-wait' : 'bg-forest-700'}`}>
          {gathering ? 'Searching the undergrowth…' : 'Gather herbs'}
        </button>
        <button onClick={() => setShowHerbs((v) => !v)} className="rounded-full bg-forest-700 px-3 py-2 text-xs shadow">
          Herb pouch ({Object.values(herbInventory).reduce((a, b) => a + b, 0)})
        </button>
        <button
          onClick={triggerSleep}
          className="rounded-full bg-river/80 hover:bg-river px-3 py-2 text-xs shadow"
          title="Sleep — runs the loaf → curl → deep cutscene and skips to dawn"
        >
          Sleep at den
        </button>
        {inRiver && (
          <button
            onClick={() => fish(setFishing, setCarrying, pushChat, carrying)}
            disabled={fishing}
            className={`rounded-full px-3 py-2 text-xs shadow ${fishing ? 'bg-river/30 cursor-wait' : 'bg-river/90 hover:bg-river'}`}
            title="Fish in the RiverClan river — chance of a real fish, takes a moment"
          >
            {fishing ? 'Watching the water…' : '🐟 Fish in river'}
          </button>
        )}
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
                          useGameStore.getState().bumpTask('use-herb-n', 1);
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
        wotc-22 · eat the pile + chat top
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

// Fishing — RiverClan-style. The cat crouches over the bank for ~2.5s,
// then either snags a fish (added to `carrying` so you can drop it on the
// fresh-kill pile) or comes up empty. Takes the same throttling pattern
// as the gather cutscene.
function fish(
  setFishing: (v: boolean) => void,
  setCarrying: (s: string | null) => void,
  pushChat: ReturnType<typeof useGameStore.getState>['pushChat'],
  carrying: string | null,
) {
  const s = useGameStore.getState();
  if (s.fishing) return;
  setFishing(true);
  setTimeout(() => {
    const success = Math.random() < 0.6;
    if (success) {
      // Slot the fish into the carrying slot if free, otherwise just count
      // it directly and credit the catch.
      if (!carrying) setCarrying('fish');
      const cur = useGameStore.getState();
      cur.bumpTask('catch-any-n', 1);
      cur.bumpTask('catch-fish-n', 1);
      cur.bumpTask('pounce-streak', 1);
      pushChat({
        id: 'sys' + Date.now(),
        fromId: 'system',
        fromName: 'StarClan',
        scope: 'system',
        text: 'You hook a silver fish from the shallows!',
        at: Date.now(),
      });
    } else {
      const reasons = [
        'The fish darts away — too fast.',
        'A heron startles your prey.',
        'The water is muddy from the rain. Nothing today.',
        'You miss your strike — water flies, fish gone.',
      ];
      pushChat({
        id: 'sys' + Date.now(),
        fromId: 'system',
        fromName: 'StarClan',
        scope: 'system',
        text: reasons[Math.floor(Math.random() * reasons.length)],
        at: Date.now(),
      });
    }
    setFishing(false);
  }, 2500);
}

// Multi-stage sleep cutscene shared between the HUD's "Sleep at den" button
// and Book Mode's curl-up objective. Stages: loaf → curl → deep → wake at
// dawn. The cat's anim is driven by sleepStage in the game frame loop.
function triggerSleep() {
  const s = useGameStore.getState();
  if (s.sleeping) return;
  try { getAudioEngine().setMode('sleep'); } catch {}
  s.setSleeping(true);
  s.setSleepStage('loaf');
  setTimeout(() => useGameStore.getState().setSleepStage('curl'), 1500);
  setTimeout(() => useGameStore.getState().setSleepStage('deep'), 3000);
  setTimeout(() => {
    const cur = useGameStore.getState();
    cur.setSleepStage('waking');
    const room = cur.room;
    if (room) cur.setRoom({ ...room, timeOfDay: 0.27 });
    // Sleep restores HP/stamina/hunger a bit
    cur.setHud({
      hp: Math.min(100, cur.hud.hp + 30),
      stamina: 100,
      hunger: Math.min(100, cur.hud.hunger + 12),
    });
  }, 7000);
  setTimeout(() => {
    useGameStore.getState().setSleepStage('idle');
    useGameStore.getState().setSleeping(false);
  }, 7800);
}

function formatTime(t: number) {
  const hours = Math.floor((t * 24 + 6) % 24);
  const mins = Math.floor(((t * 24 * 60) % 60));
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = ((hours + 11) % 12) + 1;
  return `${h12}:${mins.toString().padStart(2, '0')} ${period}`;
}
