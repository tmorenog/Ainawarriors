'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { BOOK_CHAPTERS } from '@/lib/book';
import { CLANS } from '@/lib/clans';
import { getAudioEngine } from '@/game/audio';

export function BookPanel() {
  const bookMode = useGameStore((s) => s.bookMode);
  const setBookMode = useGameStore((s) => s.setBookMode);
  const chapterIndex = useGameStore((s) => s.chapterIndex);
  const setChapterIndex = useGameStore((s) => s.setChapterIndex);
  const chapterProgress = useGameStore((s) => s.chapterProgress);
  const bumpChapterProgress = useGameStore((s) => s.bumpChapterProgress);
  const setQuest = useGameStore((s) => s.setQuest);
  const carrying = useGameStore((s) => s.carrying);
  const herbInventory = useGameStore((s) => s.herbInventory);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const setSleeping = useGameStore((s) => s.setSleeping);
  const sleeping = useGameStore((s) => s.sleeping);
  const pushChat = useGameStore((s) => s.pushChat);

  const [open, setOpen] = useState(false);

  // When the player toggles Book Mode on, snap the quest tracker to the
  // current chapter so they can see what to do next.
  useEffect(() => {
    if (!bookMode) return;
    const ch = BOOK_CHAPTERS[chapterIndex];
    if (!ch) return;
    setQuest(`${ch.title} — ${describeObjective(ch.objective.kind, ch.objective.target, ch.objective.count, chapterProgress)}`);
  }, [bookMode, chapterIndex, chapterProgress, setQuest]);

  // Auto-progress detection — runs while Book Mode is on.
  useEffect(() => {
    if (!bookMode) return;
    const ch = BOOK_CHAPTERS[chapterIndex];
    if (!ch) return;
    const id = setInterval(() => {
      const me = players[selfId];
      const obj = ch.objective;
      switch (obj.kind) {
        case 'visit-clan': {
          if (!me) return;
          const clan = CLANS[(obj.target ?? 'ThunderClan') as keyof typeof CLANS];
          if (!clan) return;
          const dx = me.pos[0] - clan.campCenter[0];
          const dz = me.pos[2] - clan.campCenter[2];
          if (dx * dx + dz * dz < 25 * 25) {
            advance();
          }
          break;
        }
        case 'gather-herbs': {
          const total = Object.values(herbInventory).reduce((a, b) => a + b, 0);
          if (total >= (obj.count ?? 1)) advance();
          break;
        }
        case 'sleep': {
          if (sleeping) advance();
          break;
        }
        default:
          break;
      }
    }, 700);
    return () => clearInterval(id);
  }, [bookMode, chapterIndex, players, selfId, herbInventory, sleeping]);

  // Catching a piece of prey is reflected in `carrying`. We also expose
  // bumpChapterProgress so HUD/Game can call it directly when needed.
  useEffect(() => {
    if (!bookMode) return;
    const ch = BOOK_CHAPTERS[chapterIndex];
    if (!ch) return;
    if (!carrying) return;
    if (ch.objective.kind === 'catch-any') advance();
    if (ch.objective.kind === 'catch-kind' && ch.objective.target === carrying) advance();
  }, [bookMode, carrying, chapterIndex]);

  const advance = () => {
    const ch = BOOK_CHAPTERS[chapterIndex];
    if (!ch) return;
    pushChat({
      id: 'sys' + Date.now(),
      fromId: 'system',
      fromName: 'StarClan',
      scope: 'system',
      text: `Chapter complete: ${ch.title}`,
      at: Date.now(),
    });
    if (chapterIndex + 1 < BOOK_CHAPTERS.length) {
      setChapterIndex(chapterIndex + 1);
    } else {
      setQuest('You have walked the path of the warriors. Run free.');
    }
  };

  if (!bookMode) {
    return (
      <button
        onClick={() => setBookMode(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-l-xl bg-black/55 hover:bg-black/70 backdrop-blur px-3 py-2 text-xs text-bone shadow pointer-events-auto"
        title="Book Mode — read and play through the story"
      >
        📖 Book Mode
      </button>
    );
  }

  const ch = BOOK_CHAPTERS[chapterIndex];

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-l-xl bg-thunder/90 hover:bg-thunder px-3 py-2 text-xs text-bone shadow pointer-events-auto"
      >
        {open ? '×' : '📖'}
      </button>
      {open && ch && (
        <div className="absolute right-3 top-[55%] -translate-y-1/2 w-[300px] max-w-[90vw] bg-black/75 backdrop-blur rounded-xl p-4 text-bone text-sm shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-base">{ch.title}</div>
            <div className="text-[10px] opacity-60">{chapterIndex + 1}/{BOOK_CHAPTERS.length}</div>
          </div>
          <p className="leading-snug opacity-90">{ch.text}</p>
          <div className="mt-3 text-[11px] opacity-80">
            <span className="opacity-60">Objective:</span>{' '}
            {describeObjective(ch.objective.kind, ch.objective.target, ch.objective.count, chapterProgress)}
          </div>
          <div className="mt-3 flex gap-2">
            {ch.objective.kind === 'free' && (
              <button
                className="rounded-lg bg-thunder px-3 py-1.5 text-xs"
                onClick={advance}
              >
                Continue
              </button>
            )}
            {ch.objective.kind === 'sleep' && (
              <button
                className="rounded-lg bg-river px-3 py-1.5 text-xs"
                onClick={() => triggerSleep(setSleeping)}
              >
                Curl up and sleep
              </button>
            )}
            <button
              className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs"
              onClick={() => setBookMode(false)}
            >
              Exit Book Mode
            </button>
          </div>
          <div className="mt-3">
            <button
              className="text-[10px] opacity-60 hover:opacity-100 underline"
              onClick={() => { if (chapterIndex > 0) setChapterIndex(chapterIndex - 1); }}
            >
              ‹ previous chapter
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function triggerSleep(setSleeping: (v: boolean) => void) {
  try { getAudioEngine().setMode('sleep'); } catch {}
  setSleeping(true);
  setTimeout(() => {
    setSleeping(false);
  }, 5000);
}

function describeObjective(kind: string, target: string | undefined, count: number | undefined, progress: number) {
  switch (kind) {
    case 'visit-clan':
      return `Travel to the ${target} camp`;
    case 'catch-any':
      return 'Catch your first piece of prey';
    case 'catch-kind':
      return `Catch a ${target} for the fresh-kill pile`;
    case 'gather-herbs':
      return `Gather ${count ?? 1} herbs (${progress}/${count ?? 1})`;
    case 'sleep':
      return 'Curl up and sleep';
    default:
      return 'Continue when ready';
  }
}
