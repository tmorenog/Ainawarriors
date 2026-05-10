'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/useGameStore';

interface Props {
  onClose: () => void;
  onCommand: (kind: string, payload?: any) => void;
}

export function LeaderPanel({ onClose, onCommand }: Props) {
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const pushChat = useGameStore((s) => s.pushChat);
  const me = players[selfId];
  const [announcement, setAnnouncement] = useState('');
  const [battleTarget, setBattleTarget] = useState('ShadowClan');
  if (!me) return null;
  const isLeader = me.isLeader;
  const others = Object.values(players).filter((p) => p.socketId !== selfId);

  const sendAnnouncement = () => {
    const text = announcement.trim();
    if (!text) return;
    onCommand('announce', { text });
    pushChat({
      id: 'sys' + Date.now(),
      fromId: 'system',
      fromName: `★ ${me.cat.name}`,
      scope: 'clan',
      text: `📣 ${text}`,
      at: Date.now(),
    });
    setAnnouncement('');
  };

  const declareBattle = () => {
    onCommand('battle-declare', { target: battleTarget });
    pushChat({
      id: 'sys' + Date.now(),
      fromId: 'system',
      fromName: `★ ${me.cat.name}`,
      scope: 'system',
      text: `${me.cat.clan} declares battle on ${battleTarget}! Warriors, to me!`,
      at: Date.now(),
    });
    useGameStore.getState().bumpTask('declare-battle', 1);
    // Spawn an enemy raid heading for your camp. 3 raiders, 60 HP each,
    // arriving at the player's camp from a random border direction.
    // The Raids component reads this and renders + animates them.
    const myClan = me.cat.clan;
    const camp = (() => {
      // Cheap inline lookup — only the 4 major clan camps.
      const map: Record<string, [number, number]> = {
        ThunderClan: [0, 0],
        RiverClan:   [180, -30],
        ShadowClan:  [-60, 180],
        WindClan:    [-200, 60],
      };
      return map[myClan] ?? [0, 0];
    })();
    const angle = Math.random() * Math.PI * 2;
    const spawnR = 18;
    const raiders = Array.from({ length: 3 }, (_, i) => ({
      id: 'raider_' + i + '_' + Math.random().toString(36).slice(2, 6),
      x: camp[0] + Math.cos(angle + i * 0.4) * spawnR,
      z: camp[1] + Math.sin(angle + i * 0.4) * spawnR,
      hp: 60,
      alive: true,
      clan: battleTarget,
    }));
    useGameStore.getState().setRaid({
      fromClan: battleTarget,
      until: Date.now() + 90_000,
      raiders,
    });
    useGameStore.getState().pushChat({
      id: 'sys' + Date.now(),
      fromId: 'system',
      fromName: 'StarClan',
      scope: 'system',
      text: `${battleTarget} warriors approach the camp! Defend or fall!`,
      at: Date.now(),
    });
  };

  return (
    <div className="absolute inset-0 z-40 bg-black/65 backdrop-blur grid place-items-center text-bone p-4 pointer-events-auto">
      <div className="w-full max-w-md bg-forest-900 border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-2xl">{isLeader ? 'Leader' : 'Deputy'} actions</div>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">close</button>
        </div>

        <Action label="Organize a hunting patrol" onClick={() => onCommand('patrol', { kind: 'hunt' })} />
        <Action label="Organize a border patrol" onClick={() => onCommand('patrol', { kind: 'border' })} />
        {isLeader && (
          <>
            {/* Free-form clan announcement */}
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide opacity-70 mb-1">Announcement</div>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Speak from the High Rock…"
                rows={2}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm"
                maxLength={240}
              />
              <button
                onClick={sendAnnouncement}
                disabled={!announcement.trim()}
                className="mt-1 w-full rounded bg-thunder hover:bg-thunder/90 disabled:bg-thunder/30 px-3 py-2 text-sm font-display"
              >
                📣 Announce to the clan
              </button>
            </div>

            {/* Declare battle */}
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide opacity-70 mb-1">Declare battle</div>
              <div className="flex gap-2">
                <select
                  value={battleTarget}
                  onChange={(e) => setBattleTarget(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm"
                >
                  {['ThunderClan', 'RiverClan', 'ShadowClan', 'WindClan']
                    .filter((c) => c !== me.cat.clan)
                    .map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={declareBattle} className="rounded bg-river hover:bg-river/90 px-3 py-1.5 text-sm font-display">
                  ⚔ Declare
                </button>
              </div>
              <div className="text-[10px] opacity-60 mt-1">
                A battle marker drops at the border; warriors who hear it can rally.
              </div>
            </div>

            <Action label="Call a Gathering" onClick={() => onCommand('gathering')} />
          </>
        )}

        <div className="text-xs uppercase tracking-wide opacity-70 mt-4 mb-2">Clan members</div>
        <ul className="space-y-1 text-xs">
          {others.length === 0 && <li className="opacity-60">No one else here yet.</li>}
          {others.map((p) => (
            <li key={p.socketId} className="flex items-center justify-between gap-2 bg-white/5 rounded px-2 py-1.5">
              <span>{p.cat.name} <span className="opacity-60">· {p.cat.role}</span></span>
              <span className="flex gap-1">
                {isLeader && (
                  <>
                    <button className="px-2 py-0.5 rounded bg-thunder/40 hover:bg-thunder/60" onClick={() => onCommand('promote', { id: p.socketId })}>promote</button>
                    <button className="px-2 py-0.5 rounded bg-river/40 hover:bg-river/60" onClick={() => onCommand('appoint_deputy', { id: p.socketId })}>deputy</button>
                    <button className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20" onClick={() => onCommand('apprentice', { id: p.socketId })}>apprentice</button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="block w-full text-left bg-white/5 hover:bg-white/10 rounded px-3 py-2 mb-1.5 text-sm">
      {label}
    </button>
  );
}
