'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useGameStore } from './useGameStore';
import type { CatAppearance, ChatMessage, PlayerState } from './types';

export interface MultiplayerHandle {
  socket: Socket | null;
  sendMove: (pos: [number, number, number], rot: number, anim: string) => void;
  sendChat: (text: string, scope: 'nearby' | 'clan') => void;
  sendEmote: (emote: string) => void;
  sendCommand: (kind: string, payload?: any) => void;
  sendCatch: (preyId: string, kind: string) => void;
}

const SOCKET_URL = (typeof window !== 'undefined'
  ? (window as any).__WOTC_SOCKET_URL__
  : null) || process.env.NEXT_PUBLIC_SOCKET_URL || '';

// Module-level singleton so multiple components in the tree share one socket.
let _socket: Socket | null = null;
let _refs = 0;

// ---------------------------------------------------------------------------
// BroadcastChannel-based multiplayer fallback.
// When no Socket.io URL is configured we still want the game to be
// "automatically multiplayer" — any other browser tab/window the player has
// open joins the same forest and sees each other walk around. This works
// across tabs on the same browser; for cross-device multiplayer the user can
// still set NEXT_PUBLIC_SOCKET_URL.
// ---------------------------------------------------------------------------

type BcMessage =
  | { kind: 'hello'; player: PlayerState }
  | { kind: 'state'; player: PlayerState }
  | { kind: 'leave'; id: string }
  | { kind: 'chat'; msg: ChatMessage }
  | { kind: 'who' }
  | { kind: 'emote'; id: string; name: string; emote: string };

function makeBroadcastId(): string {
  // Persist the id across re-renders / hot reloads in this same tab so that
  // when the multiplayer effect tears down and re-runs (because cat or muted
  // changed) we don't appear to other tabs as a different cat with a fresh
  // id every time.
  if (typeof window === 'undefined') return 'tab_ssr';
  const w = window as any;
  if (typeof w.__WOTC_TAB_ID__ === 'string') return w.__WOTC_TAB_ID__;
  const id = 'tab_' + Math.random().toString(36).slice(2, 10);
  w.__WOTC_TAB_ID__ = id;
  return id;
}

export function useMultiplayer(cat: CatAppearance | null, room: string, enabled: boolean): MultiplayerHandle {
  const socketRef = useRef<Socket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const bcIdRef = useRef<string>('');
  const heartbeatRef = useRef<number | null>(null);
  const lastSeenRef = useRef<Record<string, number>>({});

  const upsertPlayer = useGameStore((s) => s.upsertPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const setPlayers = useGameStore((s) => s.setPlayers);
  const setRoom = useGameStore((s) => s.setRoom);
  const pushChat = useGameStore((s) => s.pushChat);
  const setSelfId = useGameStore((s) => s.setSelfId);
  const muted = useGameStore((s) => s.muted);

  useEffect(() => {
    if (!enabled || !cat) return;
    _refs += 1;

    // ----- Socket.io path -----
    if (SOCKET_URL) {
      if (!_socket) {
        _socket = io(SOCKET_URL, { transports: ['websocket'], query: { room } });
      }
      const s = _socket;
      socketRef.current = s;

      const onConnect = () => {
        setSelfId(s.id || '');
        s.emit('join', { room, cat });
      };
      const onRoomState = (rs: any) => setRoom(rs);
      const onPlayersAll = (ps: Record<string, PlayerState>) => setPlayers(ps);
      const onUpsert = (p: PlayerState) => { if (!muted.has(p.socketId)) upsertPlayer(p); };
      const onLeave = (id: string) => removePlayer(id);
      const onChat = (m: ChatMessage) => { if (!muted.has(m.fromId)) pushChat(m); };
      const onSystem = (text: string) => pushChat({ id: 's' + Date.now(), fromId: 'system', fromName: 'System', scope: 'system', text, at: Date.now() });

      s.on('connect', onConnect);
      s.on('room:state', onRoomState);
      s.on('players:all', onPlayersAll);
      s.on('player:upsert', onUpsert);
      s.on('player:leave', onLeave);
      s.on('chat', onChat);
      s.on('system', onSystem);

      if (s.connected) onConnect();

      return () => {
        s.off('connect', onConnect);
        s.off('room:state', onRoomState);
        s.off('players:all', onPlayersAll);
        s.off('player:upsert', onUpsert);
        s.off('player:leave', onLeave);
        s.off('chat', onChat);
        s.off('system', onSystem);
        _refs -= 1;
        if (_refs <= 0 && _socket) {
          _socket.disconnect();
          _socket = null;
          socketRef.current = null;
        }
      };
    }

    // ----- BroadcastChannel path (zero-config local multiplayer) -----
    const bcSupported = typeof window !== 'undefined' && 'BroadcastChannel' in window;
    const myId = makeBroadcastId();
    bcIdRef.current = myId;
    setSelfId(myId);

    const me: PlayerState = {
      socketId: myId,
      // Both tabs load the same cat from localStorage, so without a tweak
      // the OTHER tab sees a duplicate of your name. Append a short tag
      // derived from the tab id (e.g. "Flamestorm·b4f2") so each tab is
      // visually distinct over the wire. Your own HUD still uses the
      // un-suffixed cat from the store, so you see your real name.
      cat: {
        ...cat,
        name: `${cat.name}·${myId.slice(-4)}`,
        id: `${cat.id}__${myId}`,
      },
      pos: [0, 0, 0],
      rot: 0,
      anim: 'idle',
      hp: 100, hunger: 60, stamina: 100, reputation: 50,
      // In the BroadcastChannel / offline path there's no real server to
      // assign clan leadership, so we treat the local player as leader of
      // their own clan by default. That's what unlocks the Leader actions
      // button in the HUD.
      isLeader: true,
      isDeputy: false,
    };

    setPlayers({ [myId]: me });
    setRoom({
      roomId: bcSupported ? `local-${room}` : 'offline',
      leaderId: myId,
      leaderByClan: { [cat.clan]: myId } as any,
      deputyByClan: {} as any,
      weather: 'clear', season: 'greenleaf', timeOfDay: 0.4, preyAlive: 24, events: [],
    });

    if (!bcSupported) {
      pushChat({ id: 's0', fromId: 'system', fromName: 'StarClan', scope: 'system', text: 'You are alone — your browser does not support cross-tab multiplayer.', at: Date.now() });
      return () => { _refs -= 1; };
    }

    const bc = new BroadcastChannel(`wotc-${room}`);
    bcRef.current = bc;

    const send = (m: BcMessage) => { try { bc.postMessage(m); } catch {} };

    // Announce ourselves and ask everyone else to announce themselves.
    // Send a few times in case the receiver tab's BC handler attached just
    // after we sent.
    send({ kind: 'hello', player: me });
    send({ kind: 'who' });
    setTimeout(() => { try { send({ kind: 'who' }); } catch {} }, 800);
    setTimeout(() => { try { send({ kind: 'who' }); } catch {} }, 2500);

    pushChat({
      id: 's0',
      fromId: 'system',
      fromName: 'StarClan',
      scope: 'system',
      text: 'You step into the forest. Open the game in another browser tab to see another warrior here with you.',
      at: Date.now(),
    });

    bc.onmessage = (ev) => {
      const m = ev.data as BcMessage;
      if (!m || typeof m !== 'object') return;
      switch (m.kind) {
        case 'hello':
        case 'state': {
          if (m.player.socketId === myId) return;
          if (muted.has(m.player.socketId)) return;
          lastSeenRef.current[m.player.socketId] = Date.now();
          upsertPlayer(m.player);
          if (m.kind === 'hello') {
            // Greet the new tab back so it sees us immediately
            const cur = useGameStore.getState().players[myId];
            if (cur) send({ kind: 'state', player: cur });
            pushChat({
              id: 'sj' + Date.now(),
              fromId: 'system',
              fromName: 'StarClan',
              scope: 'system',
              text: `${m.player.cat.name} of ${m.player.cat.clan} steps into the territory.`,
              at: Date.now(),
            });
          }
          break;
        }
        case 'who': {
          const cur = useGameStore.getState().players[myId];
          if (cur) send({ kind: 'state', player: cur });
          break;
        }
        case 'leave': {
          if (m.id === myId) return;
          removePlayer(m.id);
          delete lastSeenRef.current[m.id];
          break;
        }
        case 'chat': {
          if (m.msg.fromId === myId) return;
          if (muted.has(m.msg.fromId)) return;
          pushChat(m.msg);
          break;
        }
        case 'emote': {
          if (m.id === myId) return;
          if (muted.has(m.id)) return;
          pushChat({
            id: 'em' + Date.now(),
            fromId: m.id,
            fromName: m.name,
            scope: 'nearby',
            text: `*${m.emote.replace('-', ' ')}s*`,
            at: Date.now(),
            emote: m.emote,
          });
          break;
        }
      }
    };

    // Heartbeat: re-announce our state, and prune neighbours we haven't heard
    // from in 7s (other tab probably closed).
    heartbeatRef.current = window.setInterval(() => {
      const cur = useGameStore.getState().players[myId];
      if (cur) send({ kind: 'state', player: cur });

      const now = Date.now();
      const players = useGameStore.getState().players;
      for (const id of Object.keys(players)) {
        if (id === myId) continue;
        const seen = lastSeenRef.current[id];
        if (!seen || now - seen > 7000) {
          removePlayer(id);
          delete lastSeenRef.current[id];
        }
      }
    }, 2000) as unknown as number;

    const onUnload = () => {
      try { send({ kind: 'leave', id: myId }); } catch {}
      try { bc.close(); } catch {}
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      _refs -= 1;
      // Only fully tear down when the LAST consumer unmounts (e.g. on real
      // page unload). React strict-mode and dep-driven re-runs would
      // otherwise broadcast a fake "leave" and yank our cat out of every
      // other tab's view.
      if (_refs <= 0) {
        try { send({ kind: 'leave', id: myId }); } catch {}
        try { bc.close(); } catch {}
        bcRef.current = null;
      }
      if (heartbeatRef.current != null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [enabled, cat, room, setSelfId, upsertPlayer, removePlayer, setPlayers, setRoom, pushChat, muted]);

  return {
    socket: socketRef.current,
    sendMove: (pos, rot, anim) => {
      if (socketRef.current) {
        socketRef.current.emit('move', { pos, rot, anim });
        return;
      }
      // BroadcastChannel path. Build a fresh full player record every call
      // — that way we always broadcast even if the local players map got
      // reset, and the broadcast cat carries the per-tab name suffix.
      const myId = bcIdRef.current || (typeof window !== 'undefined' ? (window as any).__WOTC_TAB_ID__ : '');
      if (!myId || !cat) return;
      const cur = useGameStore.getState().players[myId];
      const next: PlayerState = {
        socketId: myId,
        cat: {
          ...cat,
          name: `${cat.name}·${myId.slice(-4)}`,
          id: `${cat.id}__${myId}`,
        },
        pos, rot, anim,
        hp: cur?.hp ?? 100,
        hunger: cur?.hunger ?? 60,
        stamina: cur?.stamina ?? 100,
        reputation: cur?.reputation ?? 50,
        isLeader: cur?.isLeader ?? true,
        isDeputy: cur?.isDeputy ?? false,
      };
      useGameStore.getState().upsertPlayer(next);
      try { bcRef.current?.postMessage({ kind: 'state', player: next } as BcMessage); } catch {}
    },
    sendChat: (text, scope) => {
      if (socketRef.current) {
        socketRef.current.emit('chat', { text, scope });
        return;
      }
      if (!cat) return;
      const myId = bcIdRef.current || useGameStore.getState().selfId;
      const msg: ChatMessage = {
        id: 'me' + Date.now(),
        fromId: myId,
        fromName: cat.name,
        scope,
        text,
        at: Date.now(),
      };
      useGameStore.getState().pushChat(msg);
      try { bcRef.current?.postMessage({ kind: 'chat', msg } as BcMessage); } catch {}
    },
    sendEmote: (emote) => {
      try { useGameStore.getState().bumpTask('emote-n', 1); } catch {}
      // Vocalize the emote — purr/meow/hiss/mew get said out loud as a
      // chat line in addition to the *action* asterisk version. Other
      // emotes stay as actions only.
      const said: Record<string, string> = {
        purr: 'mrrrr…',
        mew: 'mew!',
        hiss: 'hsssss!',
      };
      if (socketRef.current) {
        socketRef.current.emit('emote', { emote });
        return;
      }
      if (!cat) return;
      const myId = bcIdRef.current || useGameStore.getState().selfId;
      const s = useGameStore.getState();
      s.pushChat({
        id: 'em' + Date.now(),
        fromId: myId,
        fromName: cat.name,
        scope: 'nearby',
        text: `*${emote.replace('-', ' ')}s*`,
        at: Date.now(),
        emote,
      });
      if (said[emote]) {
        s.pushChat({
          id: 'sp' + Date.now(),
          fromId: myId,
          fromName: cat.name,
          scope: 'nearby',
          text: said[emote],
          at: Date.now() + 1,
        });
      }
      try { bcRef.current?.postMessage({ kind: 'emote', id: myId, name: cat.name, emote } as BcMessage); } catch {}
    },
    sendCommand: (kind, payload) => socketRef.current?.emit('command', { kind, payload }),
    sendCatch: (preyId, kind) => socketRef.current?.emit('catch', { preyId, kind }),
  };
}
