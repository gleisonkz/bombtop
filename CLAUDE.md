# Bombtop

Browser (PWA) multiplayer arena bomb game, inspired by the classic 16-bit battle mode.
All art, audio and names are original — never copy assets from existing games.

## Decisions

- **Language:** TypeScript end-to-end, pnpm monorepo. No Rust/WASM (CPU is not the bottleneck; network is).
- **Simulation:** `packages/shared` — pure, deterministic, fixed tick (`TICK_RATE`), integer/tile math, no I/O.
  Runs authoritatively on the server (the client reuses it to predict its own player).
- **Players:** max 5 per match (`MAX_PLAYERS`), 13x11 arena. May grow later.
- **Mode:** battle mode only (no story mode for now).
- **Mechanics:** all classic ones are in scope — bombs, fire, speed, kick, punch, glove/throw,
  remote bomb, pierce bomb, skull/virus, mounts, revenge cart, stage gimmicks.
- **Server:** Colyseus (Node), authoritative. Client interpolates snapshots (prediction: todo).
- **Client:** Vite + PixiJS + vite-plugin-pwa. Touch joystick + gamepad + keyboard.
- **Auth/data:** Supabase (Google login; profiles/ranking todo). Optional: unset = guest-only.
- **Rooms:** public matchmaking + private rooms by code.
- **Anti-cheat:** server authority; client only sends inputs.

## Layout

- `packages/shared` — game simulation + tests (Vitest)
- `apps/client` — Vite + PixiJS PWA: menu, lobby, online play.
  Inputs in `src/input` (keyboard, gamepad, touch) are pure and unit-tested; DOM/Pixi glue is not.
- `apps/server` — Colyseus 0.18 server (`@colyseus/core` + ws-transport). `BattleSession` holds
  all room logic (unit-tested); `BattleRoom` is a thin adapter (integration-tested over the network).

## Commands

- `pnpm dev` — client (Vite) + game server (ws://localhost:2567) in parallel
- `pnpm dev:client` / `pnpm dev:server` — one at a time
- Client server URL: `VITE_SERVER_URL` (default `<page host>:2567`; a path like `/colyseus` uses the page origin + dev proxy, for tunnels)
- `pnpm test` — all tests
- `pnpm typecheck`
- dev server logs: `.agent/dev.log` (client), `.agent/server.log` (game server)
- phone testing (fixed URL, keeps an installed PWA working): `MSYS_NO_PATHCONV=1 VITE_SERVER_URL=/colyseus pnpm -C apps/client dev --port 5199 --strictPort` + `ngrok http 5199 --url=https://olive-telegnostic-softheartedly.ngrok-free.dev` (log `.agent/ngrok.log`). In Git Bash, `MSYS_NO_PATHCONV=1` stops `/colyseus` from being rewritten to a Windows path.
- In dev, the latest server snapshot is exposed for debugging: `window.__snapshot`.

## Mechanics (all in `packages/shared/src`)

| Item / feature | File | Notes |
|---|---|---|
| fire, bomb, speed, full fire | `items.ts` | caps: 8 fire, 8 bombs, 2x speed |
| kick | `kick.ts` | push into a resting bomb; slides at 2x walk speed |
| remote | `bombs.ts` | action detonates oldest; normal fuse if owner dies |
| pierce | `bombs.ts` | flames run through blocks/items/bombs; walls stop them |
| punch | `air.ts` | action launches bomb in front 3 tiles; wraps edges; bounces; stuns |
| glove | `air.ts` | bomb on own bomb lifts it, press again throws |
| skull | `curse.ts` | slow/fast/reverse/diarrhea/constipation/weakFire, 10s, contagious |
| egg (mounts) | `mount.ts` | extra hit + 2s invuln; hopper jump, dasher burst, pusher kicks |
| sudden death | `pressure.ts` | after 3 min walls fall in an inward spiral (crush ignores mounts) |
| revenge cart | `revenge.ts` | dead ride the border, throw bombs; a kill swaps them back in |
| stages | `stage.ts`, `floor.ts` | classic, conveyor (belts), warp (paired teleporters) |

Action button priority: detonate remote > punch > mount ability.

## Environment

- client (`apps/client/.env`): `VITE_SERVER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- server (`apps/server/.env` / process env): `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REQUIRE_AUTH`
- The server verifies Google logins by calling Supabase `/auth/v1/user` (no JWT secret needed).
  Colyseus rejects a falsy `onAuth` result, so guests get a `{ guest: true }` marker.

## Networking

- Server-authoritative, 60 Hz sim; snapshots (`publicView`: no buried items, no PRNG state) at 30 Hz.
- Client sends input only on change/button press; server buffers button taps between ticks.
- Client renders snapshots 100 ms in the past, interpolated. No client-side prediction yet.
- Clients must send `sync` after attaching message handlers: the SDK drops messages that
  arrive before a handler exists.

## Gotchas

- The `colyseus` meta-package pulls uWebSockets.js from git, which pnpm blocks; use
  `@colyseus/core` + `@colyseus/ws-transport` instead.
- Vite can cache a failed import if a file is created after the module importing it was saved;
  restart the dev server if a just-created module "does not exist".
- Some browser extensions swallow letter keys (R, Q seen) before the page sees them.
  Never rely on a single letter key for essential actions; bomb keys also work.
- Automated/background Chrome tabs throttle requestAnimationFrame (~1 fps), so the
  game runs at ~5 ticks/s there (FixedStep caps catch-up). Not a game bug.

## Workflow

TDD: write the failing test first (`packages/shared/test`, `apps/*/test`), then minimal code,
then refactor. Atomic commits: one logical change per commit, every commit green.
