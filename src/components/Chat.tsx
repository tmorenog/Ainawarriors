'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/game/useGameStore';
import { filterChat } from '@/lib/chatFilter';

interface Props {
  onSend: (text: string, scope: 'nearby' | 'clan') => void;
  onEmote: (e: string) => void;
}

const EMOTES = ['purr','hiss','mew','groom','tail-flick','ear-twitch','headbutt','pounce'];

export function Chat({ onSend, onEmote }: Props) {
  const chat = useGameStore((s) => s.chat);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const friends = useGameStore((s) => s.friends);
  const toggleFriend = useGameStore((s) => s.toggleFriend);
  const selfId = useGameStore((s) => s.selfId);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'nearby' | 'clan'>('nearby');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    // Emote shortcuts — typing one of these on its own (or with a leading slash)
    // fires the matching emote instead of a chat message.
    const lower = trimmed.toLowerCase().replace(/^\/+/, '');
    const emoteMap: Record<string, string> = {
      'purr': 'purr',
      'hiss': 'hiss',
      'meow': 'mew',
      'mew': 'mew',
      'ear flick': 'ear-twitch',
      'ear-flick': 'ear-twitch',
      'earflick': 'ear-twitch',
      'tail flick': 'tail-flick',
      'tail-flick': 'tail-flick',
      'tailflick': 'tail-flick',
      'groom': 'groom',
      'pounce': 'pounce',
      'headbutt': 'headbutt',
    };
    if (emoteMap[lower]) {
      onEmote(emoteMap[lower]);
      setText('');
      return;
    }

    const f = filterChat(trimmed);
    onSend(f.clean, scope);
    setText('');
  };

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(96vw,540px)] z-30 pointer-events-auto md:bottom-3">
      {open ? (
        <div className="rounded-2xl bg-black/55 backdrop-blur border border-white/10 text-bone overflow-hidden">
          <div className="max-h-44 overflow-y-auto px-3 py-2 text-xs space-y-0.5">
            {chat.length === 0 && <div className="opacity-50 italic">The forest is quiet... say hello.</div>}
            {chat.map((m) => (
              <div key={m.id} className="leading-tight">
                <span className={`opacity-60 mr-1 ${m.scope === 'system' ? 'text-bone' : m.scope === 'clan' ? 'text-thunder' : 'text-bone'}`}>
                  [{m.scope}]
                </span>
                {m.scope !== 'system' && (
                  <span className={`font-semibold mr-1 ${m.fromId === selfId ? 'text-wind' : ''}`}>
                    {m.fromName}:
                  </span>
                )}
                <span className={muted.has(m.fromId) ? 'opacity-40' : ''}>{m.text}</span>
                {m.scope !== 'system' && m.fromId !== selfId && (
                  <span className="ml-2 text-[10px] opacity-60">
                    <button className="underline mr-2" onClick={() => toggleFriend(m.fromId)}>{friends.has(m.fromId) ? 'unfriend' : 'friend'}</button>
                    <button className="underline mr-2" onClick={() => toggleMute(m.fromId)}>{muted.has(m.fromId) ? 'unmute' : 'mute'}</button>
                    <button className="underline" onClick={() => report(m.fromId, m.fromName)}>report</button>
                  </span>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form onSubmit={submit} className="flex items-center gap-1.5 p-2 border-t border-white/10">
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="bg-black/40 text-xs rounded px-2 py-1.5">
              <option value="nearby">Nearby</option>
              <option value="clan">Clan</option>
            </select>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Speak..."
              maxLength={200}
              className="flex-1 bg-black/40 rounded px-2 py-1.5 text-sm border border-white/10"
            />
            <button type="submit" className="bg-thunder rounded px-2.5 py-1.5 text-sm">Mew</button>
          </form>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {EMOTES.map((e) => (
              <button key={e} onClick={() => onEmote(e)} className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10">*{e}*</button>
            ))}
            <button onClick={() => setOpen(false)} className="ml-auto text-[10px] opacity-60 hover:opacity-100">hide</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="rounded-full bg-black/55 px-3 py-1 text-xs text-bone">show chat</button>
      )}
    </div>
  );
}

function report(id: string, name: string) {
  // store local report — could send to server
  try {
    const key = 'wotc_reports';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push({ id, name, at: Date.now() });
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
  alert(`${name} reported. Moderation will review.`);
}
