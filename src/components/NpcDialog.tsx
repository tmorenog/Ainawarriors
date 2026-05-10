'use client';

import { useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { NPCS, type NpcId } from '@/lib/npcs';

// Lightweight keyword-driven reply for the free-text input. We don't have
// a real LLM in here — pick the first phrase that matches the player's
// words, otherwise fall back to a per-NPC neutral answer.
function npcReply(id: NpcId, text: string): string {
  const t = text.toLowerCase();
  const greetings = ['hi', 'hello', 'hey', 'greet', 'mew'];
  const farewells = ['bye', 'goodbye', 'farewell', 'leave'];
  const battle = ['battle', 'fight', 'war', 'kill', 'claws'];
  const food = ['hungry', 'food', 'prey', 'eat', 'mouse', 'fish', 'rabbit'];
  const starclan = ['starclan', 'stars', 'dream', 'spirit', 'omen'];
  const moon = ['gathering', 'moon', 'fourtrees'];
  const friend = ['friend', 'love', 'mate'];
  const help = ['help', 'lost', 'where', 'how'];

  const has = (list: string[]) => list.some((k) => t.includes(k));

  // Per-NPC voice tweaks
  const voices: Record<NpcId, Record<string, string>> = {
    firestar: {
      greet: 'Welcome to ThunderClan, young one. Walk softly.',
      bye: 'StarClan light your path.',
      battle: 'A warrior fights only when there is no other way. Train your claws — but keep your heart calm.',
      food: 'The fresh-kill pile is in the centre of camp. Bring something for the elders before you eat.',
      starclan: 'StarClan watches every paw-print. Listen, and they will speak.',
      moon: 'At the full moon every clan walks in peace at Fourtrees. Bring no claws.',
      friend: 'Loyalty is the warrior code\'s heart. Choose your friends carefully.',
      help: 'Ask Spottedleaf for herbs, the warriors for a patrol, and your own paws for the rest.',
      _: 'A clan is only as strong as its quietest cat.',
    },
    tigerstar: {
      greet: 'You waste my time, kit.',
      bye: 'Run, then. Run.',
      battle: 'Then come at me. I am not afraid of ThunderClan.',
      food: 'Eat from your own pile. ShadowClan does not feed strays.',
      starclan: 'StarClan is for cats too weak to take what they want.',
      moon: 'A truce of cowards. I will be there — for now.',
      friend: 'Friendship is a leash. I wear no leash.',
      help: 'No.',
      _: 'You are still here. Why?',
    },
    blackstar: {
      greet: 'Greetings. ShadowClan honours the truce.',
      bye: 'Walk safe, ThunderClan.',
      battle: 'My warriors are ready. Hopefully we will not need them.',
      food: 'There is good prey in the pine forest. We share, sometimes.',
      starclan: 'StarClan kept us through the worst. I will not forget.',
      moon: 'I will speak for ShadowClan at the moon. We have a new beginning.',
      friend: 'A leader has many warriors and few friends.',
      help: 'Ask honestly and ShadowClan answers honestly.',
      _: 'Speak plainly. I have a clan to feed.',
    },
    leopardstar: {
      greet: 'RiverClan greets you, traveller.',
      bye: 'May the river guide your paws.',
      battle: 'We fight only at the water\'s edge — and we win there.',
      food: 'The river is full this season. Try fish if you have not.',
      starclan: 'The river mirrors the sky. We see StarClan in it nightly.',
      moon: 'I will be at Fourtrees, as is the custom.',
      friend: 'My warriors are my kin.',
      help: 'Ask any RiverClan cat for directions to the bank.',
      _: 'You may stay a moment, but our reeds are not your reeds.',
    },
    tallstar: {
      greet: 'The wind brought you.',
      bye: 'Run swift on your way home.',
      battle: 'WindClan does not start fights — but we finish them.',
      food: 'Rabbits run thick on the moor. If you can catch one.',
      starclan: 'I have walked with StarClan in my dreams. They walk with us all.',
      moon: 'At the full moon I speak for the moor.',
      friend: 'My deputy is my closest friend. That is enough.',
      help: 'Stay clear of the gorse traps — and the Twoleg fences.',
      _: 'Be brief, traveller. The wind is calling.',
    },
  };
  const v = voices[id];
  if (has(greetings)) return v.greet;
  if (has(farewells)) return v.bye;
  if (has(battle)) return v.battle;
  if (has(food)) return v.food;
  if (has(starclan)) return v.starclan;
  if (has(moon)) return v.moon;
  if (has(friend)) return v.friend;
  if (has(help)) return v.help;
  return v._;
}

// Modal dialog shown when the player taps "Talk to <name>" above an NPC.
export function NpcDialog() {
  const id = useGameStore((s) => s.npcDialogId) as NpcId | null;
  const setId = useGameStore((s) => s.setNpcDialogId);
  const mission = useGameStore((s) => s.mission);
  const setMission = useGameStore((s) => s.setMission);
  const setBattleActive = useGameStore((s) => s.setBattleActive);
  const setTigerstarHp = useGameStore((s) => s.setTigerstarHp);
  const tigerstarHp = useGameStore((s) => s.tigerstarHp);
  const pushChat = useGameStore((s) => s.pushChat);
  const [input, setInput] = useState('');
  const [reply, setReply] = useState<string | null>(null);

  if (!id) return null;
  useGameStore.getState().bumpTask('meet-leader-n', 1);
  const npc = NPCS[id];

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

  const close = () => { setId(null); setInput(''); setReply(null); };

  const submitFreeText = () => {
    const text = input.trim();
    if (!text) return;
    const r = npcReply(id, text);
    setReply(r);
    pushChat({ id: 'me' + Date.now(), fromId: 'self', fromName: 'You', scope: 'nearby', text, at: Date.now() });
    pushChat({ id: 'npc' + Date.now(), fromId: 'npc:' + id, fromName: npc.cat.name, scope: 'nearby', text: r, at: Date.now() });
    setInput('');
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-auto p-6">
      <div className="w-full max-w-md rounded-2xl bg-forest-900 border border-thunder/40 shadow-2xl text-bone p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-2xl">{npc.cat.name}</div>
          <div className="text-[10px] uppercase tracking-[0.4em] opacity-60">{npc.cat.role}</div>
        </div>
        <p className="text-sm leading-relaxed mb-3 italic opacity-90">{reply ?? greeting}</p>

        {/* Free-text input — say anything to the leader */}
        <div className="flex gap-1 mb-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitFreeText(); }}
            placeholder={`Say something to ${npc.cat.name}…`}
            maxLength={160}
            className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm"
          />
          <button onClick={submitFreeText} className="rounded bg-thunder hover:bg-thunder/90 px-2 py-1.5 text-xs">Mew</button>
        </div>

        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                if (opt.result === 'goodbye') { close(); return; }
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
