'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { TitleScreen } from '@/components/TitleScreen';
import { CharacterCreator } from '@/components/CharacterCreator';
import { Chat } from '@/components/Chat';
import { HUD } from '@/components/HUD';
import { SettingsPanel } from '@/components/Settings';
import { LeaderPanel } from '@/components/LeaderPanel';
import { MobileControls } from '@/components/MobileControls';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebGLGuard } from '@/components/WebGLGuard';
import { useGameStore } from '@/game/useGameStore';
import { useMultiplayer } from '@/game/useMultiplayer';
import { patchSave, loadSave } from '@/lib/persist';

const Game = dynamic(() => import('@/game/Game').then((m) => m.Game), { ssr: false });

export default function Page() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const cat = useGameStore((s) => s.cat);
  const setCat = useGameStore((s) => s.setCat);
  const settings = useGameStore((s) => s.settings);
  const [room, setRoom] = useState('public-thunderpath');
  const [showSettings, setShowSettings] = useState(false);
  const [showLeader, setShowLeader] = useState(false);

  // attach colorblind filter to body
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-colorblind', settings.colorblind);
    }
  }, [settings.colorblind]);

  // Hook so chat/move can flow even when HUD/Chat live outside Game
  const mp = useMultiplayer(cat, room, screen === 'game');

  return (
    <main className="relative w-screen h-screen overflow-hidden no-select">
      {screen === 'title' && (
        <TitleScreen onStart={(r) => { setRoom(r); setScreen('game'); }} />
      )}

      {screen === 'creator' && (
        <ErrorBoundary
          label="creator"
          onReset={() => {
            try { localStorage.removeItem('wotc_save_v1'); } catch {}
            setCat(null);
          }}
        >
          <CharacterCreator
            onSave={(c) => {
              setCat(c);
              patchSave({ cat: c });
              setScreen('game');
            }}
            onCancel={() => {
              const has = !!loadSave().cat;
              setScreen(has ? 'game' : 'title');
            }}
          />
        </ErrorBoundary>
      )}

      {screen === 'game' && cat && (
        <>
          <ErrorBoundary label="game" onReset={() => setScreen('title')}>
            <WebGLGuard>
              <Game room={room} net={{ sendMove: mp.sendMove, sendCatch: mp.sendCatch }} />
            </WebGLGuard>
          </ErrorBoundary>
          <HUD onOpenSettings={() => setShowSettings(true)} onOpenLeader={() => setShowLeader(true)} />
          <Chat
            onSend={(text, scope) => mp.sendChat(text, scope)}
            onEmote={(e) => mp.sendEmote(e)}
          />
          <MobileControls
            onMove={(x, y) => dispatchMove(x, y)}
            onLook={(dx, dy) => dispatchLook(dx, dy)}
            onSprint={(d) => dispatchKey('Shift', d)}
            onCrouch={() => dispatchKeyTap('c')}
            onPounce={() => dispatchKeyTap('q')}
            onJump={() => dispatchKeyTap(' ')}
          />
          {showSettings && (
            <SettingsPanel onClose={() => setShowSettings(false)} onEditCat={() => { setShowSettings(false); setScreen('creator'); }} />
          )}
          {showLeader && (
            <LeaderPanel onClose={() => setShowLeader(false)} onCommand={(k, p) => mp.sendCommand(k, p)} />
          )}
        </>
      )}
    </main>
  );
}

// Synthesize keyboard events so MobileControls reuse the keyboard pipeline
function dispatchKey(key: string, down: boolean) {
  if (typeof window === 'undefined') return;
  const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { key });
  window.dispatchEvent(e);
}
function dispatchKeyTap(key: string) {
  dispatchKey(key, true);
  setTimeout(() => dispatchKey(key, false), 100);
}
function dispatchMove(x: number, y: number) {
  if (typeof window === 'undefined') return;
  // forward = y, strafe = x  -> simulate WASD pulses through controls layer
  // We simulate by pressing the appropriate keys based on the dominant axis.
  const threshold = 0.2;
  setHeld('w', y > threshold);
  setHeld('s', y < -threshold);
  setHeld('d', x > threshold);
  setHeld('a', x < -threshold);
}
const _held: Record<string, boolean> = {};
function setHeld(key: string, down: boolean) {
  if (_held[key] === down) return;
  _held[key] = down;
  dispatchKey(key, down);
}
function dispatchLook(dx: number, dy: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wotc-look', { detail: { dx, dy } }));
}
