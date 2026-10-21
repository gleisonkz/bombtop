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
- **Client:** Vite + PixiJS + vite-plugin-pwa. Touch d-pad (fixed cross, slide between arrows; default) or stick (appears under the thumb), switched any time from the ☰ match menu (`ui/match-menu.ts`, which also leaves the match) + gamepad + keyboard.
- **Auth/data:** Supabase (Google login; profiles/ranking todo). Optional: unset = guest-only.
- **Rooms:** public matchmaking + private rooms by code. In a room the address is `/sala/<code>` (`net/room-route.ts`): it is the invite link, a reload takes the same seat back (reconnection token in sessionStorage, `net/seat.ts`), the back button leaves. Render rewrites `/sala/*` to `index.html` (`render.yaml`); old `?sala=` links still work. The item guide lives at `/itens` the same way (`net/guide-route.ts`; also rewritten in `render.yaml`).
- **Anti-cheat:** server authority; client only sends inputs.
- **Offline (Wi-Fi) play:** "Jogar offline" in the menu. One phone hosts: `LocalHost` (`net/local-host.ts`) runs `RoomCore`
  in the browser and the host plays through a loopback `RoomLink`; friends connect by WebRTC data channel (`net/rtc-pair.ts`,
  no STUN: same Wi-Fi or a phone's hotspot) and play through `PeerLink`. No signaling server: the phones swap two QR codes
  (host's offer, friend's answer; `net/rtc-signal.ts` deflates the SDP), read with the camera (`jsqr`) or pasted as text
  (`ui/pairing.ts`). The camera is opened before the offer is made: with it on, browsers share the real LAN address instead
  of an mDNS name. `OnlineGame` plays any `RoomLink` (`net/room-link.ts`), Colyseus or local. The PWA precaches everything,
  so it opens without internet once visited.

## Layout

- `packages/shared` — game simulation + tests (Vitest)
- `apps/client` — Vite + PixiJS PWA: menu, lobby, online play.
  Title intro: once per browser session (sessionStorage `bombtop.intro`) a scripted match (`game/intro.ts`, real sim) introduces
  each character with a name card, then the logo (`game/intro-mode.ts`); skip with the button/Esc/Enter/Space, "Tocar com som" replays it with sound.
  Not shown when arriving by an invite link or on the guide.
  Inputs in `src/input` (keyboard, gamepad, touch) are pure and unit-tested; DOM/Pixi glue is not.
- `packages/shared/src/room` — room logic, pure and transport-agnostic so it also runs in a browser:
  `BattleSession` (lobby, host, match lifecycle, bots), `InputQueue` (input jitter buffer), `SnapshotStream`,
  and `RoomCore`: what each client message does and what goes back, behind a `RoomOutput` (send/broadcast).
- `apps/server` — Colyseus 0.18 server (`@colyseus/core` + ws-transport). `BattleRoom` is a thin adapter around `RoomCore`
  (integration-tested over the network).

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
| dropping on death | `items.ts` | a player who dies scatters the power-ups they carried (read off their stats; full fire comes back as fire) onto random open floor, and keeps only the starting stats |
| kick | `kick.ts` | push into a resting bomb; slides at 2x walk speed |
| remote | `bombs.ts` | action detonates oldest; normal fuse if owner dies |
| pierce | `bombs.ts` | flames run through blocks/items/bombs; walls stop them |
| punch | `air.ts` | action launches bomb in front 3 tiles; wraps edges; bounces; stuns |
| glove | `air.ts` | bomb press on own bomb lifts it, carried while the button is held (`PlayerInput.hold`), thrown when let go |
| skull | `curse.ts` | slow/fast/reverse/diarrhea/constipation/weakFire, 10s, contagious |
| egg (mounts) | `mount.ts` | **off for now** (weight 0 in `ITEM_WEIGHTS`, left out of the guide) until the mount art and rules are settled. extra hit + 2s invuln; hopper jump, dasher burst, pusher kicks |
| sudden death | `pressure.ts` | after 3 min walls fall in an inward spiral (crush ignores mounts) |
| revenge cart | `revenge.ts` | **off for now** (`createMatch` `revenge` defaults to false). dead ride the border, throw bombs; a kill swaps them back in |
| stages | `stage.ts`, `floor.ts` | classic, conveyor (belts), warp (paired teleporters). Only classic is in the rotation (`STAGES`) for now |
| Bots (easy / medium / hard) | `bot.ts` | Danger map with blast timings and chain reactions, escape-first; levels differ in reaction time, safety margin, bomb count, hunting and trapping. Server runs them (`session.ts`), host adds them in the lobby |
| specials | `special.ts` | special button (E / right Ctrl, pad Y, touch ❄). Ninja: ice blast 4 tiles straight ahead, first player hit frozen 5 s (flames still kill), 20 s recharge. Captain: shield up 3 s (planted, facing locked), 20 s recharge; fire and ice coming at the shield stop there and bounce back (the bomb's far arm burns twice as far, as the captain's fire; the blast flies back at whoever is in its way). Thor: lightning bolt 5 tiles straight ahead, first player hit stunned 3 s (a shield sends it back), 20 s recharge. Goku: Kamehameha, charges 1/3 s planted (`Player.charge`; a stun or freeze cancels it), then a beam 5 tiles straight ahead: fire through blocks (breaking them) and bombs (setting them off) up to the first player, who burns; walls stop it, a shield sends it back; 30 s recharge. Naruto: Rasengan, dashes 3 tiles straight ahead (`Player.rasengan`, 4 ticks a tile, deaf to the stick; a stun or freeze cuts it short): a wall or bomb stops him, a block in his way breaks and stops him, the first player he runs into is knocked back up to 2 tiles and stunned 2 s, a shield facing him stuns him instead; 20 s recharge. Bomb mascot: mega bomb, planted on his tile (`Bomb.mega`, drawn `MEGA_SCALE` bigger, takes none of his bomb slots), piercing, twice his fire; 25 s recharge |

Action button priority: detonate remote > punch > mount ability.

Characters (looks only): `CHARACTERS` in `packages/shared/src/state.ts` (bomb mascot, ninja, captain, thor, goku, naruto). Picked in the lobby (own seat),
saved in localStorage and sent on join; bots alternate. Both use sprite sheets (`SHEETS` in `render/sprites.ts`) in the arena and the menus (`ui/sheet-art.ts`):
ninja made in PixelLab ("Ice ninja HD4", 180px canvas like the others; frames laid out by
`scripts/build-character-sheet.py ninja`, carry walk posed from our own skeletons, lobby = a v3 hand seal; the ice cast is posed from our own skeletons with the ice drawn over it by `scripts/build-ninja-cast.py`), the bomb mascot is a bomb-headed man made in PixelLab ("Bomb man HD", same settings as Goku; its side view was redrawn with an eye and re-imported), laid out by `scripts/build-character-sheet.py bomb`, his mega bomb plant and carry walk posed from our own skeletons. Captain America (fan art) made in PixelLab too ("Captain America HD" + "Carry"), laid out by
`scripts/build-character-sheet.py captain`; his special (cast rows): shield forward, then he kneels as it grows huge
(PixelLab "Shield" state + v3 interpolation), and a spiral of light loops round him (PixelLab VFX, `scripts/build-captain-spiral.py`, `SPIRAL`).
Thor (fan art) made in PixelLab ("Thor HD", 180px canvas), laid out by `scripts/build-character-sheet.py thor`; his cast (hammer overhead,
then thrust forward) and carry walk are posed from our own skeletons; the bolt is drawn by the renderer (`boltPoints`).
PixelLab's filter blocks character states that mention a bomb (and blocked a "Carry" state of Thor outright): pose
the carry with skeletons from the base rotation instead; the renderer draws the held bomb over the head anyway.
Goku (fan art) made in PixelLab ("Goku HD", standard mode with custom chibi proportions and detailed shading to match
the others), laid out by `scripts/build-character-sheet.py goku`; Kamehameha and carry walk posed from our own skeletons
(keypoints fitted to his own rest pose: his legs are longer than Thor's); the beam is HD art from
`scripts/build-kamehameha.py` (`KAMEHAMEHA`, laid out by `kameSegments`).
Naruto (fan art) made in PixelLab ("Naruto HD", same settings as Goku), laid out by `scripts/build-character-sheet.py naruto`;
Rasengan dash and carry walk posed from our own skeletons; his idle front and side are the still rotation bobbing
(the breathing template puffed breath and shut his eyes). The Rasengan (ball in his hand, burst where it strikes) is HD
art from `scripts/build-rasengan.py` (`RASENGAN`, `rasenganLook`). The title intro seats him in a sixth seat (one more
than a match holds), pushed onto the intro's state.
PixelLab character animations always use a skeleton (`animate_character` mode `skeleton-v3` with a template,
or `animate_with_skeleton_v3` with our own keypoints when no template fits): `template` and text-only `v3`
modes redraw every frame and drop details (shield vanished, chest star on the back). The skeleton's limbs must
match the sprite's pose: a template walk on the arms-up Carry state drew extra arms, so carry walk uses our keypoints.
Sound: `audio/cues.ts` reads what changed between views; files built by `scripts/build-sfx.mjs` (sources outside the repo,
`E:/sfx-src`). Character voices (`audio/voices.ts`), every character: a line when picked in the lobby, their own death cry,
a cheer when they win, and a shout when they use their special (heard when `specialCooldown` starts; Goku and Naruto
shout inside their kamehameha/rasengan sounds instead). Sources ripped on The Sounds Resource (asset ids in `build-sfx.mjs`):
Goku from Dragon Ball FighterZ (Japanese, also his Kamehameha sound), Naruto from Ultimate Ninja Storm 2 (Japanese),
Captain America and Thor from Marvel vs. Capcom: Infinite (the captain's shout layered on his shield clang), the ninja as
Sub-Zero from Mortal Kombat (2011), the bomb mascot as White Bomber from Super Bomberman R. Downloads from that site sit
behind a Cloudflare check: fetch them through the user's own Chrome (Claude in Chrome), not curl.
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

New characters always join the title intro (`game/intro.ts`): a seat in the scene, a name card and a
moment showing their special. `test/intro.test.ts` fails if any `CHARACTERS` entry is missing. They also
get a place in the title lineup (`ui/menu.ts`).

TDD: write the failing test first (`packages/shared/test`, `apps/*/test`), then minimal code,
then refactor. Atomic commits: one logical change per commit, every commit green.

Work directly on `main` (no feature branches for now) and push to `origin/main`: every push to `main`
auto-deploys both Render services (server and static client), so keep `main` green.
