# Bombtop

Browser (PWA) multiplayer arena bomb game, inspired by the classic 16-bit battle mode.
Non-commercial fan project: characters may be fan art of existing franchises (e.g. Captain America).

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
- **Rooms:** public matchmaking + private rooms by code. In a room the address is `/sala/<code>` (`net/room-route.ts`): it is the invite link, a reload takes the same seat back (reconnection token in sessionStorage, `net/seat.ts`), the back button leaves. Render rewrites `/sala/*` to `index.html` (`render.yaml`); old `?sala=` links still work. The item guide lives at `/itens` the same way (`net/guide-route.ts`; also rewritten in `render.yaml`).
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
- phone testing (fixed URL, keeps an installed PWA working): `MSYS_NO_PATHCONV=1 PWA_DEV=1 VITE_SERVER_URL=/colyseus pnpm -C apps/client dev --port 5199 --strictPort` + `ngrok http 5199 --url=https://olive-telegnostic-softheartedly.ngrok-free.dev` (log `.agent/ngrok.log`). In Git Bash, `MSYS_NO_PATHCONV=1` stops `/colyseus` from being rewritten to a Windows path. `PWA_DEV=1` turns the service worker on in dev (only for this; plain `pnpm dev` runs without it so pages never go stale).
- In dev, the latest server snapshot is exposed for debugging: `window.__snapshot`; the renderer as `window.__renderer`
  (leave to the menu, then `__renderer.draw(snapshot, new Map(), 1)` to inspect a still frame).
- Deploy: client = Render static site (`render.yaml`), built with `VITE_SERVER_URL` = the game server URL.
  Game server = Hostinger VPS in Brazil (`deploy/vps`, ~6 ms from São Paulo vs ~196 ms on Render's Oregon):
  `wss://187-127-63-110.sslip.io`, auto-deployed from `main` within ~1-2 min by a systemd timer.
  The old Render server (`bombtop-server`, free, sleeps when idle) is still in the Blueprint as a fallback.

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
| stages | `stage.ts`, `floor.ts` | classic, conveyor (belts), warp (paired teleporters). Only classic is in the rotation (`STAGES`) for now |
| Bots (easy / medium / hard) | `bot.ts` | Danger map with blast timings and chain reactions, escape-first; levels differ in reaction time, safety margin, bomb count, hunting and trapping. Server runs them (`session.ts`), host adds them in the lobby |
| specials | `special.ts` | special button (E / right Ctrl, pad Y, touch ❄). Ninja: ice blast 4 tiles straight ahead, first player hit frozen 5 s (flames still kill), 20 s recharge. Bomb: none yet |

Action button priority: detonate remote > punch > mount ability.

Characters (looks only): `CHARACTERS` in `protocol.ts` (bomb mascot, ninja). Picked in the lobby (own seat),
saved in localStorage and sent on join; bots alternate. Both use sprite sheets (`SHEETS` in `render/sprites.ts`) in the arena and the menus (`ui/sheet-art.ts`):
ninja made in PixelLab at 128px (characters "Ice ninja HD" + its "Carry" state; frames laid out by
`scripts/build-ninja-sheet.py`, includes carry and lobby rows; the ice cast is posed from our own skeletons with the ice drawn over it by `scripts/build-ninja-cast.py`), bomb from `scripts/build-bomber.py`.
Art is HD: everything else (bombs, items, flames, tiles) is also drawn by scripts in `apps/client/scripts`
(see `public/sprites/LICENSES.md`); rerun a script to change its art.

## Environment

- client (`apps/client/.env`): `VITE_SERVER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- server (`apps/server/.env` / process env): `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REQUIRE_AUTH`
- The server verifies Google logins by calling Supabase `/auth/v1/user` (no JWT secret needed).
  Colyseus rejects a falsy `onAuth` result, so guests get a `{ guest: true }` marker.

## Networking

- Server-authoritative, 60 Hz sim; snapshots (`publicView`: no buried items, no PRNG state) at 30 Hz.
- Client sends input only on change/button press; server buffers button taps between ticks.
- Client renders other players snapshots in the past, interpolated, by an adaptive delay (`net/adaptive-delay.ts`: ~1 snapshot gap + jitter room, 40-250 ms; past the newest snapshot walking players walk on, `net/carry-on.ts`). Own player, bombs and kicks are predicted (`net/prediction.ts`, `ghost-bombs.ts`, `kick-prediction.ts`); bombs, flames, blocks and items are drawn from the latest snapshot run ahead by our input lead (`net/world-ahead.ts`), so explosions land on time.
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

Screen design (menu, lobby, results, guide, HUD, overlays) is always done for every form factor:
desktop, tablet/iPad upright and sideways, phone upright and sideways (little height). Check each
viewport in the browser (devtools emulation) before committing.

TDD: write the failing test first (`packages/shared/test`, `apps/*/test`), then minimal code,
then refactor. Atomic commits: one logical change per commit, every commit green.

Work directly on `main` (no feature branches for now) and push to `origin/main`: every push to `main`
auto-deploys both Render services (server and static client), so keep `main` green.
