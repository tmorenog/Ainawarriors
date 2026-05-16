'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { CHAPTERS } from '@/lib/chapters';
import { CLANS } from '@/lib/clans';

// Watches store state and global helpers and advances the chapter index
// when the right thing happens. Also fires the scripted "Firestar dies →
// Graystripe flashback" beat a couple of chapters after the Tigerstar
// fight is won.
export function ChapterTriggers() {
  const cat = useGameStore((s) => s.cat);
  const mission = useGameStore((s) => s.mission);
  const chapterIndex = useGameStore((s) => s.chapterIndex);
  const setChapterIndex = useGameStore((s) => s.setChapterIndex);
  const setQuest = useGameStore((s) => s.setQuest);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const setCutscene = useGameStore((s) => s.setCutscene);
  const cutscene = useGameStore((s) => s.cutscene);
  const firestarDeadAt = useGameStore((s) => s.firestarDeadAt);
  const setFirestarDeadAt = useGameStore((s) => s.setFirestarDeadAt);
  const pushChat = useGameStore((s) => s.pushChat);
  const huntCount = useRef(0);

  // Expose a generic trigger hook that other modules (Game.tsx,
  // PreyMesh, etc) can poke without importing the store.
  useEffect(() => {
    (window as any).__WOTC_TRIGGER__ = (key: string) => {
      const s = useGameStore.getState();
      const cur = s.chapterIndex;
      const expected = CHAPTERS[cur]?.completeOn;
      if (expected !== key) return;
      // Advance one chapter and update the visible quest line.
      const next = Math.min(CHAPTERS.length - 1, cur + 1);
      s.setChapterIndex(next);
      s.setQuest(CHAPTERS[next].quest);
      s.pushChat({
        id: 'sys' + Date.now(),
        fromId: 'system',
        fromName: 'StarClan',
        scope: 'system',
        text: `${CHAPTERS[next].title} — ${CHAPTERS[next].subtitle}`,
        at: Date.now(),
      });
    };
    return () => { try { delete (window as any).__WOTC_TRIGGER__; } catch {} };
  }, []);

  // Auto-trigger 1: visiting your own camp clears chapter 1.
  useEffect(() => {
    if (chapterIndex !== 0) return;
    if (!cat) return;
    const me = players[selfId];
    if (!me) return;
    const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
    const dx = me.pos[0] - cx, dz = me.pos[2] - cz;
    if (dx * dx + dz * dz < 18 * 18) {
      (window as any).__WOTC_TRIGGER__?.('visit-own-camp');
    }
  }, [players, selfId, cat, chapterIndex]);

  // Auto-trigger 2: when mission hits 'won' and we're in chapter 3,
  // advance and start the Firestar-dies countdown.
  useEffect(() => {
    if (mission !== 'won') return;
    if (chapterIndex === 2) {
      (window as any).__WOTC_TRIGGER__?.('defeat-tigerstar');
    }
  }, [mission, chapterIndex]);

  // Scripted beat — Firestar's "StarClan dream" cutscene fires the
  // moment the player enters chapter 5 ("A Dangerous Path"). It then
  // rolls into the Graystripe flashback. We no longer require
  // mission='won' (the user can reach chapter 5 from a number of
  // paths and the dream should always play when the chapter starts).
  useEffect(() => {
    if (firestarDeadAt) return;
    if (chapterIndex < 4) return; // chapter 5 = zero-based index 4
    if (cutscene) return;
    // Small 3s breathing pause so the chapter-card animation finishes
    // before the cutscene takes over the screen.
    const t = setTimeout(() => {
      const s = useGameStore.getState();
      if (s.cutscene) return;
      setFirestarDeadAt(Date.now());
      setCutscene({ kind: 'firestar-dies', startedAt: Date.now() });
    }, 3_000);
    return () => clearTimeout(t);
  }, [chapterIndex, cutscene, firestarDeadAt, setCutscene, setFirestarDeadAt]);

  // Hunt counter — bump on every prey caught (StarClan system message
  // matches the pattern "You caught a …"). Three catches advances ch2.
  const chatLen = useGameStore((s) => s.chat.length);
  useEffect(() => {
    const s = useGameStore.getState();
    const last = s.chat[s.chat.length - 1];
    if (!last) return;
    if (last.fromName === 'StarClan' && /You caught a /.test(last.text)) {
      huntCount.current += 1;
      if (huntCount.current >= 3) {
        huntCount.current = 0;
        (window as any).__WOTC_TRIGGER__?.('hunt-three');
      }
    }
  }, [chatLen]);

  // Kick off chapter 1 the first time the player loads into the game.
  useEffect(() => {
    if (!cat) return;
    if (chapterIndex !== 0) return;
    setQuest(CHAPTERS[0].quest);
  }, [cat]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Chapters 8-80 advance on a slow 3-minute ticker so the campaign
  // keeps moving even when the player is just exploring. The hand-
  // scripted chapters above (1-7) ignore this trigger; only chapters
  // whose `completeOn` is 'tick-3min' react.
  useEffect(() => {
    const id = setInterval(() => {
      (window as any).__WOTC_TRIGGER__?.('tick-3min');
    }, 180_000);
    return () => clearInterval(id);
  }, []);

  // After the Graystripe flashback ends, returning home (visiting your
  // own camp) wraps up chapter 6 → 7.
  useEffect(() => {
    if (chapterIndex !== 5) return;
    if (!cat) return;
    const me = players[selfId];
    if (!me) return;
    const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
    const dx = me.pos[0] - cx, dz = me.pos[2] - cz;
    if (dx * dx + dz * dz < 18 * 18) {
      (window as any).__WOTC_TRIGGER__?.('find-graystripe');
    }
  }, [players, selfId, cat, chapterIndex]);

  // After find-graystripe runs (chapter 6), visiting camp once more wraps the campaign.
  useEffect(() => {
    if (chapterIndex !== 6) return;
    if (!cat) return;
    const me = players[selfId];
    if (!me) return;
    const [cx, , cz] = CLANS[cat.clan].campCenter as [number, number, number];
    const dx = me.pos[0] - cx, dz = me.pos[2] - cz;
    if (dx * dx + dz * dz < 18 * 18) {
      const t = setTimeout(() => (window as any).__WOTC_TRIGGER__?.('return-home'), 4000);
      return () => clearTimeout(t);
    }
  }, [players, selfId, cat, chapterIndex]);

  return null;
}
