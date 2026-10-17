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
- `apps/client` — (todo) PixiJS PWA
- `apps/server` — (todo) Colyseus server

## Commands

- `pnpm test` — all tests
- `pnpm typecheck`
- dev server log: `.agent/dev.log` (`pnpm dev 2>&1 | tee .agent/dev.log`)

## Workflow

TDD: write failing test in `packages/shared/test` first, then minimal code, then refactor.
