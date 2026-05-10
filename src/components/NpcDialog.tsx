'use client';

import { useGameStore } from '@/game/useGameStore';
import { NPCS, type NpcId } from '@/lib/npcs';

// Modal dialog shown when the player taps "Talk to <name>" above an NPC.
// Lets the player accept Firestar's mission or pick a fight with Tigerstar.
// Visually a centered card with the NPC's greeting and 1–2 reply buttons.
export function NpcDialog() {
  const id = useGameStore((s) => s.npcDialogId) as NpcId | null;
  const setId = useGameStore((s) => s.setNpcDialogId);
  const mission = useGameStore((s) => s.mission);
  const setMission = useGameStore((s) => s.setMission);
  const setBattleActive = useGameStore((s) => s.setBattleActive);
  const setTigerstarHp = useGameStore((s) => s.setTigerstarHp);
  const tigerstarHp = useGameStore((s) => s.tigerstarHp);
  const pushChat = useGameStore((s) => s.pushChat);

  if (!id) return null;
  // Greeting any leader counts toward the "meet 3 leaders" task. We bump
  // here on every open — the predicate would need a Set per task to dedupe
  // so we just live with the optimistic count for now.
  useGameStore.getState().bumpTask('meet-leader-n', 1);
  const npc = NPCS[id];

  // Adjust greeting based on mission state so it doesn't sound stuck.
  let greeting = npc.greeting;
  if (id === 'firestar' && mission === 'accepted') {
    greeting = 'You have my trust. Find Tigerstar in ShadowClan camp and end this — for all the clans.';
  }
  if (id === 'firestar' && mission === 'won') {
    greeting = 'You did it, brave one. Tigerstar walks the Dark Forest now. The clans owe you their lives.';
  }
  if (id === 'tigerstar' && mission === 'won') {
    greeting = '… (Tigerstar lies still. His amber eyes are empty.)';
  }
  if (id === 'tigerstar' && tigerstarHp < 100 && tigerstarHp > 0) {
    greeting = 'You\'ve drawn blood, kit. But I have nine lives — you have one. Strike again if you dare.';
  }

  // Compose options dynamically — once the mission is accepted Firestar
  // doesn't need to ask again, and after victory Tigerstar shouldn't fight.
  const options = (() => {
    if (id === 'firestar') {
      if (mission === 'won') return [{ label: 'StarClan smile on you, Firestar.', result: 'goodbye' as const }];
      if (mission === 'accepted') return [{ label: 'I will return when it is done.', result: 'goodbye' as const }];
      return npc.options;
    }
    if (id === 'tigerstar') {
      if (mission === 'won') return [{ label: 'Walk well in the Dark Forest.', result: 'goodbye' as const }];
      return npc.options;
    }
    return npc.options;
  })();

  const close = () => setId(null);

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-auto p-6">
      <div className="w-full max-w-md rounded-2xl bg-forest-900 border border-thunder/40 shadow-2xl text-bone p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-2xl">{npc.cat.name}</div>
          <div className="text-[10px] uppercase tracking-[0.4em] opacity-60">{npc.cat.role}</div>
        </div>
        <p className="text-sm leading-relaxed mb-4 italic opacity-90">{greeting}</p>
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                if (opt.result === 'goodbye') {
                  close();
                  return;
                }
                if (opt.result === 'accept-battle') {
                  setMission('accepted');
                  useGameStore.getState().bumpTask('accept-mission', 1);
                  pushChat({
                    id: 'sys' + Date.now(),
                    fromId: 'system',
                    fromName: 'Firestar',
                    scope: 'system',
                    text: 'Find Tigerstar in ShadowClan camp and finish him.',
                    at: Date.now(),
                  });
                  close();
                  return;
                }
                if (opt.result === 'engage') {
                  setMission('accepted');
                  useGameStore.getState().bumpTask('accept-mission', 1);
                  setTigerstarHp(100);
                  setBattleActive(true);
                  // Run the cinematic intro before letting the player swing.
                  // The fight banner is up for 2s; the rest of the time the
                  // player has full control via Q (pounce) and F (swipe).
                  const s = useGameStore.getState();
                  s.setBattlePhase('intro');
                  setTimeout(() => useGameStore.getState().setBattlePhase('fighting'), 2000);
                  pushChat({
                    id: 'sys' + Date.now(),
                    fromId: 'system',
                    fromName: 'Tigerstar',
                    scope: 'system',
                    text: 'Tigerstar lunges! Pounce (Q) for a heavy strike or swipe (F) for a fast claw — but watch your own hide.',
                    at: Date.now(),
                  });
                  close();
                  return;
                }
              }}
              className="w-full text-left rounded-lg bg-thunder/20 hover:bg-thunder/40 border border-thunder/40 px-3 py-2 text-sm"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-3 text-right">
          <button onClick={close} className="text-[11px] opacity-60 hover:opacity-100 underline">close</button>
        </div>
      </div>
    </div>
  );
}
