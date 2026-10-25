# Bombtop

Browser (PWA) multiplayer arena bomb game, inspired by the classic 16-bit battle mode.
Non-commercial fan project: characters may be fan art of existing franchises (e.g. Captain America).

## Decisions

- **Language:** TypeScript end-to-end, pnpm monorepo. No Rust/WASM (CPU is not the bottleneck; network is).
- **Simulation:** `packages/shared` — pure, deterministic, fixed tick (`TICK_RATE`), integer/tile math, no I/O.
  Runs authoritatively on the server (the client reuses it to predict its own player).
- **Players:** max 5 per match (`MAX_PLAYERS`), 15x13 arena: 13x11 to play in inside its walls, as in Super Bomberman 4 (`DEFAULT_WIDTH`, `DEFAULT_HEIGHT`).
- **Mode:** battle mode only (no story mode for now).
- **Mechanics:** all classic ones are in scope — bombs, fire, speed, kick, punch, glove/throw,
  remote bomb, pierce bomb, skull/virus, mounts, revenge cart, stage gimmicks.
- **Server:** Colyseus (Node), authoritative. Client interpolates snapshots (prediction: todo).
- **Client:** Vite + PixiJS + vite-plugin-pwa. Touch d-pad (fixed cross, slide between arrows; default) or stick (appears under the thumb), switched any time from the ☰ match menu (`ui/match-menu.ts`, which also leaves the match) + gamepad + keyboard.
- **Auth/data:** Supabase (Google login; profiles/ranking todo). Optional: unset = guest-only.
- **Rooms:** public matchmaking + private rooms by code. In a room the address is `/sala/<code>` (`net/room-route.ts`): it is the invite link, a reload takes the same seat back (reconnection token in sessionStorage, `net/seat.ts`), the back button leaves. Render rewrites `/sala/*` to `index.html` (`render.yaml`); old `?sala=` links still work. The item guide lives at `/itens` the same way (`net/guide-route.ts`; also rewritten in `render.yaml`), and so does the character guide at `/personagens` (`ui/character-guide.ts`: each character's story, special with tips, voice lines, every sheet animation via `characterMoves`, and their special played live in a small arena, `specialShowcase` in `game/showcase.ts`; heard through `audio/cues.ts`). A new character needs an entry there too (`test/character-guide.test.ts` fails otherwise).
- **Anti-cheat:** server authority; client only sends inputs.
- **Offline (Wi-Fi) play:** "Jogar offline" in the menu. One phone hosts: `LocalHost` (`net/local-host.ts`) runs `RoomCore`
  in the browser and the host plays through a loopback `RoomLink`; friends connect by WebRTC data channel (`net/rtc-pair.ts`,
  no STUN: same Wi-Fi or a phone's hotspot) and play through `PeerLink`. No signaling server: the phones swap two QR codes
  (host's offer, friend's answer; `net/rtc-signal.ts` deflates the SDP), read with the camera (`jsqr`) or pasted as text
  (`ui/pairing.ts`). The camera is opened before the offer is made: with it on, browsers share the real LAN address instead
  of an mDNS name. With internet the server also introduces the phones (`apps/server/src/lan.ts`, `POST /lan/<op>`; client
`net/lan.ts`): the host's room is listed (`LanBeacon`, a beat a second) to phones reaching the server from the same public
address, shown under "Salas nesta rede" in the offline dialog, and has a link `/wifi/<code>` (`wifiUrl`; its QR code is
what "Chamar amigos" shows, guests can show it too) that opens the game straight into the room. A friend knocks with its
WebRTC offer (`offerToHost`, STUN on), the host answers (`answerFriend`) and the match still runs phone to phone. The two
QR codes stay for no internet ("Sem internet?" buttons). Which way the phones' connection runs (`net/rtc-route.ts`, read off the WebRTC stats: "Wi-Fi direto" or "pela
internet") shows with ?debug and goes in the 5 s connection reports, which an offline match sends over `POST /net`. `OnlineGame` plays any `RoomLink` (`net/room-link.ts`), Colyseus or local. The PWA precaches everything,
  so it opens without internet once visited.
- **TV mode (watching):** the 📺 button next to "Entrar" in the menu watches the room of the typed code; the address
  becomes `/tv/<code>` (`net/invite.ts`; rewritten in `render.yaml`, like `/wifi/*`), so a reload watches again. The TV joins with
  `{ watch: true }`: `RoomCore.watch` gives it every broadcast but no seat (only `sync` is heard from it), up to
  `MAX_WATCHERS`, any time, even mid-match; lobbies show how many screens watch (`LobbyInfo.watchers`). For that the
  server never locks a room: one in a match or full is taken out of public matchmaking with `setPrivate` instead
  (`BattleRoom.refreshListing`), which still lets a code join.
- **Lite mode (weak screens):** on by itself in smart TV browsers (`liteOn` in `ui/dev-tools.ts`: Tizen, webOS…), with
  `?lite`, or from the menu's "Modo leve" switch (reloads). Draws at `LITE_RESOLUTION` (0.6) pixels per screen pixel, the
  screen stretching it, at 30 frames a second, with no particles and no backdrop animations or filters (`html.lite`).
- **Couch play (one screen, a controller each):** "🎮 Vários controles (mesma tela)" in the menu (shown on computers, and on
  touch screens once a controller is plugged in). The screen hosts a `LocalHost` room; the keyboard and the first controller
  are player one, and every other controller gets its own local seat (`LocalHost.seat`) through `CouchSeats`
  (`input/couch.ts`): A joins in the lobby, Y changes its character, B leaves, Start on any controller starts the match; in a
  match each sends its own input. Friends' phones can still pair in over Wi-Fi. Meant for a PC on the TV (HDMI) with
  Bluetooth controllers (the Gamepad API reads up to 4).
- **Big displays (a TV):** every screen under `#ui` grows with CSS `zoom` (`ui/ui-zoom.ts`): as far as both 1440 px of
  width and 820 px of height (the menu's tallest layout) allow, never below 1 (phones, tablets and laptops unchanged), at
  most 2x; 1.32x on a 1920x1080 TV. The arena canvas is outside `#ui` and fitted on its own. Media queries still see the
  real viewport, so the big-screen layouts apply and are then scaled.
- **Menus with a controller:** the first controller walks every screen under `#ui` (menu, guides, lobby, pairing, results):
  d-pad or stick moves a ring (`.pad-focus`) to the nearest button that way (`ui/spatial-focus.ts`), A presses it, B presses
  the screen's way back (`backButton` in `ui/dom.ts`, `data-pad-back`), L1/R1 press the `data-pad-prev`/`data-pad-next`
  arrows of the card the ring is on (a seat's character picker), or of your own seat (`.me`) when the ring is elsewhere.
  The host steps their bots' characters the same way (arrows on bot seats, `C2S.botCharacter`, `setBotCharacter`: the bot
  takes a name of its new character). A redrawn screen (the lobby rebuilds its seats) gets the ring back at the same place.
  `ui/pad-menus.ts` polls `input/pad-nav.ts` each frame:
  a held direction repeats after 400 ms then every 150 ms, A/B share a 300 ms cooldown (no double join, bouncing contacts on
  cheap pads), and a press already down when a screen comes up is ignored. With nothing shown under `#ui` (a match) it does
  nothing. In dev, `window.__padMenus.tick(now)` drives it by hand (automated tabs run rAF at ~2 fps). Played on the TV by
  streaming this PC with Sunshine + Moonlight (the controller paired to the TV reaches Chrome as an Xbox 360 pad via ViGEmBus).

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
- `pnpm -C packages/shared bench [filter]` — server tick benchmark: seeded matches with 1/2/4 bots per level and a field full
  of chaining bombs, mean/p95/p99/max per tick and the bots' share; exits non-zero when a p99 passes a quarter of a tick.
  Run it before and after touching `bot.ts` or the sim. `test/bot-replay.test.ts` fingerprints seeded bot matches tick by
  tick: a speed-up must leave them unchanged (update them only when behavior is meant to change).
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
| burning blocks | `bombs.ts` | a block caught by fire, or broken by a special (Kamehameha, Rasengan), stays solid, burning, while its flame lasts (`Flame.block`) and is gone with it: nobody walks into a fire that is still burning where a block was. Drawn as 6 frames burning away (`burnCell`, `build-tiles.py`) |
| dropping on death | `items.ts` | a player who dies scatters the power-ups they carried (read off their stats; full fire comes back as fire) onto random open floor, and keeps only the starting stats |
| kick | `kick.ts` | push into a resting bomb; slides at 2x walk speed |
| remote | `bombs.ts` | action detonates oldest; normal fuse if owner dies |
| pierce | `bombs.ts` | flames run through blocks/items/bombs; walls stop them |
| punch | `air.ts` | action launches bomb in front 3 tiles; past an edge it comes down on the first tile across (as in Super Bomberman 4); bounces off taken tiles; its fuse waits while it flies (never goes off in the air); stuns whoever it lands on, unless they carry a bomb (it bounces on) |
| glove | `air.ts` | bomb press on own bomb lifts it, carried while the button is held (`PlayerInput.hold`), thrown when let go; its fuse waits while it is carried (never goes off in the hands, as in Super Bomberman 4) |
| skull | `curse.ts` | slow/fast/reverse/diarrhea/constipation/weakFire. It never wears off by itself (as in Super Bomberman 3/4): passed on by touch: whoever touches a cursed player takes it off them (`Curse.from`: not straight back until they part). Picking up any other item cures it |
| egg (mounts) | `mount.ts` | **off for now** (weight 0 in `ITEM_WEIGHTS`, left out of the guide) until the mount art and rules are settled. extra hit + 2s invuln; hopper jump, dasher burst, pusher kicks |
| sudden death | `pressure.ts` | after 3 min (`MatchState.pressureAt`; 30 s after the last human is out, `BOTS_ONLY_HURRY`) walls fall in an inward spiral (crush ignores mounts; whoever stands inside any fallen wall is crushed, and a wall falling on a burning block takes its flame) |
| revenge cart | `revenge.ts` | **off for now** (`createMatch` `revenge` defaults to false). dead ride the border, throw bombs; a kill swaps them back in |
| stages | `stage.ts`, `floor.ts` | classic, conveyor (belts), warp (paired teleporters). Only classic is in the rotation (`STAGES`) for now |
| Bots (easy / medium / hard) | `bot.ts` | Danger map with blast timings and chain reactions, escape-first; levels differ in reaction time, safety margin, bomb count, hunting and trapping. They warm up as a match drags on (`botHeat`, from 45 s, a step every 30 s) and go all out once no human is left: every bot hunts, cares less for power-ups, thinks faster, keeps more bombs out and sets traps (never less careful of its own bombs). Server runs them (`session.ts`), host adds them in the lobby |
| specials | `special.ts` | special button (E / right Ctrl, pad Y, touch ⚡). Captain: shield up 3 s (planted, facing locked), 20 s recharge; fire and specials coming at the shield stop there and bounce back (the bomb's far arm burns twice as far, as the captain's fire; the blast flies back at whoever is in its way). Thor: lightning bolt 5 tiles straight ahead, first player hit stunned 3 s (a shield sends it back), 20 s recharge. Every special stun lasts the same 3 s (`SPECIAL_STUN_TICKS`); a bomb landing on a player stuns 1 s (`STUN_TICKS`). Goku: Kamehameha, charges 1/3 s planted (`Player.charge`; a stun cancels it), then a beam 5 tiles straight ahead: through blocks (breaking them) up to the first player, who is stunned 3 s; bombs are left alone, walls stop it, a shield sends it back; 30 s recharge. Naruto: Rasengan, dashes 3 tiles straight ahead (`Player.rasengan`, 4 ticks a tile, deaf to the stick; a stun cuts it short): a wall or bomb stops him, a block in his way breaks and stops him, the first player he runs into is knocked back up to 2 tiles and stunned 3 s, a shield facing him stuns him instead; 20 s recharge. Spider: web shot 5 tiles straight ahead, first player hit wrapped up 4 s (`Player.webbed`: no moving or bombs, flames still kill; a shield sends it back), 20 s recharge. Pikachu: thunder shock all around him, every player on his tile and up to 2 tiles away in the four directions stunned 3 s (walls, blocks and bombs stop an arm; a shield facing him stops its arm and stuns him instead), 20 s recharge. Static: magnet pull 5 tiles straight ahead, the first player hit is dragged to the tile next to him and stunned 3 s (walls, blocks and bombs stop it; a shield sends it back, dragging him to the captain), 20 s recharge. Flash: super speed, dashes up to 5 tiles straight ahead in a blink, through every player in his way (each stunned 3 s), stopping short of walls, blocks and bombs and on the last tile nobody stands on (a shield facing him stops him in front of it, stunned instead); 20 s recharge. Bugs: tunnel, digs in and comes out on the farthest open tile up to 5 tiles straight ahead, under walls, blocks, bombs and players (never into a flame, on a bomb or on a player, nor out of the arena; with nowhere to come out he stays and keeps his special; a shield cannot stop him); 20 s recharge. Green lantern: bubble, 3 s (`Player.bubble`) in which no fire gets to him from any side, not even his own bomb's under him (other specials still do), moving at half speed (`effectiveSpeed`); 25 s recharge. Donatello: bo staff spin, every player on his tile and the four next to him stunned 3 s and every bomb next to him batted 3 tiles away the way it was hit, as a punch (a shield facing him stops its side and stuns him instead); 20 s recharge. Penelope: blown kiss, a heart 5 tiles straight ahead, the first player hit charmed 3 s (`Player.charmed`, drawn as hearts round their head; the stun holds them; a shield sends it back), 20 s recharge. Pink panther: tiptoe, 4 s out of sight (`Player.sneak`): gone from his rivals' screens, faint on his own and on screens that only watch (`sneakAlpha`, `Renderer.setViewer`), a pink puff where he slipped away; bots neither hunt him nor count him in a bomb's reach; he walks as fast as ever and flames still catch him; 20 s recharge. Harry: expecto patronum, his silver stag gallops straight ahead until a wall or block (`PATRONUS_TICKS_PER_TILE` ticks a tile, leaping over bombs) and stuns each player as it reaches them, 3 s (not only the first; `updateBlasts`); a shield facing it stops it there; its blast lasts as long as the run and a fade (`blastLife`); 25 s recharge. Optimus: roll out, he turns into his truck where he stands (`TRUCK_SHIFT`, `Player.truck`; a stun cuts it short), then drives up to 6 tiles straight ahead (`TRUCK_TICKS_PER_TILE` ticks a tile, deaf to the stick, `updateTruck`): whoever is in front is shoved along by the bumper, stunned 3 s (pinned against a wall, block, bomb or player, they stop him), a bomb is rammed off sliding, a block crushed (burns away), a wall stops him, a shield facing him stops him, stunned; 25 s recharge. Pelé: his kick, a ball 7 tiles straight ahead (`BALL_RANGE`), the first player hit knocked down, stunned 3 s; a bomb in its way is kicked off sliding (the ball stops there); walls and blocks stop it, a shield sends it back; 20 s recharge. Bomb mascot: mega bomb, planted on his tile (`Bomb.mega`, drawn `MEGA_SCALE` bigger, takes none of his bomb slots), piercing, twice his fire; 25 s recharge |

Action button priority: detonate remote > punch > mount ability.

Characters (looks only): `CHARACTERS` in `packages/shared/src/state.ts` (bomb mascot, captain, thor, goku, naruto, spider, pikachu, static, flash, bugs, lantern, donatello, penelope, panther, harry, optimus, pele). Picked in the lobby (own seat),
saved in localStorage and sent on join; bots alternate. All use sprite sheets (`SHEETS` in `render/sprites.ts`) in the arena and the menus (`ui/sheet-art.ts`):
the bomb mascot is our own art, drawn in code by `scripts/build-bomber.py` (no PixelLab): a serious demolition trooper with an iron bomb for a head (visor slits glowing across a riveted band, lit fuse), a V-shaped body with a chest plate bearing a bomb emblem, shoulder pads and boot cuffs in the player's color, a rust scarf; in the menus he tosses a mini bomb and catches it. The script is a 3D puppet (two-bone IK for arms and legs, one pose gives the front, side and back views) drawn the way the PixelLab sheets look: flat shading bands, dark outlines, each sheet pixel the most common color of its supersampled block (no blending), at the others' pixel density. Edit a pose function there and rerun it (~5 min) to change an animation. Captain America (fan art) made in PixelLab too ("Captain America HD" + "Carry"), laid out by
`scripts/build-character-sheet.py captain`, then `scripts/lock-walk-head.py captain` (the templates redrew his head every frame, standing and walking, so one clean head is pasted over each idle and walk row (front and side), moving only with the body); his special (cast rows): shield forward, then he kneels as it grows huge
(PixelLab "Shield" state + v3 interpolation), and a spiral of light loops round him (PixelLab VFX, `scripts/build-captain-spiral.py`, `SPIRAL`).
Thor (fan art) made in PixelLab ("Thor HD", 180px canvas), laid out by `scripts/build-character-sheet.py thor`; his cast (hammer overhead,
then thrust forward) and carry walk are posed from our own skeletons; the bolt is drawn by the renderer (`boltPoints`).
His lobby (and the title lineup's "walk"): Mjolnir raised to the sky, a bolt comes down onto it, he crackles with it,
then slams it into the ground (a flash, a shockwave, lightning running along the ground, dust and stones); poses from
our own skeletons (the slam from a second try: the first tore his cape; PixelLab smeared the struck hammer's head, so
the head from his rest frame is put in its place), the effects drawn by `scripts/build-thor-lobby.py`.
PixelLab's filter blocks character states that mention a bomb (and blocked a "Carry" state of Thor outright): pose
the carry with skeletons from the base rotation instead; the renderer draws the held bomb over the head anyway.
Goku (fan art) made in PixelLab ("Goku HD", standard mode with custom chibi proportions and detailed shading to match
the others), laid out by `scripts/build-character-sheet.py goku`; Kamehameha and carry walk posed from our own skeletons
(keypoints fitted to his own rest pose: his legs are longer than Thor's); the beam is HD art from
`scripts/build-kamehameha.py` (`KAMEHAMEHA`, laid out by `kameSegments`). His lobby (and the title lineup's "walk") is a
showpiece: fists clenched, he powers up in white ki with pebbles lifting, screams through a flash into Super Saiyan
(golden hair, a golden flame aura crackling with lightning), takes his fighting stance and powers down; poses from our
own skeletons, the gold, aura and lightning drawn over them by `scripts/build-goku-lobby.py`. A 16-frame showpiece
with effects round the hero lives in its own image (`<name>-lobby.png`, `scripts/build-lobby-image.py <name> FRAMES_DIR`,
`SheetLayout.lobby.image`), not in the sheet: its bigger cells would widen every cell and add columns to every row, and
each menu preview paints its whole sheet in the player's color (the title ran out of image memory and dropped previews).
Only the menus play it (`previewPose`, `characterMoves`). Flash's and Static's lobbies are still sheet rows.
Naruto (fan art) made in PixelLab ("Naruto HD", same settings as Goku), laid out by `scripts/build-character-sheet.py naruto`;
Rasengan dash and carry walk posed from our own skeletons; his idle front and side are the still rotation bobbing
(the breathing template puffed breath and shut his eyes). The Rasengan (ball in his hand, burst where it strikes) is HD
art from `scripts/build-rasengan.py` (`RASENGAN`, `rasenganLook`). The title intro seats him in a sixth seat (one more
than a match holds), pushed onto the intro's state. His lobby (and the title lineup's "walk"): Shadow Clone Jutsu, a
hand seal with chakra swirling, two puffs of smoke clearing on two clones beside him, the three striking poses, the
clones gone in smoke; poses from our own skeletons, the clones, smoke and chakra placed and drawn by
`scripts/build-naruto-lobby.py` (in `naruto-lobby.png`, its cells wide enough for the clones).
Spider-Man (fan art) made in PixelLab ("Spider-Man HD", Naruto's settings with a big chibi head per `concept/PROMPT-BASE.md`:
custom proportions head 1.8), laid out by `scripts/build-character-sheet.py spider`; web shot and carry walk posed from our
own skeletons (his short arms only reach the sides of his head when carrying). The web (strand, splat, cocoon round
whoever it wraps up) is drawn by the renderer (`drawWeb`, `cocoon`, `webbedLook`). The intro seats him in the third seat,
which is red. PixelLab's Pro image model refuses franchise characters (concept art); `create_character` does not.
His lobby (and the title lineup's "walk"): he shoots a web up out of the card, is yanked up after it, swings back in on
it and lands in his three-point crouch in a puff of dust; poses from our own skeletons (the web splats PixelLab drew at
his hands taken out), lifted, swung and given their web lines by `scripts/build-spider-lobby.py`.
Pikachu (fan art) made in PixelLab: "Pikachu HD" (standard mode) drew a good front but a side view mixing his back into a
side head, so "Pikachu HD v3" rotates that front (`create_character` mode `v3` with the front as reference) for the side and
back rows; laid out by `scripts/build-character-sheet.py pikachu`. Thunder shock and carry walk posed from our own skeletons;
idle side and back are his rotation bobbing (the breathing template puffed breath and shut his eye). His blue scarf takes the
player's color. The shock (bolts out to each arm's end, a ring of light round him) is drawn by the renderer (`drawThunder`).
The intro seats him in a seventh seat, in blue (`Intro.colors`); the title lineup has him at the mascot's feet (`.cast .front`).
Static / Super Choque (fan art) made in PixelLab: "Static Shock HD 2" (standard mode; short locs, goggles, long blue coat with
yellow lining, which takes the player's color) drew his front again for the back, so "Static Shock HD v3" rotates its front
and sides (`direction_images`) for the back row; laid out by `scripts/build-character-sheet.py static`. Magnet pull, carry walk
and lobby posed from our own skeletons. His lobby (and the title lineup's "walk") is the showpiece: he charges sparks between
his hands, jumps onto his flying manhole cover and surfs on it crackling, drawn over his poses by
`scripts/build-static-lobby.py`. The pull (violet arcs, rings of force running back to him) is drawn by the renderer
(`drawMagnet`, `magnetWaves`). The intro seats him in an eighth seat, in blue, pulling Pikachu; in the title lineup he hovers at
the mascot's other side (`.cast .front.left`).
The Flash (fan art) made in PixelLab ("Flash HD", standard mode; classic red suit, yellow boots and ear wings; the suit takes
the player's color), laid out by `scripts/build-character-sheet.py flash`. The dash is instant, so his cast rows are a skid
stop; skid, carry walk and lobby posed from our own skeletons (PixelLab turned his back views to face us: ask for "seen from
behind, back view" in the skeleton description). His lobby (and the title lineup's "walk"): crackling with the Speed Force he
vanishes in a flash, streaks across the card and back with afterimages and speed lines, skids in and gives a thumbs up
(`scripts/build-flash-lobby.py`). The dash is drawn by the renderer as speed lines with a bolt (`drawSpeed`, `speedLines`).
The intro seats him in a ninth seat, in red, zipping through Naruto, the mascot and Thor in row 3; the title lineup has him at
the far left.
Bugs Bunny / Pernalonga (fan art) made in PixelLab: "Bugs Bunny HD" (standard mode; blue scarf, which takes the player's color)
drew his front again for the side and back, so "Bugs Bunny HD v3" rotates that front for the side and back rows; laid out by
`scripts/build-character-sheet.py bugs`. Idle is his rotation bobbing (the breathing template shut his eyes); the dig is
instant, so his cast rows are him popping out (squashed low, arms flung up, a hand over his brow), posed from our own
skeletons like the carry walk; lobby (and the title lineup) a v3 animation munching a carrot. The tunnel (holes at both ends,
a ridge of dirt mounds, clods flying) is drawn by the renderer (`drawTunnel`, `tunnelMounds`). The intro seats him in a
tenth seat, in blue, digging along row 4 under two pillars; the title lineup has him at the far right.
The Green Lantern / Lanterna Verde (fan art) is John Stewart, made in PixelLab: "John Stewart HD 2" (standard mode: dark
brown skin, short black hair, green and black suit; the green takes the player's color) drew him smiling with white eyes,
so its front and side were repainted (glowing green eyes, a closed serious mouth) and imported as "John Stewart HD v3"
(`create_character` v3 with every direction given: nothing generated), which every animation is posed on; laid out by
`scripts/build-character-sheet.py lantern`. His cast (down on one knee, the ring fist thrust high) is held while he stands
in his bubble (`bracing`, like the captain behind his shield; walking in it, he walks); it and the carry walk are posed
from our own skeletons (PixelLab kept turning him to face us as he knelt, so the back view is a v3 animation asked "seen from behind");
lobby a v3 animation. Every frame gets his eyes white with an emerald iris and loses PixelLab's gray blots in the sheet
script (`green_iris`, `no_blots`). The bubble is its own HD art, `scripts/build-lantern-bubble.py`
(`BUBBLE`, `bubbleLook`): it forms (sparks rushing in, a ring swelling out), is held (fresnel rim, a honeycomb drifting over
the sphere, ripples round its edge, a white shine, sparkles; flickering in its last second) and gives way (a crack into
shards), drawn additively over him. The intro seats him in an eleventh seat, in green, sitting out his own bomb's fire in row
6; the title lineup has him at the far left.
Donatello (fan art) made in PixelLab ("Donatello HD", standard mode; purple bandana and pads, which take the player's color,
a bo staff in hand), laid out by `scripts/build-character-sheet.py donatello`. Idle is his rotation bobbing (the breathing
template opened his mouth and puffed breath); the staff spin (both hands on the bo swept round him) and carry walk are posed
from our own skeletons; lobby a v3 animation twirling the staff overhead, planting it and grinning. The whirl (the bo turning
round him twice with a blur, a whoosh ring) is drawn by the renderer (`drawSpin`, `spinLook`). The intro seats him in a
twelfth seat, batting his own bomb down the column and leaving optimus dizzy in row 5; the title lineup has him at the far
right (the lineup's edges hide below 740 px wide).
Penelope Pitstop / Penélope Charmosa (fan art) made in PixelLab ("Penelope HD 2", standard mode: a round pink racing
helmet with big goggles, blonde ponytail, pink suit; the pink of helmet and suit takes the player's color). Its side views
were drawn facing left, so the sheet script mirrors them (her own skeletons for the side are posed as west); idle front is
her rotation bobbing (the breathing template shut her eyes). The kiss and carry walk are posed from our own skeletons; the
heart (flying out, bursting into little ones) and the charm (hearts going round a victim's head) are drawn by the renderer
(`kissHearts`, `charmHearts`). Her lobby: a touch-up in her compact mirror (a glint), powder dabbed on (a puff of it), a
fluff of her ponytail (sparkles), a kiss blown at us (hearts floating up), `scripts/build-penelope-lobby.py`. She is the
first with a victory of her own (`SheetLayout.victory`, its own image; the results' champion plays it, the guide shows it
apart from the lobby): a jump for joy, then a checkered flag waved over her head, a foot kicked up, hearts floating up
(`scripts/build-penelope-victory.py`; PixelLab drew a flag of its own that changed every frame, so her hand is left empty
and the flag drawn in). Others fall back to their lobby pose. The intro seats her in a thirteenth seat, blowing the captain
a kiss down row 5 (a bomb landing out of the frame is dropped); the title lineup has her at the far left.
The Pink Panther / Pantera Cor-de-Rosa (fan art) made in PixelLab: the first tries drew a generic cute cat, so "Pink Panther
HD 4" was described from the cartoon's own face (big round yellow eyes with black pupils, black brows, a dark pink
triangle nose, a light pink muzzle and belly, small round ears; standard mode, a blue scarf added, which takes the player's
color), laid out by `scripts/build-character-sheet.py panther`. Idle is his rotation bobbing (the breathing template opened
his mouth and puffed breath); PixelLab drew a floor shadow under him, taken out in the sheet script (`no_floor_shadow`).
His cast rows are the classic tiptoe (up on his toes, paws before his chest), posed from our own skeletons like the carry
walk (the back views asked "seen from behind": they turned to face us), walked through while he sneaks (`playerFrame`'s
`sneaking`). His lobby: he tiptoes in from the left, turns to us and goes "shh" with a sly look (`scripts/build-panther-lobby.py`).
The intro seats him in a fourteenth seat, in blue, tiptoeing out of sight into row 7 to leave a bomb between goku and the
spider; the title lineup has him at the far right.
Harry Potter (fan art) made in PixelLab: the standard-mode tries came out with their directions mixed up, one of them a
good front holding the wand like a staff; that front had the wand cut short and the lightning scar painted on by script and
was rotated into "Harry Potter HD v3b" (`create_character` v3 with it as reference), which every animation is posed on;
laid out by `scripts/build-character-sheet.py harry`. The red lining of his robe takes the player's color (narrow hues,
so his blush and scar stay; his wand shares the lining's palette and goes with it). Idle is his rotation bobbing (the
breathing template puffed breath); his cast (the wand swung up, then thrust out) and carry walk are posed from our own
skeletons (the back views asked "seen from behind"). The stag is its own PixelLab art, 8 gallop frames seen from the side, the front
and the back (`scripts/build-patronus.py`, `PATRONUS`), drawn additively galloping the way he cast it to where it stopped,
sparkles trailing, heard as `gallop` (hooves under a shimmer) (`patronusLook`). His lobby: the wand's tip lit and swirled
overhead in a trail of light (our own skeletons), thrust out in a burst of mist, and the stag galloping once round him;
his victory: a jump and the golden snitch
snatched out of the air, its wings fluttering out of his fist (both `scripts/build-harry-lobby.py`). The intro seats him
in a fifteenth seat, in red, sending the stag along row 3 through naruto and the flash (36 s now); the title lineup has
him at the far left.
Optimus Prime (fan art) made in PixelLab ("Optimus Prime HD", standard mode: the classic red and blue robot, blue helmet
with its fins, silver faceplate, red chest with its truck windows; the blue takes the player's color, red and white
players keep his own), laid out by `scripts/build-character-sheet.py optimus`. His cast rows are PixelLab's crouching
template down and back up (`OPTIMUS_CAST`): the first cells while he turns into the truck, the rest as he turns back where
it stopped; the carry walk is posed from our own skeletons (the back view asked "seen from behind"). The truck is its own
art: three PixelLab images, a flat side profile (the first try was a 3/4 view that looked like it drove diagonally), its
front and its back, with the side's wheels turned a step a frame by `scripts/build-truck.py` (`TRUCK`, `truckLook`); it
stands in for him while he drives (`drawTruck`: a blue glow as he turns, plates and sparks bursting each way, exhaust and
speed lines; `Fx.transform`), heard as `transform` (the cartoon's sound) and `truck` (an engine roaring off). His lobby:
his eyes flare, he bursts into the truck, which drives off the card and brakes back in, and he rises with his fist high,
the Matrix shining in his chest (`scripts/build-optimus-lobby.py`). The intro seats him in a sixteenth seat, in blue, standing in row 5 from the start,
shoving the captain down it until he is pinned against penelope (39 s now); the title lineup has him at the far right.
Pelé (fan art) made in PixelLab ("Pele HD", standard mode, the 1970 Brazil kit: yellow jersey with a green collar and
cuffs, blue shorts, which take the player's color, white socks, black cleats), laid out by
`scripts/build-character-sheet.py pele`; idle front is his rotation bobbing (the breathing template shut his eyes). His
kick and carry walk are posed from our own skeletons; the kick was asked "at empty air" (the first try drew a ball of its
own, and the ball is the renderer's: `BALL`, `ballLook`, a PixelLab image cleared of its shadow by `scripts/build-ball.py`,
flying in an arc, spinning, rebounding off what stopped it), heard as `kickball` (Freesound, CC0). His lobby: keepy-uppy,
the ball sent up out of the card, and his jump punching the air in green and yellow confetti (`scripts/build-pele-lobby.py`).
The intro seats him in a seventeenth seat, in blue, kicking his ball down row 7 into the spider (42 s now); the title
lineup has him at the far left.
PixelLab character animations always use a skeleton (`animate_character` mode `skeleton-v3` with a template,
or `animate_with_skeleton_v3` with our own keypoints when no template fits): `template` and text-only `v3`
modes redraw every frame and drop details (shield vanished, chest star on the back). The skeleton's limbs must
match the sprite's pose: a template walk on the arms-up Carry state drew extra arms, so carry walk uses our keypoints.
Sound: `audio/cues.ts` reads what changed between views; files built by `scripts/build-sfx.mjs` (sources outside the repo,
`E:/sfx-src`). Character voices (`audio/voices.ts`), every character: a line when picked in the lobby, their own death cry,
a cheer when they win, and a shout when they use their special (heard when `specialCooldown` starts; Goku and Naruto
shout inside their kamehameha/rasengan sounds instead). Sources ripped on The Sounds Resource (asset ids in `build-sfx.mjs`):
Goku from Dragon Ball FighterZ (Japanese, also his Kamehameha sound), Naruto from Ultimate Ninja Storm 2 (Japanese),
Captain America, Thor and Spider-Man from Marvel vs. Capcom: Infinite (the captain's shout layered on his shield clang; the
spider's web sounds too), Pikachu from Super Smash Bros. Ultimate (Japanese, also his Thunder for the shock), the bomb mascot as White Bomber from Super Bomberman R. Static has no game voice there:
his lines (Phil LaMarr) are cut from cartoon scenes on 101soundboards.com (board "Static Shock (TV Show)"), and his
special is heard as the magnet's crackle (`magnet`). The flash's lines are Injustice 2's (board "Injustice 2 (PC): The
Flash Voice" on the same site; the board's titles can be off by one, so transcribe a clip before using it). Bugs' lines (Jeff Bergman) are from Looney Tunes Dash! (board "Bugs Bunny - Looney
Tunes Dash! - Character Voices (Mobile)"), his tunnel heard as `dig`. The green lantern's are John Stewart's from Injustice 2 (board "Injustice 2 (PC): John Stewart
Voice"), his bubble heard as `bubble` rising and `pop` giving way. Donatello's are from Teenage Mutant Ninja Turtles: Shredder's Revenge
(board "Teenage Mutant Ninja Turtles: Shredder's Revenge (PC): Donatello Voice"), his spin heard as `spin`. Penelope's are from Wacky Races (PC) (board "Wacky Races (PC): Penelope Pitstop Voice"), her kiss
heard as `kiss` (a cartoon smooch from Freesound, CC0). The pink panther hardly ever speaks: he is heard through Henry
Mancini's theme (its saxophone when picked, its last flourish when he wins, its creeping bass as he tiptoes off) and his
one line from the cartoon "Pink Ice" when he dies, all from 101soundboards.com. Harry's lines are Daniel Radcliffe's from
the films ("I solemnly swear that I'm up to no good", "Expecto Patronum!", "Mischief managed"), his cry from Harry Potter
and the Deathly Hallows Part 2 (PC), all from 101soundboards.com. Optimus's are Peter Cullen's from the films ("I am
Optimus Prime", "Autobots, roll out!", "Till all are one") on the same site, which tags the start of its board clips
(cut off with `from`). Pelé left no game voice there: he is heard through Galvão Bueno's commentary on the same site
("O homem é gênio, é uma fera, é uma lenda do esporte!", "Olha o gol!", "É tetra!", "Ai, ai, ai"). Downloads from that site sit
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
- Client sends input only on change/button press; server buffers button taps between ticks. While quiet in a match it sends
  a `beat` every 50 ms (`net/keep-awake.ts`): a phone that only listens lets its Wi-Fi doze, and the ?debug logs showed
  Android phones getting the 30 Hz snapshots in bursts 150-600 ms apart with a 10 ms ping, pinning the render delay at 250 ms.
- In the arena the human players' names float over their heads (`render/name-tags.ts`, `Renderer.setNames`: ours in
  yellow, bots untagged, hidden with a sneaking rival).
- Client renders other players snapshots in the past, interpolated, by an adaptive delay (`net/adaptive-delay.ts`: ~1 snapshot gap + jitter room, 40-250 ms; past the newest snapshot walking players walk on, `net/carry-on.ts`). Own player, bombs and kicks are predicted (`net/prediction.ts`, `ghost-bombs.ts`, `kick-prediction.ts`); bombs, flames, blocks and items are drawn from the latest snapshot run ahead by our input lead (`net/world-ahead.ts`), so explosions land on time.
- Clocks, one contract per mode: a client's own frame loop (`loop/fixed-step.ts`) runs at most 5 ticks a frame and drops
  the rest (only its local view slows); the offline host (`loop/tick-clock.ts`) is authoritative for every phone, so it
  plays every owed tick, a few per call (no long freeze), dropping time past 500 ms; the server ticks on Colyseus' interval.
- Front-end monitoring (`deploy/vps/README.md`): every player's match reports its connection to the server's log every
  5 s (`net-<date>.jsonl`), and every page reports opening, crashing (found on the next opening: `net/client-log.ts`
  `AliveMark`) and script errors over `POST /log` (`client-<date>.jsonl`).
- Telling a lag's cause apart: the connection reports (see `deploy/vps/README.md`) carry snapshot gaps, stalled frames, our own
  CPU time per frame (`work`) and the server's slowest tick (`tick`). Measured (Oct 2026): a server tick with 4 hard bots
  costs ~0.2 ms p99 of its 16.67 ms, so bots are not a lag source; look at the network and the phone first.
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

A new character follows `concept/CHARACTER-RECIPE.md` (the tested steps: PixelLab settings and animations, sheet, code, sound,
screens) with its look described per `concept/PROMPT-BASE.md`.

New characters always join the title intro (`game/intro.ts`): a seat in the scene, a name card and a
moment showing their special. `test/intro.test.ts` fails if any `CHARACTERS` entry is missing. They also
get a place in the title lineup (`ui/menu.ts`).

TDD: write the failing test first (`packages/shared/test`, `apps/*/test`), then minimal code,
then refactor. Atomic commits: one logical change per commit, every commit green.

Work directly on `main` (no feature branches for now) and push to `origin/main`: every push to `main`
auto-deploys both Render services (server and static client), so keep `main` green.
