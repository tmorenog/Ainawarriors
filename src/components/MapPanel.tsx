'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { CLANS, CLAN_LIST } from '@/lib/clans';
import { NPCS } from '@/lib/npcs';

// Tappable top-down map of the territory. Shows every clan camp, the
// labelled dens around each (high rock + four den types), the Moonpool, the
// twoleg place, the river, and the two NPC characters. Tapping any marker
// (or anywhere else on the map) sets the global waypoint — the on-screen
// WaypointArrow will then point you there until you arrive.
//
// World coordinates roughly span -300..+300 on both X and Z. We map that
// into a 320×320 pixel SVG square.
const MAP_SIZE = 320;          // pixels
const WORLD_HALF = 320;        // world units from centre to map edge

function worldToMap(x: number, z: number): { mx: number; my: number } {
  const mx = ((x + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE;
  // SVG y grows downward, so flip Z
  const my = ((-z + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE;
  return { mx, my };
}
function mapToWorld(mx: number, my: number): { x: number; z: number } {
  const x = (mx / MAP_SIZE) * (WORLD_HALF * 2) - WORLD_HALF;
  const z = -((my / MAP_SIZE) * (WORLD_HALF * 2) - WORLD_HALF);
  return { x, z };
}

interface Marker {
  label: string;
  x: number;
  z: number;
  tone: 'camp' | 'den' | 'spirit' | 'twoleg' | 'npc' | 'water';
}

function buildMarkers(): Marker[] {
  const m: Marker[] = [];
  // Clan camps + their dens (each camp has the same internal layout in
  // World.tsx). We use the same offsets so the labels match the world.
  for (const clan of CLAN_LIST) {
    if (clan.id === 'Rogue' || clan.id === 'Loner' || clan.id === 'KittyPet') {
      // Affiliations without bramble walls — just a single marker.
      m.push({ label: clan.name, x: clan.campCenter[0], z: clan.campCenter[2], tone: 'camp' });
      continue;
    }
    const cx = clan.campCenter[0], cz = clan.campCenter[2];
    m.push({ label: `${clan.name} camp`, x: cx, z: cz, tone: 'camp' });
    m.push({ label: `${clan.name} High Rock`, x: cx + 0, z: cz - 7, tone: 'den' });
    m.push({ label: `Leader's den`, x: cx + 3.2, z: cz - 6, tone: 'den' });
    m.push({ label: `Warriors' den`, x: cx + 5.5, z: cz + 4, tone: 'den' });
    m.push({ label: `Apprentices' den`, x: cx - 5.5, z: cz + 4, tone: 'den' });
    m.push({ label: `Medicine den`, x: cx - 3.5, z: cz - 5, tone: 'den' });
    m.push({ label: `Nursery`, x: cx - 7, z: cz - 1, tone: 'den' });
    m.push({ label: `Elders' den`, x: cx + 6, z: cz - 1, tone: 'den' });
    m.push({ label: `Training post`, x: cx - 3.5, z: cz - 3, tone: 'den' });
  }
  m.push({ label: 'Moonpool', x: -220, z: -220, tone: 'spirit' });
  m.push({ label: 'Twoleg place', x: 260, z: 240, tone: 'twoleg' });
  m.push({ label: 'River', x: 180, z: 0, tone: 'water' });
  m.push({ label: 'Firestar', x: NPCS.firestar.pos[0], z: NPCS.firestar.pos[2], tone: 'npc' });
  m.push({ label: 'Tigerstar', x: NPCS.tigerstar.pos[0], z: NPCS.tigerstar.pos[2], tone: 'npc' });
  return m;
}

const TONE_COLOR: Record<Marker['tone'], string> = {
  camp:    '#cdb673',
  den:     '#c9b59b',
  spirit:  '#7aa8d8',
  twoleg:  '#c46c6c',
  npc:     '#f08560',
  water:   '#3a78a8',
};

export function MapPanel() {
  const [open, setOpen] = useState(false);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const setWaypoint = useGameStore((s) => s.setWaypoint);
  const waypoint = useGameStore((s) => s.waypoint);

  const markers = buildMarkers();
  const me = players[selfId];
  const mePos = me ? worldToMap(me.pos[0], me.pos[2]) : null;

  // Only show camp + key labels at small zoom; full den list shows on tap.
  const camps = markers.filter((m) => m.tone === 'camp' || m.tone === 'spirit' || m.tone === 'twoleg' || m.tone === 'npc');
  const dens = markers.filter((m) => m.tone === 'den');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 bottom-[170px] z-30 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur w-12 h-12 grid place-items-center text-bone text-base font-display shadow-lg pointer-events-auto border border-white/15"
        title="Open territory map"
        aria-label="Open territory map"
      >
        🗺
      </button>
    );
  }

  const onMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * MAP_SIZE;
    const my = ((e.clientY - rect.top) / rect.height) * MAP_SIZE;
    const w = mapToWorld(mx, my);
    setWaypoint({ x: w.x, z: w.z, label: 'Waypoint' });
    setOpen(false);
  };

  const setTo = (m: Marker) => {
    setWaypoint({ x: m.x, z: m.z, label: m.label });
    setOpen(false);
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm pointer-events-auto p-4">
      <div className="w-full max-w-md rounded-2xl bg-forest-900 border border-thunder/40 shadow-2xl text-bone p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xl">Territory Map</div>
          <button onClick={() => setOpen(false)} className="text-xs opacity-60 hover:opacity-100 underline">close</button>
        </div>
        <p className="text-[11px] opacity-70 mb-2">
          Tap any landmark to drop a waypoint. The on-screen arrow will guide you there.
        </p>
        <div className="rounded-xl overflow-hidden border border-white/10 bg-forest-700/40">
          <svg
            viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
            className="w-full h-auto cursor-crosshair"
            onClick={onMapClick}
          >
            {/* Background terrain hint — mossy green */}
            <rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} fill="#3a4f2a" />
            {/* River band — the river runs near x ≈ 180 (a vertical strip on
                the map because we mapped world-x to screen-x). */}
            {(() => {
              const left = worldToMap(160, 0).mx;
              const right = worldToMap(200, 0).mx;
              return (
                <rect x={left} y={0} width={right - left} height={MAP_SIZE} fill="#3a78a8" opacity={0.7} />
              );
            })()}
            {/* Moor (windclan, low rolling flatland) west of x=-120 */}
            {(() => {
              const right = worldToMap(-120, 0).mx;
              return (
                <rect x={0} y={0} width={right} height={MAP_SIZE} fill="#7a8a4a" opacity={0.25} />
              );
            })()}
            {/* All markers */}
            {camps.map((m, i) => {
              const { mx, my } = worldToMap(m.x, m.z);
              return (
                <g
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setTo(m); }}
                  className="cursor-pointer"
                >
                  <circle cx={mx} cy={my} r={6} fill={TONE_COLOR[m.tone]} stroke="#000" strokeOpacity={0.4} />
                  <text x={mx + 8} y={my + 3} fontSize={9} fill="#fffbe6" style={{ paintOrder: 'stroke' }} stroke="#000" strokeWidth={2} strokeOpacity={0.6}>
                    {m.label}
                  </text>
                </g>
              );
            })}
            {/* Den dots — smaller, no labels (the sidebar list lets you pick by name) */}
            {dens.map((m, i) => {
              const { mx, my } = worldToMap(m.x, m.z);
              return (
                <g
                  key={`d${i}`}
                  onClick={(e) => { e.stopPropagation(); setTo(m); }}
                  className="cursor-pointer"
                >
                  <circle cx={mx} cy={my} r={2.5} fill={TONE_COLOR[m.tone]} opacity={0.85} />
                </g>
              );
            })}
            {/* You */}
            {mePos && (
              <g>
                <circle cx={mePos.mx} cy={mePos.my} r={8} fill="none" stroke="#ffffff" strokeWidth={1.5}>
                  <animate attributeName="r" values="6;9;6" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle cx={mePos.mx} cy={mePos.my} r={3.5} fill="#ffffff" />
              </g>
            )}
            {/* Active waypoint */}
            {waypoint && (() => {
              const { mx, my } = worldToMap(waypoint.x, waypoint.z);
              return (
                <g>
                  <circle cx={mx} cy={my} r={10} fill="none" stroke="#cdb673" strokeWidth={1.5} />
                  <line x1={mx - 8} y1={my} x2={mx + 8} y2={my} stroke="#cdb673" strokeWidth={1.5} />
                  <line x1={mx} y1={my - 8} x2={mx} y2={my + 8} stroke="#cdb673" strokeWidth={1.5} />
                </g>
              );
            })()}
          </svg>
        </div>
        {/* Quick list of dens — tap a name to drop a waypoint there */}
        <div className="mt-3 max-h-32 overflow-y-auto text-[11px]">
          <div className="opacity-60 uppercase tracking-wider text-[10px] mb-1">Dens (tap to set waypoint)</div>
          <div className="grid grid-cols-2 gap-1">
            {dens.map((m, i) => (
              <button
                key={`btn${i}`}
                onClick={() => setTo(m)}
                className="text-left px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-bone/90"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {waypoint && (
            <button
              onClick={() => { setWaypoint(null); }}
              className="text-xs rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5"
            >
              Clear waypoint
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-xs rounded-lg bg-thunder hover:bg-thunder/90 px-3 py-1.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
