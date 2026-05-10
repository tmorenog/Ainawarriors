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

export function useMultiplayer(cat: CatAppearance | null, room: string, enabled: boolean): MultiplayerHandle {
  const socketRef = useRef<Socket | null>(null);
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
    // No URL? Run offline (single player) — leader is set locally.
    if (!SOCKET_URL) {
      // Stable id so editing the cat (e.g. changing role/fur) updates the
      // same player record instead of leaving an old "clone" of the previous
      // self in the players map.
      const localId = 'local_self';
      setSelfId(localId);
      const me: PlayerState = {
        socketId: localId,
        cat,
        pos: [0, 0, 0],
        rot: 0,
        anim: 'idle',
        hp: 100, hunger: 60, stamina: 100, reputation: 50,
        isLeader: true, isDeputy: false,
      };
      // Wipe any stale records (in case a different id lingered from a
      // previous session before this fix shipped).
      setPlayers({ [localId]: me });
      setRoom({
        roomId: 'offline',
        leaderId: localId,
        leaderByClan: { [cat.clan]: localId } as any,
        deputyByClan: {} as any,
        weather: 'clear', season: 'greenleaf', timeOfDay: 0.4, preyAlive: 24, events: [],
      });
      pushChat({ id: 's0', fromId: 'system', fromName: 'StarClan', scope: 'system', text: 'You are alone in the territory. (No multiplayer server configured — set NEXT_PUBLIC_SOCKET_URL to connect)', at: Date.now() });
      return () => { _refs -= 1; };
    }

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
  }, [enabled, cat, room, setSelfId, upsertPlayer, removePlayer, setPlayers, setRoom, pushChat, muted]);

  return {
    socket: socketRef.current,
    sendMove: (pos, rot, anim) => {
      socketRef.current?.emit('move', { pos, rot, anim });
    },
    sendChat: (text, scope) => {
      if (socketRef.current) socketRef.current.emit('chat', { text, scope });
      else if (cat) {
        // offline echo
        useGameStore.getState().pushChat({
          id: 'me' + Date.now(),
          fromId: useGameStore.getState().selfId,
          fromName: cat.name,
          scope, text, at: Date.now(),
        });
      }
    },
    sendEmote: (emote) => {
      if (socketRef.current) {
        socketRef.current.emit('emote', { emote });
      } else if (cat) {
        // Offline: echo the emote into the chat feed so the player sees it.
        useGameStore.getState().pushChat({
          id: 'em' + Date.now(),
          fromId: useGameStore.getState().selfId,
          fromName: cat.name,
          scope: 'nearby',
          text: `*${emote.replace('-', ' ')}s*`,
          at: Date.now(),
          emote,
        });
      }
    },
    sendCommand: (kind, payload) => socketRef.current?.emit('command', { kind, payload }),
    sendCatch: (preyId, kind) => socketRef.current?.emit('catch', { preyId, kind }),
  };
}
