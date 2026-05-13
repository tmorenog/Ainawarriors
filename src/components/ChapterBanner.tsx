'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { chapterAt } from '@/lib/chapters';

// Full-screen card that fades in for ~3.5s every time the chapter
// advances (or showChapterCard() is called). Gives each chapter a
// dramatic "title-card" beat, like the start of a book chapter.
export function ChapterBanner() {
  const idx = useGameStore((s) => s.chapterIndex);
  const at = useGameStore((s) => s.chapterCardAt);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!at) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(t);
  }, [at]);

  if (!visible) {
    // Persistent small chip in the top-right shows the current chapter.
    const chap = chapterAt(idx);
    return (
      <div className="absolute top-3 right-3 text-[11px] px-3 py-1 rounded-full bg-black/45 text-bone border border-white/15 pointer-events-none">
        {chap.title.split(' — ')[0]} <span className="opacity-70">· {chap.title.split(' — ')[1]}</span>
      </div>
    );
  }

  const chap = chapterAt(idx);
  const [num, name] = chap.title.split(' — ');
  return (
    <div className="absolute inset-0 z-40 grid place-items-center pointer-events-none">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" />
      <div className="relative text-center max-w-xl px-6 animate-fade-in">
        <div className="text-xs uppercase tracking-[0.5em] text-bone/70 mb-3">{num}</div>
        <h1 className="font-display text-5xl text-bone drop-shadow-lg mb-4">{name}</h1>
        <p className="italic text-bone/85 text-base">{chap.subtitle}</p>
        <div className="mt-6 inline-block px-4 py-1 rounded-full border border-bone/40 text-xs text-bone/85">
          Quest · {chap.quest}
        </div>
      </div>
    </div>
  );
}
