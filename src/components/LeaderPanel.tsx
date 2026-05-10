'use client';

import { useGameStore } from '@/game/useGameStore';

interface Props {
  onClose: () => void;
  onCommand: (kind: string, payload?: any) => void;
}

export function LeaderPanel({ onClose, onCommand }: Props) {
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const me = players[selfId];
  if (!me) return null;
  const isLeader = me.isLeader;
  const others = Object.values(players).filter((p) => p.socketId !== selfId);

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
            <Action label="Call a Gathering" onClick={() => onCommand('gathering')} />
            <Action label="Declare war on a clan" onClick={() => {
              const target = prompt('Which clan? (ThunderClan, RiverClan, ShadowClan, WindClan)') || '';
              if (target) onCommand('war', { target });
            }} />
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
