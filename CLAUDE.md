# Bombtopia

Browser (PWA) multiplayer arena bomb game, inspired by the classic 16-bit battle mode.
All art, audio and names are original — never copy assets from existing games.

## Decisions

- **Language:** TypeScript end-to-end, pnpm monorepo. No Rust/WASM (CPU is not the bottleneck; network is).
- **Simulation:** `packages/shared` — pure, deterministic, fixed tick (`TICK_RATE`), integer/tile math, no I/O.
  Runs authoritatively on the server and for prediction on the client.
- **Players:** max 5 per match (`MAX_PLAYERS`), 13x11 arena. May grow later.
- **Mode:** battle mode only (no story mode for now).
- **Mechanics:** all classic ones are in scope — bombs, fire, speed, kick, punch, glove/throw,
  remote bomb, pierce bomb, skull/virus, mounts, revenge cart, stage gimmicks.
- **Server:** Colyseus (Node), authoritative. Client predicts own movement, interpolates others.
- **Client:** Vite + PixiJS + vite-plugin-pwa. Touch D-pad + gamepad + keyboard.
- **Auth/data:** Supabase (Google login, profiles, ranking).
- **Rooms:** public matchmaking + private rooms by code.
- **Anti-cheat:** server authority; client only sends inputs.

## Layout

- `packages/shared` — game simulation + tests (Vitest)
- `apps/client` — Vite + PixiJS client: menu, lobby, online play, local 2-player mode (PWA todo)
- `apps/server` — Colyseus 0.18 server (`@colyseus/core` + ws-transport). `BattleSession` holds
  all room logic (unit-tested); `BattleRoom` is a thin adapter (integration-tested over the network).

## Commands

- `pnpm dev` — client (Vite) + game server (ws://localhost:2567) in parallel
- `pnpm dev:client` / `pnpm dev:server` — one at a time
- Client server URL: `VITE_SERVER_URL` (default `<page host>:2567`)
- `pnpm test` — all tests
- `pnpm typecheck`
- dev server logs: `.agent/dev.log` (client), `.agent/server.log` (game server)
- In dev, the live state is exposed for debugging: `window.__match` (local game),
  `window.__snapshot` (latest server snapshot, online).

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

TDD: write failing test in `packages/shared/test` first, then minimal code, then refactor.
