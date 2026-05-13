'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { CLANS } from '@/lib/clans';
import { terrainHeightAt } from '@/game/terrain';

// Lyric cards for the Graystripe flashback. Times are seconds since
// cutscene start. The audio hook plays /two-birds.mp3 starting at 1:04
// if the user has dropped a copy in /public, so the lyric timings are
// chosen against the song from 1:04 onward (~2:30 of the song).
const TWO_BIRDS_LYRICS: Array<{ at: number; text: string }> = [
  { at: 0,    text: 'Two birds on a wire…' },
  { at: 4,    text: 'One tries to fly away,' },
  { at: 8,    text: 'And the other watches him close from that wire.' },
  { at: 14,   text: 'He says he wants to as well, but he is a liar.' },
  { at: 22,   text: 'I\'ll believe it all — there\'s nothing I won\'t understand.' },
  { at: 30,   text: 'I\'ll believe it all — I won\'t let go of your hand.' },
  { at: 40,   text: 'Two birds on a wire…' },
  { at: 48,   text: 'One says "Come on," and the other says "I\'m tired."' },
  { at: 56,   text: 'The sky is overcast, and I\'m sorry.' },
  { at: 64,   text: 'One more or one less — nobody\'s worried.' },
  { at: 74,   text: 'Two birds of a feather, say that they\'re always gonna stay together.' },
  { at: 84,   text: 'But one\'s never going to let go of that wire,' },
  { at: 90,   text: 'He says that he will, but he\'s just a liar.' },
];

function useElapsedSeconds(active: boolean): number {
  const [t, setT] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!active) { setT(0); return; }
    startRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      setT((performance.now() - startRef.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

// Tries to play /two-birds.mp3 from offset 64s (= 1:04). Silently no-ops
// if the file is missing — keeps the cutscene legal & shippable, and
// lets the user drop their own (legally obtained) copy into /public.
function useTwoBirdsAudio(active: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!active) {
      try { audioRef.current?.pause(); } catch {}
      audioRef.current = null;
      return;
    }
    const a = new Audio('/two-birds.mp3');
    a.currentTime = 64;
    a.volume = 0.7;
    audioRef.current = a;
    const onLoaded = () => {
      try { a.currentTime = 64; a.play().catch(() => {}); } catch {}
    };
    a.addEventListener('loadedmetadata', onLoaded);
    // Try to play immediately too — some browsers don't fire loadedmetadata
    // if the file is cached.
    try { a.play().catch(() => {}); } catch {}
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      try { a.pause(); } catch {}
    };
  }, [active]);
}

export function CutsceneOverlay() {
  const cutscene = useGameStore((s) => s.cutscene);
  const setCutscene = useGameStore((s) => s.setCutscene);
  const cat = useGameStore((s) => s.cat);
  const setHud = useGameStore((s) => s.setHud);
  const pushChat = useGameStore((s) => s.pushChat);
  const setChapterIndex = useGameStore((s) => s.setChapterIndex);
  const chapterIndex = useGameStore((s) => s.chapterIndex);
  const setQuest = useGameStore((s) => s.setQuest);

  const t = useElapsedSeconds(!!cutscene);
  // Only the Graystripe flashback hooks the audio
  useTwoBirdsAudio(cutscene?.kind === 'graystripe-flashback');

  // Auto-advance / cleanup based on cutscene kind
  useEffect(() => {
    if (!cutscene) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    if (cutscene.kind === 'wasted') {
      // 3.5s wasted, then transition into the StarClan walk
      timers.push(setTimeout(() => setCutscene({ kind: 'starclan-walk', startedAt: Date.now() }), 3500));
    } else if (cutscene.kind === 'starclan-walk') {
      // Walk lasts ~6s, then respawn
      timers.push(setTimeout(() => {
        if (!cat) { setCutscene(null); return; }
        const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
        // Teleport via the global flag the PlayerController watches
        try { (window as any).__WOTC_RESPAWN__ = { x: cx, z: cz }; } catch {}
        setHud({ hp: 90, hunger: 60, stamina: 90 });
        pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: 'You return to your camp. Walk softly — the stars are watching.', at: Date.now() });
        setCutscene(null);
      }, 6000));
    } else if (cutscene.kind === 'kidnap') {
      // 5s being carried away, then respawn at camp
      timers.push(setTimeout(() => {
        if (!cat) { setCutscene(null); return; }
        const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
        try { (window as any).__WOTC_RESPAWN__ = { x: cx, z: cz }; } catch {}
        setHud({ hp: 70, hunger: 40, stamina: 60 });
        pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: 'You wake in your nest. The twoleg cage is a memory — but a sharp one.', at: Date.now() });
        setCutscene(null);
      }, 5000));
    } else if (cutscene.kind === 'firestar-dies') {
      // 5s of red-orange title with text, then auto-roll into the flashback
      timers.push(setTimeout(() => setCutscene({ kind: 'graystripe-flashback', startedAt: Date.now() }), 5000));
    } else if (cutscene.kind === 'graystripe-flashback') {
      // ~95s of song from 1:04 to ~2:39 — then close, set quest, advance chapter
      timers.push(setTimeout(() => {
        if (chapterIndex < 5) setChapterIndex(5); // The Darkest Hour
        setQuest('Find Graystripe — twolegs took him from the river bank.');
        pushChat({ id: 'sys' + Date.now(), fromId: 'system', fromName: 'StarClan', scope: 'system', text: 'The next sunrise: tracks at the river. You must find Graystripe.', at: Date.now() });
        setCutscene(null);
      }, 95000));
    }
    return () => { timers.forEach(clearTimeout); };
  }, [cutscene, cat, setCutscene, setHud, pushChat, setChapterIndex, chapterIndex, setQuest]);

  if (!cutscene) return null;

  if (cutscene.kind === 'wasted') {
    return (
      <div className="absolute inset-0 z-50 grid place-items-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <div className="text-center">
          <h1 className="font-display text-7xl tracking-widest" style={{ color: '#c8181c', textShadow: '0 4px 22px rgba(0,0,0,0.85)' }}>WASTED</h1>
          <div className="mt-3 text-bone/85 text-sm uppercase tracking-[0.4em]">your spirit slips toward the silvery wood…</div>
          <button
            onClick={() => setCutscene({ kind: 'starclan-walk', startedAt: Date.now() })}
            className="mt-8 px-5 py-2 rounded-full bg-bone/10 border border-bone/30 text-bone hover:bg-bone/20 text-sm tracking-wide"
          >
            Continue to StarClan
          </button>
        </div>
      </div>
    );
  }

  if (cutscene.kind === 'starclan-walk') {
    // A starry mist with a cat silhouette walking. Pure CSS — a slow
    // panning gradient + a few twinkles.
    const phase = Math.min(1, t / 6);
    return (
      <div className="absolute inset-0 z-50 overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, #1a1f48 0%, #060816 80%)' }}>
        {/* drifting stars */}
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${(i * 37) % 100}%`,
              left: `${((i * 53) % 100 + phase * 60) % 100}%`,
              width: `${(i % 3) + 1}px`,
              height: `${(i % 3) + 1}px`,
              background: '#dde8ff',
              opacity: 0.4 + (i % 5) * 0.1,
            }}
          />
        ))}
        {/* silhouette cat — pure CSS shape, slowly walking left to right */}
        <div className="absolute" style={{
          bottom: '24%',
          left: `${10 + phase * 70}%`,
          transition: 'left 0.4s linear',
          filter: 'drop-shadow(0 0 14px rgba(150,170,255,0.5))',
        }}>
          <svg width="84" height="56" viewBox="0 0 84 56" fill="none">
            <ellipse cx="48" cy="38" rx="22" ry="9" fill="#0e1338"/>
            <ellipse cx="22" cy="34" rx="10" ry="9" fill="#0e1338"/>
            <polygon points="14,28 18,18 24,28" fill="#0e1338"/>
            <polygon points="26,28 30,18 34,28" fill="#0e1338"/>
            <rect x="32" y="44" width="3" height="10" fill="#0e1338"/>
            <rect x="42" y="44" width="3" height="10" fill="#0e1338"/>
            <rect x="56" y="44" width="3" height="10" fill="#0e1338"/>
            <path d="M70 36 Q80 30 82 22" stroke="#0e1338" strokeWidth="2" fill="none"/>
          </svg>
        </div>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="text-bone/85 italic text-lg">Walk softly, warrior. StarClan walks with you.</div>
          </div>
        </div>
      </div>
    );
  }

  if (cutscene.kind === 'kidnap') {
    // A slowly-receding view: a "cage" frame closing over the screen.
    const phase = Math.min(1, t / 5);
    return (
      <div className="absolute inset-0 z-50" style={{ background: '#1d140a' }}>
        {/* sepia photo of the forest */}
        <div className="absolute inset-0 opacity-80" style={{ background: 'radial-gradient(ellipse at center, #5a4028 0%, #1d140a 70%)' }} />
        {/* cage bars closing in */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{
            left: `${10 + i * 13}%`,
            width: '6px',
            background: '#0a0805',
            transform: `translateY(${(1 - phase) * -20}px)`,
            opacity: phase,
            boxShadow: '0 0 8px rgba(0,0,0,0.8)',
          }} />
        ))}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center max-w-md px-6">
            <div className="text-xs uppercase tracking-[0.5em] text-amber-200/70 mb-3">a twoleg shadow…</div>
            <h2 className="font-display text-3xl text-amber-100 mb-2">You are taken in a cage.</h2>
            <p className="italic text-amber-200/85">The forest grows distant. Wheels rumble beneath you.</p>
          </div>
        </div>
      </div>
    );
  }

  if (cutscene.kind === 'firestar-dies') {
    return (
      <div className="absolute inset-0 z-50 grid place-items-center" style={{ background: 'radial-gradient(ellipse at center, #4a1108 0%, #1a0604 80%)' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.6))' }} />
        <div className="relative text-center max-w-xl px-6">
          <div className="text-xs uppercase tracking-[0.5em] text-amber-300/70 mb-3">A flame is extinguished</div>
          <h1 className="font-display text-5xl text-amber-100 mb-4 drop-shadow-lg">Firestar has died.</h1>
          <p className="italic text-amber-100/90 text-base">
            The leader of ThunderClan walks among StarClan now. The forest holds its breath.
          </p>
        </div>
      </div>
    );
  }

  if (cutscene.kind === 'graystripe-flashback') {
    // Find the latest lyric whose 'at' is <= t
    const cur = [...TWO_BIRDS_LYRICS].reverse().find((l) => t >= l.at)?.text ?? '';
    // Scene: a sepia river bank, two cat silhouettes — one carried away by a twoleg shadow.
    const sceneT = Math.min(1, t / 8);
    return (
      <div className="absolute inset-0 z-50 overflow-hidden" style={{ background: '#241a10' }}>
        {/* sepia sunset gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #6a4a28 0%, #3a2418 60%, #1a0e08 100%)' }} />
        {/* river horizon */}
        <div className="absolute inset-x-0" style={{ bottom: '38%', height: '2px', background: '#a0865a', opacity: 0.7 }} />
        <div className="absolute inset-x-0" style={{ bottom: '0%', top: '62%', background: 'linear-gradient(180deg, rgba(120,90,50,0.5), rgba(40,28,16,0.95))' }} />
        {/* small star/spark twinkles */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            top: `${(i * 23) % 50}%`,
            left: `${(i * 41) % 100}%`,
            width: '2px',
            height: '2px',
            background: '#f4d49a',
            opacity: 0.3 + (i % 4) * 0.1,
          }} />
        ))}
        {/* cat silhouette 1 — Graystripe — walking off to the right with twoleg looming */}
        <div className="absolute" style={{
          bottom: '38%',
          left: `${30 + sceneT * 35}%`,
          transition: 'left 0.4s linear',
          opacity: 1 - sceneT * 0.3,
        }}>
          <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
            <ellipse cx="36" cy="30" rx="18" ry="7" fill="#1a0a04"/>
            <ellipse cx="16" cy="26" rx="8" ry="7" fill="#1a0a04"/>
            <polygon points="10,22 14,14 18,22" fill="#1a0a04"/>
            <polygon points="20,22 24,14 28,22" fill="#1a0a04"/>
            <rect x="24" y="34" width="2.5" height="8" fill="#1a0a04"/>
            <rect x="32" y="34" width="2.5" height="8" fill="#1a0a04"/>
            <rect x="44" y="34" width="2.5" height="8" fill="#1a0a04"/>
          </svg>
        </div>
        {/* twoleg shadow — tall ominous silhouette */}
        <div className="absolute" style={{
          bottom: '38%',
          left: `${42 + sceneT * 30}%`,
          transition: 'left 0.4s linear',
        }}>
          <svg width="50" height="120" viewBox="0 0 50 120" fill="none">
            <ellipse cx="25" cy="14" rx="10" ry="11" fill="#0e0604"/>
            <rect x="14" y="22" width="22" height="60" fill="#0e0604"/>
            <rect x="12" y="78" width="10" height="42" fill="#0e0604"/>
            <rect x="28" y="78" width="10" height="42" fill="#0e0604"/>
            {/* arm holding cat */}
            <rect x="36" y="36" width="10" height="34" fill="#0e0604" transform="rotate(20 36 36)"/>
          </svg>
        </div>
        {/* second cat — the player's POV — watching from left */}
        <div className="absolute" style={{ bottom: '38%', left: '8%' }}>
          <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
            <ellipse cx="36" cy="30" rx="18" ry="7" fill="#241208"/>
            <ellipse cx="16" cy="26" rx="8" ry="7" fill="#241208"/>
            <polygon points="10,22 14,14 18,22" fill="#241208"/>
            <polygon points="20,22 24,14 28,22" fill="#241208"/>
          </svg>
        </div>
        {/* lyric card */}
        <div className="absolute inset-x-0 bottom-12 grid place-items-center pointer-events-none">
          <div className="text-center max-w-2xl px-6">
            <div className="text-xs uppercase tracking-[0.5em] text-amber-200/60 mb-2">♪ Two Birds — Regina Spektor</div>
            <p key={cur} className="font-display text-2xl text-amber-100 italic animate-fade-in">{cur || '…'}</p>
          </div>
        </div>
        {/* skip button — quietly off in the corner */}
        <button
          onClick={() => setCutscene(null)}
          className="absolute bottom-3 right-3 text-[11px] text-amber-100/40 hover:text-amber-100/80"
        >
          skip ›
        </button>
      </div>
    );
  }

  return null;
}
