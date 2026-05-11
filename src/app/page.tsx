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
import { BookPanel } from '@/components/BookPanel';
import { TasksPanel } from '@/components/TasksPanel';
import { Tutorial } from '@/components/Tutorial';
import { NpcDialog } from '@/components/NpcDialog';
import { WaypointArrow } from '@/components/WaypointArrow';
import { MapPanel } from '@/components/MapPanel';
import { BattleOverlay } from '@/components/BattleOverlay';
import { SwipeFX } from '@/components/SwipeFX';
import { WarriorsGuide } from '@/components/WarriorsGuide';
import { ActivityBook } from '@/components/ActivityBook';
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
  const [transitioning, setTransitioning] = useState(false);

  // attach colorblind filter to body
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-colorblind', settings.colorblind);
    }
  }, [settings.colorblind]);

  // Hook so chat/move can flow even when HUD/Chat live outside Game
  const mp = useMultiplayer(cat, room, screen === 'game');

  return (
    <main
      className="fixed inset-0 overflow-hidden no-select"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
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
              // Persist the morph but stay on the editor.
              setCat(c);
              patchSave({ cat: c });
            }}
            onPlay={(c) => {
              // Move screen off the editor first so its <Canvas> fully unmounts
              // and iOS Safari can release the WebGL context, THEN mount the
              // game canvas after a short gap. Without this delay the game's
              // Canvas can fail to obtain a GL context on iPad Safari because
              // the previous one is still being torn down.
              setCat(c);
              patchSave({ cat: c });
              setTransitioning(true);
              setScreen('title');
              setTimeout(() => {
                setScreen('game');
                setTransitioning(false);
              }, 800);
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
          <VisionOverlay />
          <GatherOverlay />
          <FishOverlay />
          <DisasterOverlay />
          <PauseOverlay />
          <SleepOverlay />
          <ErrorBoundary label="game" onReset={() => setScreen('title')}>
            {/* WebGLGuard probes for a usable WebGL context BEFORE we mount the
                game Canvas. Without this, iOS Safari occasionally hands three.js
                a null GL context (the editor's Canvas hasn't been fully released
                yet), which then crashes inside WebGLCapabilities with the
                "getShaderPrecisionFormat of null" error. The guard retries a few
                times automatically and falls back to a friendly retry screen. */}
            <WebGLGuard fallbackTitle="The forest is gathering its strength.">
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
            onSwipe={() => dispatchKeyTap('f')}
          />
          {showSettings && (
            <SettingsPanel onClose={() => setShowSettings(false)} onEditCat={() => { setShowSettings(false); setScreen('creator'); }} />
          )}
          {showLeader && (
            <LeaderPanel onClose={() => setShowLeader(false)} onCommand={(k, p) => mp.sendCommand(k, p)} />
          )}
          <BookPanel />
          <TasksPanel />
          <Tutorial />
          <NpcDialog />
          <WaypointArrow />
          <MapPanel />
          <BattleOverlay />
          <SwipeFX />
          <WarriorsGuide />
          <ActivityBook />
        </>
      )}

      {transitioning && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-forest-900 text-bone">
          <div className="text-center font-display text-2xl animate-pulse-soft">
            Slipping into the forest...
          </div>
        </div>
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
  // Lowered threshold so even a small joystick nudge starts walking, and
  // the cat doesn't sit still while the player thinks they're pushing forward.
  const threshold = 0.08;
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

// Renders the cat's vision impairments / night vision boost as DOM overlays
// over the WebGL canvas. Cheaper than a postprocess pass and works on iPad.
function VisionOverlay() {
  const cat = useGameStore((s) => s.cat);
  const room = useGameStore((s) => s.room);
  if (!cat) return null;
  const tod = room?.timeOfDay ?? 0.5;
  const isNight = tod < 0.22 || tod > 0.78;
  const layers: React.ReactNode[] = [];
  if (cat.vision === 'half-blind') {
    // Dim the right half of the view with a soft gradient (the "blind side")
    layers.push(
      <div
        key="halfblind"
        className="absolute inset-0 z-30 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    );
  }
  if (cat.vision === 'blind') {
    // Heavy blur + low contrast — you can still tell shapes apart but only just
    layers.push(
      <div
        key="blind"
        className="absolute inset-0 z-30 pointer-events-none"
        style={{
          backdropFilter: 'blur(6px) brightness(0.85) saturate(0.5)',
          WebkitBackdropFilter: 'blur(6px) brightness(0.85) saturate(0.5)',
          background: 'rgba(180,200,220,0.18)',
        }}
      />
    );
  }
  // Night-vision boost lifts shadows when it's actually night
  if (cat.nightVision && isNight) {
    layers.push(
      <div
        key="nv"
        className="absolute inset-0 z-30 pointer-events-none mix-blend-screen"
        style={{ background: 'rgba(150,200,160,0.18)' }}
      />
    );
  }
  return <>{layers}</>;
}

// Brief cutscene overlay shown while the player searches a clump of leaves
// for herbs. Visually matches the sleep overlay but lighter, with a leaf
// icon and a progress sweep so the player knows something is happening.
function GatherOverlay() {
  const gathering = useGameStore((s) => s.gathering);
  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none transition-opacity duration-300"
      style={{
        opacity: gathering ? 1 : 0,
        background: 'radial-gradient(ellipse at center, rgba(30,40,18,0.55), rgba(0,0,0,0.4))',
      }}
    >
      <div className="h-full grid place-items-center text-bone p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-2 animate-pulse-soft">🌿</div>
          <div className="font-display text-2xl mb-2">Searching the undergrowth…</div>
          <div className="text-sm opacity-80">Sniffing for marigold, juniper, catmint…</div>
          <div className="mt-4 h-1 w-48 mx-auto rounded-full overflow-hidden bg-white/10">
            <div className="h-full bg-forest-300 animate-[gatherbar_2s_linear_forwards]" />
          </div>
        </div>
      </div>
      <style>{`@keyframes gatherbar { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

// Brief cutscene overlay shown while the player is fishing in the river.
function FishOverlay() {
  const fishing = useGameStore((s) => s.fishing);
  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none transition-opacity duration-300"
      style={{
        opacity: fishing ? 1 : 0,
        background: 'radial-gradient(ellipse at center, rgba(20,40,60,0.55), rgba(0,0,0,0.4))',
      }}
    >
      <div className="h-full grid place-items-center text-bone p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-2 animate-pulse-soft">🐟</div>
          <div className="font-display text-2xl mb-2">Watching the water…</div>
          <div className="text-sm opacity-80">Crouch low. Strike fast.</div>
          <div className="mt-4 h-1 w-48 mx-auto rounded-full overflow-hidden bg-white/10">
            <div className="h-full bg-river animate-[fishbar_2.5s_linear_forwards]" />
          </div>
        </div>
      </div>
      <style>{`@keyframes fishbar { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

// Pure-visual vignette overlay. The actual cinematic happens via the
// orbiting CameraRig camera, the cat's `doze` / `sleep` animations, and
// the time-of-day sweep — no text on the player's screen.
// Banner overlay for active disasters. Tints the screen colour by kind
// and floats a warning ribbon at the top.
function DisasterOverlay() {
  const disaster = useGameStore((s) => s.disaster);
  if (!disaster) return null;
  const tint =
    disaster.kind === 'fire'   ? 'rgba(180,70,30,0.18)' :
    disaster.kind === 'flood'  ? 'rgba(60,120,170,0.20)' :
                                 'rgba(120,40,40,0.22)';
  const icon = disaster.kind === 'fire' ? '🔥' : disaster.kind === 'flood' ? '🌊' : '🚛';
  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0" style={{ background: tint, mixBlendMode: 'multiply' }} />
      <div className="absolute left-1/2 -translate-x-1/2 top-12 max-w-[88vw] px-4 py-2 rounded-2xl bg-black/75 border border-thunder/60 text-bone text-sm shadow-2xl flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="font-display">{disaster.message}</span>
      </div>
    </div>
  );
}

function PauseOverlay() {
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  if (!paused) return null;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="text-center text-bone">
        <div className="font-display text-5xl mb-2">PAUSED</div>
        <div className="opacity-80 mb-6 text-sm">Press P or tap below to resume.</div>
        <button onClick={() => setPaused(false)} className="rounded-xl bg-thunder hover:bg-thunder/90 px-6 py-3 font-display text-lg shadow">Resume</button>
      </div>
    </div>
  );
}

function SleepOverlay() {
  const sleeping = useGameStore((s) => s.sleeping);
  const stage = useGameStore((s) => s.sleepStage);
  const dreamLine = useGameStore((s) => s.dreamLine);

  useEffect(() => {
    if (!sleeping) return;
    useGameStore.getState().bumpTask('sleep', 1);
  }, [sleeping]);

  const opacity =
    !sleeping ? 0 :
    stage === 'loaf' ? 0.18 :
    stage === 'curl' ? 0.32 :
    stage === 'waking' ? 0.22 :
    0.42;

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none transition-opacity duration-1000"
      style={{
        opacity,
        background: 'radial-gradient(ellipse at center, rgba(8,12,30,0.6), rgba(0,0,0,0.9))',
      }}
    >
      {/* StarClan dream card — only during the deep stage, only if a dead
          clanmate sent one. The text is intentionally cryptic for warnings,
          glowing for prophecies of greatness. */}
      {sleeping && stage === 'deep' && dreamLine && (
        <div className="h-full grid place-items-center p-6">
          <div className="max-w-md text-center text-bone animate-fade-in" style={{ textShadow: '0 4px 24px rgba(0,0,0,0.85)' }}>
            <div className="text-[10px] uppercase tracking-[0.5em] opacity-70 mb-2">A dream from StarClan</div>
            <p className="italic text-base md:text-lg leading-relaxed">{dreamLine}</p>
          </div>
        </div>
      )}
    </div>
  );
}
