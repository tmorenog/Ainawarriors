'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { loadSave, patchSave } from '@/lib/persist';

interface Props {
  onStart: (room: string) => void;
}

export function TitleScreen({ onStart }: Props) {
  const [room, setRoom] = useState('public-thunderpath');
  const [hasSave, setHasSave] = useState(false);
  const setCat = useGameStore((s) => s.setCat);
  const setSettings = useGameStore((s) => s.setSettings);
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    const save = loadSave();
    setSettings(save.settings);
    if (save.cat) {
      setCat(save.cat);
      setHasSave(true);
    }
  }, [setCat, setSettings]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest-900 via-forest-700 to-forest-900" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(255,200,140,0.18), transparent 60%), radial-gradient(circle at 80% 70%, rgba(170,200,255,0.15), transparent 60%)',
      }} />
      <div className="absolute inset-0 opacity-25 mix-blend-screen pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 7px)' }} />

      <div className="relative z-10 h-full grid place-items-center px-4">
        <div className="w-full max-w-xl text-center text-bone animate-fade-in">
          <div className="text-xs tracking-[0.6em] uppercase opacity-80 mb-3">Warriors</div>
          <h1 className="font-display text-5xl md:text-7xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
            of the Clans
          </h1>
          <p className="mt-3 italic opacity-80 max-w-lg mx-auto">
            “Beyond the bramble walls, every paw-print tells a story. Choose your clan, find your name, and run with us.”
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <label className="text-sm text-left opacity-80">Server / Room</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="bg-black/40 border border-bone/30 rounded px-3 py-2 text-bone"
              placeholder="public-thunderpath"
            />

            <button
              className="mt-2 rounded-xl bg-thunder hover:bg-thunder/90 transition px-6 py-3 font-display text-xl shadow-lg"
              onClick={() => {
                if (hasSave) {
                  patchSave({ lastClan: useGameStore.getState().cat?.clan ?? null });
                  onStart(room);
                  setScreen('game');
                } else {
                  setScreen('creator');
                }
              }}
            >
              {hasSave ? 'Return to the Forest' : 'Create your Warrior'}
            </button>

            <button
              className="rounded-xl border border-bone/30 hover:bg-white/5 transition px-6 py-2"
              onClick={() => setScreen('creator')}
            >
              {hasSave ? 'Edit Cat' : 'New Cat (Guest)'}
            </button>

            <p className="text-xs opacity-60 mt-4">
              Guest play saves locally. Set <code>NEXT_PUBLIC_SOCKET_URL</code> to enable live multiplayer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
