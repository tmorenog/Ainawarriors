/* eslint-disable */
// Standalone Socket.io server for Warriors of the Clans.
// Deploy on Render / Railway / Fly.io / your own Node host.
// Configure NEXT_PUBLIC_SOCKET_URL in the Vercel project to point at this server.

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const ORIGIN = process.env.CORS_ORIGIN || '*';

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, name: 'Warriors of the Clans Socket Server' }));
    return;
  }
  res.writeHead(404); res.end();
});

const io = new Server(server, {
  cors: { origin: ORIGIN, methods: ['GET', 'POST'] },
  pingInterval: 15000,
  pingTimeout: 30000,
});

const BANNED = ['idiot','stupid','hate you','kys','shit','fuck','bitch','asshole','damn','noob','loser'];
function filter(text) {
  let t = String(text || '').slice(0, 240);
  for (const w of BANNED) {
    const re = new RegExp(`\\b${w}\\b`, 'ig');
    t = t.replace(re, '*'.repeat(Math.max(2, w.length)));
  }
  t = t.replace(/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, '[redacted]');
  t = t.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, '[redacted]');
  return t;
}

// rooms: { id -> Room }
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, {
      id,
      players: new Map(), // socketId -> player
      leaderByClan: {},
      deputyByClan: {},
      world: {
        weather: 'clear',
        season: 'greenleaf',
        timeOfDay: 0.4,
        events: [],
        preyAlive: 28,
      },
    });
  }
  return rooms.get(id);
}

// World tick: time, weather, random events
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    room.world.timeOfDay = (room.world.timeOfDay + 0.0008) % 1;

    // weather drift
    if (Math.random() < 0.005) {
      const next = ['clear', 'clear', 'clear', 'fog', 'rain', 'snow', 'storm'][Math.floor(Math.random() * 7)];
      room.world.weather = next;
    }
    // season drift slow
    if (Math.random() < 0.0008) {
      const seasons = ['newleaf', 'greenleaf', 'leaf-fall', 'leaf-bare'];
      const idx = seasons.indexOf(room.world.season);
      room.world.season = seasons[(idx + 1) % seasons.length];
    }
    // random events
    if (Math.random() < 0.003) {
      const kinds = ['StarClanSign','HerbShortage','PredatorAttack','ClanInvasion','ForestFire'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      room.world.events.push({ id: 'ev' + now, kind, at: now });
      io.to(room.id).emit('system', `An event unfolds: ${kind}.`);
    }
    // trim events
    room.world.events = room.world.events.filter((e) => now - e.at < 60_000);

    // broadcast room state
    io.to(room.id).emit('room:state', {
      roomId: room.id,
      leaderId: Object.values(room.leaderByClan)[0] || null,
      leaderByClan: room.leaderByClan,
      deputyByClan: room.deputyByClan,
      weather: room.world.weather,
      season: room.world.season,
      timeOfDay: room.world.timeOfDay,
      preyAlive: room.world.preyAlive,
      events: room.world.events,
    });
  }
}, 1000);

io.on('connection', (socket) => {
  let joinedRoom = null;

  socket.on('join', ({ room, cat }) => {
    if (!cat || !room) return;
    joinedRoom = String(room).slice(0, 48);
    socket.join(joinedRoom);
    const r = getRoom(joinedRoom);
    const clan = String(cat.clan || 'ThunderClan');

    // assign leader/deputy
    let isLeader = false, isDeputy = false;
    if (!r.leaderByClan[clan]) {
      r.leaderByClan[clan] = socket.id;
      isLeader = true;
      cat.role = 'Leader';
    } else if (!r.deputyByClan[clan]) {
      r.deputyByClan[clan] = socket.id;
      isDeputy = true;
      cat.role = cat.role === 'Leader' ? 'Warrior' : 'Deputy';
    }

    const player = {
      socketId: socket.id,
      cat,
      pos: [0, 0, 0],
      rot: 0,
      anim: 'idle',
      hp: 100,
      hunger: 60,
      stamina: 100,
      reputation: 50,
      isLeader,
      isDeputy,
      carrying: null,
    };
    r.players.set(socket.id, player);

    // send everyone-state to new player
    const all = {};
    r.players.forEach((p, id) => { all[id] = p; });
    socket.emit('players:all', all);

    // announce
    io.to(joinedRoom).emit('player:upsert', player);
    io.to(joinedRoom).emit('system', `${cat.name} of ${clan} has entered the territory.`);
  });

  socket.on('move', ({ pos, rot, anim }) => {
    if (!joinedRoom) return;
    const r = getRoom(joinedRoom);
    const p = r.players.get(socket.id);
    if (!p) return;
    if (Array.isArray(pos) && pos.length === 3) p.pos = pos.map(Number);
    if (typeof rot === 'number') p.rot = rot;
    if (typeof anim === 'string') p.anim = anim;
    socket.to(joinedRoom).emit('player:upsert', p);
  });

  socket.on('chat', ({ text, scope }) => {
    if (!joinedRoom) return;
    const r = getRoom(joinedRoom);
    const p = r.players.get(socket.id);
    if (!p) return;
    const clean = filter(text);
    if (!clean.trim()) return;
    const msg = {
      id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
      fromId: socket.id,
      fromName: p.cat.name,
      scope: scope === 'clan' ? 'clan' : 'nearby',
      text: clean,
      at: Date.now(),
    };
    if (msg.scope === 'clan') {
      const myClan = p.cat.clan;
      r.players.forEach((other, id) => {
        if (other.cat.clan === myClan) io.to(id).emit('chat', msg);
      });
    } else {
      // nearby: within 40 units
      r.players.forEach((other, id) => {
        const dx = other.pos[0] - p.pos[0];
        const dz = other.pos[2] - p.pos[2];
        if (Math.hypot(dx, dz) < 40) io.to(id).emit('chat', msg);
      });
    }
  });

  socket.on('emote', ({ emote }) => {
    if (!joinedRoom) return;
    const r = getRoom(joinedRoom);
    const p = r.players.get(socket.id);
    if (!p) return;
    const msg = {
      id: 'e' + Date.now(),
      fromId: socket.id,
      fromName: p.cat.name,
      scope: 'nearby',
      text: `*${String(emote).slice(0, 24)}*`,
      at: Date.now(),
      emote: String(emote).slice(0, 24),
    };
    io.to(joinedRoom).emit('chat', msg);
  });

  socket.on('catch', ({ preyId, kind }) => {
    if (!joinedRoom) return;
    io.to(joinedRoom).emit('system', `Prey caught: ${kind || 'unknown'}.`);
  });

  socket.on('disaster', (d) => {
    if (!joinedRoom || !d || typeof d !== 'object') return;
    const kind = ['twoleg', 'flood', 'fire'].includes(d.kind) ? d.kind : null;
    const until = Number(d.until);
    const message = String(d.message || '').slice(0, 240);
    if (!kind || !Number.isFinite(until) || !message) return;
    // Fan out to everyone in the room EXCEPT the originator — they already
    // applied it locally before emitting.
    socket.to(joinedRoom).emit('disaster', { kind, until, message });
  });

  socket.on('command', ({ kind, payload }) => {
    if (!joinedRoom) return;
    const r = getRoom(joinedRoom);
    const p = r.players.get(socket.id);
    if (!p) return;
    if (!p.isLeader && !(p.isDeputy && (kind === 'patrol'))) return;

    if (kind === 'patrol') {
      io.to(joinedRoom).emit('system', `${p.cat.name} organized a ${payload?.kind ?? 'patrol'} patrol.`);
    } else if (kind === 'gathering') {
      io.to(joinedRoom).emit('system', `${p.cat.name} calls a Gathering at the next full moon.`);
    } else if (kind === 'war') {
      io.to(joinedRoom).emit('system', `${p.cat.name} declares war on ${payload?.target ?? 'a rival'}.`);
    } else if (kind === 'promote' && payload?.id) {
      const target = r.players.get(payload.id);
      if (target) {
        const order = ['Kit', 'Apprentice', 'Warrior', 'Deputy', 'Leader'];
        const i = order.indexOf(target.cat.role);
        if (i >= 0 && i < order.length - 1) target.cat.role = order[i + 1];
        io.to(joinedRoom).emit('player:upsert', target);
        io.to(joinedRoom).emit('system', `${p.cat.name} promotes ${target.cat.name} to ${target.cat.role}.`);
      }
    } else if (kind === 'appoint_deputy' && payload?.id) {
      const target = r.players.get(payload.id);
      if (target && target.cat.clan === p.cat.clan) {
        const oldDeputyId = r.deputyByClan[p.cat.clan];
        if (oldDeputyId) {
          const old = r.players.get(oldDeputyId);
          if (old) { old.isDeputy = false; if (old.cat.role === 'Deputy') old.cat.role = 'Warrior'; io.to(joinedRoom).emit('player:upsert', old); }
        }
        target.isDeputy = true;
        target.cat.role = 'Deputy';
        r.deputyByClan[p.cat.clan] = target.socketId;
        io.to(joinedRoom).emit('player:upsert', target);
        io.to(joinedRoom).emit('system', `${p.cat.name} names ${target.cat.name} the new Deputy of ${p.cat.clan}.`);
      }
    } else if (kind === 'apprentice' && payload?.id) {
      const target = r.players.get(payload.id);
      if (target) {
        target.cat.role = 'Apprentice';
        io.to(joinedRoom).emit('player:upsert', target);
        io.to(joinedRoom).emit('system', `${p.cat.name} mentors ${target.cat.name}.`);
      }
    }
  });

  socket.on('disconnect', () => {
    if (!joinedRoom) return;
    const r = rooms.get(joinedRoom);
    if (!r) return;
    const p = r.players.get(socket.id);
    if (!p) return;
    r.players.delete(socket.id);
    io.to(joinedRoom).emit('player:leave', socket.id);

    // succession: if leader leaves, deputy takes the role
    if (p.isLeader && r.leaderByClan[p.cat.clan] === socket.id) {
      delete r.leaderByClan[p.cat.clan];
      const deputyId = r.deputyByClan[p.cat.clan];
      const newLeader = deputyId ? r.players.get(deputyId) : null;
      if (newLeader) {
        newLeader.isLeader = true;
        newLeader.isDeputy = false;
        newLeader.cat.role = 'Leader';
        r.leaderByClan[p.cat.clan] = newLeader.socketId;
        delete r.deputyByClan[p.cat.clan];
        io.to(joinedRoom).emit('player:upsert', newLeader);
        io.to(joinedRoom).emit('system', `${newLeader.cat.name} takes nine lives at the Moonpool. Hail the new Leader of ${p.cat.clan}.`);
      } else {
        // promote first warrior of the same clan
        const next = [...r.players.values()].find((x) => x.cat.clan === p.cat.clan);
        if (next) {
          next.isLeader = true;
          next.cat.role = 'Leader';
          r.leaderByClan[p.cat.clan] = next.socketId;
          io.to(joinedRoom).emit('player:upsert', next);
          io.to(joinedRoom).emit('system', `${next.cat.name} rises to lead ${p.cat.clan}.`);
        }
      }
    }
    if (p.isDeputy && r.deputyByClan[p.cat.clan] === socket.id) {
      delete r.deputyByClan[p.cat.clan];
    }

    if (r.players.size === 0) rooms.delete(joinedRoom);
  });
});

server.listen(PORT, () => {
  console.log(`Warriors socket server listening on :${PORT}`);
});
