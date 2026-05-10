# Warriors of the Clans

A multiplayer browser game inspired by the world of the Warrior Cats book series. Built with Next.js, React, TypeScript, Tailwind, Three.js (`@react-three/fiber`), and Socket.io.

> **Scope note:** This repo is a deployable, playable foundation that implements the systems requested in the brief — character creation with persistence, clan & role selection (including auto leader/deputy assignment), a 3D forest world with day/night cycle, weather, seasons, simple AI prey & catch mechanics, herbs, stamina/hunger/HP, chat with filtering, mobile joystick + look-pad controls, accessibility settings, etc. AAA-quality realistic cat models and animations are stubbed with a clean procedural rig that you can swap out for GLTF assets later.

## Quick start

```bash
npm install
npm run dev:all   # runs Next.js (3000) + Socket.io server (3001) together
# or separately:
npm run dev       # frontend only
npm run server    # multiplayer server only
```

Open http://localhost:3000.

To enable multiplayer locally, copy `.env.example` to `.env.local` and set:

```
WARRIOR_CATS_PUBLIC_SOCKET_URL=http://localhost:3001
# On Vercel / Next deployments, also set this so the browser bundle sees it:
# NEXT_PUBLIC_WARRIOR_CATS_SOCKET_URL=http://localhost:3001
```

Without that variable the game runs in offline single-player mode, where you are the leader of your chosen clan.

## Deploying

### Frontend → Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel as a **Next.js** project.
3. In Project → Settings → Environment Variables, set `WARRIOR_CATS_PUBLIC_SOCKET_URL` (and the Next-visible variant `NEXT_PUBLIC_WARRIOR_CATS_SOCKET_URL`) to your Socket.io server URL (e.g. `https://warriors-server.onrender.com`). Leave it blank for offline-only.
4. Deploy.

### Multiplayer server → Render / Railway / Fly.io

Vercel serverless does not support persistent WebSocket connections, so the Socket.io server must be hosted separately. The `/server` directory is a self-contained Node.js app:

```bash
cd server
npm install
PORT=3001 CORS_ORIGIN=https://your-vercel-app.vercel.app npm start
```

Render / Railway: point the service at the `server/` directory, set `PORT` if required, and set `CORS_ORIGIN` to your frontend domain (or `*`).

## Controls

### Desktop / keyboard
- **WASD / Arrows** – move
- **Shift** – sprint (drains stamina)
- **C / Ctrl** – crouch (hunting stealth)
- **Q** – pounce (attempt to catch nearest prey)
- **Space** – jump
- **E** – interact
- **F** – attack / swipe
- **V** – toggle first/third-person camera
- **Click** – capture mouse for look (Esc to release)
- **Enter** – chat (focus the chat input)

### Touch / mobile
- **Left joystick** – move
- **Right half of screen** – swipe to look
- **Run / Crouch / Pounce / Jump** buttons
- HUD scales via Settings → Accessibility

## Features implemented

- Character creator with fur color/pattern/belly/eye color, ear shape, tail type, fluffiness, height, build/weight, scars, name (prefix + suffix + custom), clan, role, bubble style, voice pitch
- Five-tier size system (Tiny → Massive) with stat effects (speed/strength/stamina/hunting)
- Seven affiliations (ThunderClan, RiverClan, ShadowClan, WindClan, Rogue, Loner, Kitty Pet) with unique camp coordinates, clan colors, scents, prey, and skill bonuses
- Eleven roles (Kit, Apprentice, Warrior, Med-Cat Apprentice, Med-Cat, Deputy, Leader, Elder, Kitty Pet, Rogue, Loner) with duties/abilities
- Auto leader/deputy assignment per clan when joining a server; deputy succeeds leader on disconnect
- 3D world: forest terrain, oak/pine/birch trees per biome, riverbed, moor, twoleg place, Moonpool stone ring, all clan camps with leader rocks
- Day/night cycle with shifting sky gradient, sun/moon directional light, ambient + hemisphere lighting at night
- Weather: clear / fog / rain / snow / storm with appropriate particle effects and fog distance
- Seasons: newleaf / greenleaf / leaf-fall / leaf-bare drift the foliage colors
- Procedural rigged cat: walking/running/sitting/sleeping/crouching/pouncing/limping animations, tail wave, ear twitch, head bob; carries prey in mouth
- AI prey: mice, rabbits, fish, birds, squirrels with flee behavior; pounce-to-catch
- Hunger / Stamina / HP / Reputation HUD
- Herb gathering & inventory (10 canonical herbs from the books); medicine cats can heal
- Warrior Code (15 rules) with reputation cost on break
- Chat: nearby & clan scopes, profanity filter, friend/mute/report on each message, emote shortcuts, speech bubbles above cats in-world
- Leader actions panel: organize patrols, call gatherings, declare war, promote, appoint deputy, mentor an apprentice
- Settings: low/medium/high graphics, third/first-person, sound & music sliders, UI scale, colorblind filters (proto/deuto/trito), invert Y
- Mobile joystick + look pad, sized for touch and tablets
- Local persistence: cat, settings, friends/mutes, reputation persist across sessions

## Repository layout

```
src/
  app/             Next.js App Router entry (layout, page, globals)
  components/      UI: TitleScreen, CharacterCreator, HUD, Chat, MobileControls, Settings, LeaderPanel
  game/            3D scene & networking: Cat, World, Prey, Game, CameraRig, useControls, useMultiplayer, useGameStore, types
  lib/             Pure data: clans, roles, herbs, warriorCode, chatFilter, persist
server/            Standalone Socket.io server (deploy separately from Vercel)
```

## Roadmap (left as TODO for a real product)

- Replace procedural cat with GLTF rigged model + skeletal animations
- Authoritative server-side movement/anti-cheat
- Email auth (Supabase / Firebase) on top of guest accounts
- Per-region authority shards for performance
- Larger handcrafted territories per clan
- Expanded herb/illness loop with diagnoses minigame
- Family trees & inherited traits
- Audio: ambient forest loops, biome music, foley

## License

MIT
