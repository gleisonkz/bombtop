# Sprite licenses

Trial character sheets. Both are CC0 (public domain, no attribution required).

- `foozle-legend.png` — "Legend - Main Character" by Foozle (commissioned from Atari Boy),
  https://foozlecc.itch.io/legend-main-character — CC0 1.0
- `james.png` — "Pixel Character 02 - James", https://opengameart.org/content/pixel-character-02-james — CC0 1.0
- `ninja.png` — the project's own character, made in PixelLab (pixellab.ai) for Bombtop;
  rows: idle S/E/N, walk S/E/N (6 frames), hit (6), death (7), ice-blast cast S/E/N (9); 64px cells.
  `ninja-hd.png` is the same sheet smoothed to 2x (128px cells) by `scripts/upscale-pixel-art.py`.

## ninja.png

The project's own character, made in PixelLab (pixellab.ai) for Bombtop (character "Ice ninja HD4", 180px canvas,
like the others; carry walk and ice cast posed from our own skeletons). Frames laid out by `scripts/build-character-sheet.py ninja`; rows = `SHEETS.ninja`. Ice cast: skeleton-posed body plus ice effects drawn by `scripts/build-ninja-cast.py`.

## captain.png

Fan art of Captain America (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Captain America HD" and its "Carry" state). Frames laid out by
`scripts/build-character-sheet.py captain`; rows = `SHEETS.captain`.

## thor.png

Fan art of Thor (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Thor HD"; cast, carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's
lightning, shockwave, dust and the struck hammer's head are drawn by `scripts/build-thor-lobby.py`. Frames laid out by
`scripts/build-character-sheet.py thor`, rows = `SHEETS.thor`. The lobby is its own image, `thor-lobby.png`, laid out by `scripts/build-lobby-image.py thor`.

## goku.png

Fan art of Goku (Dragon Ball) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Goku HD"; Kamehameha, carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's
golden hair, aura, lightning, pebbles and flash are drawn by `scripts/build-goku-lobby.py`. Frames laid out by
`scripts/build-character-sheet.py goku`, rows = `SHEETS.goku`. The lobby is its own image, `goku-lobby.png`, laid out by `scripts/build-lobby-image.py goku`.

## naruto.png

Fan art of Naruto (Naruto) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Naruto HD"; Rasengan dash, carry walk and the lobby poses posed with skeleton v3 from its rotations). The
lobby's clones, smoke and chakra are drawn by `scripts/build-naruto-lobby.py`. Frames laid out by
`scripts/build-character-sheet.py naruto`, rows = `SHEETS.naruto`. The lobby is its own image, `naruto-lobby.png`, laid out by `scripts/build-lobby-image.py naruto`.

## spider.png

Fan art of Spider-Man (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Spider-Man HD"; web shot, carry walk and the lobby poses posed with skeleton v3 from its rotations). The
lobby's web lines and dust are drawn by `scripts/build-spider-lobby.py`. Frames laid out by
`scripts/build-character-sheet.py spider`, rows = `SHEETS.spider`. The lobby is its own image, `spider-lobby.png`, laid out by `scripts/build-lobby-image.py spider`.

## pikachu.png

Fan art of Pikachu (Pokémon, Nintendo / The Pokémon Company) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Pikachu HD" for the front rows and "Pikachu HD v3", a v3 rotation of its front, for the side and back; thunder
shock and carry walk posed with skeleton v3 from their rotations). Frames laid out by
`scripts/build-character-sheet.py pikachu`; rows = `SHEETS.pikachu`.

## static.png

Fan art of Static (Static Shock, DC / Milestone) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Static Shock HD 2" and "Static Shock HD v3", a v3 rotation of its front and sides for the back; magnet pull,
carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's flying disc, its glow, shadow and
sparks are drawn by `scripts/build-static-lobby.py`. Frames laid out by `scripts/build-character-sheet.py static`;
rows = `SHEETS.static`.

## flash.png

Fan art of the Flash (DC) for this non-commercial project, made in PixelLab (pixellab.ai) (character "Flash HD"; skid
stop, carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's afterimages, speed lines,
bolts and dust are drawn by `scripts/build-flash-lobby.py`. Frames laid out by `scripts/build-character-sheet.py flash`;
rows = `SHEETS.flash`.

## bugs.png

Fan art of Bugs Bunny (Looney Tunes, Warner Bros.) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Bugs Bunny HD" and "Bugs Bunny HD v3", a v3 rotation of its front for the side and back; popping out of his
tunnel and carry walk posed with skeleton v3 from its rotations; the lobby's carrot is a v3 animation). Frames laid out by
`scripts/build-character-sheet.py bugs`; rows = `SHEETS.bugs`.

## lantern.png

Fan art of the Green Lantern John Stewart (DC) for this non-commercial project, made in PixelLab (pixellab.ai) (character
"John Stewart HD 2", its face repainted with glowing green eyes and a serious mouth and imported as "John Stewart HD v3";
the ring cast and carry walk posed with skeleton v3 from its rotations). Frames laid out by
`scripts/build-character-sheet.py lantern`; rows = `SHEETS.lantern`.

## donatello.png

Fan art of Donatello (Teenage Mutant Ninja Turtles, Paramount / Nickelodeon) for this non-commercial project, made in
PixelLab (pixellab.ai) (character "Donatello HD"; his bo staff spin and carry walk posed from our own skeletons, a lobby
twirling the staff); laid out by `scripts/build-character-sheet.py donatello`; rows = `SHEETS.donatello`.

## penelope.png, penelope-lobby.png, penelope-victory.png

Fan art of Penelope Pitstop (Wacky Races, Hanna-Barbera / Warner Bros.) for this non-commercial project, made in
PixelLab (pixellab.ai) (character "Penelope HD 2"; her blown kiss, carry walk, lobby and victory posed from our own
skeletons); laid out by `scripts/build-character-sheet.py penelope`; rows = `SHEETS.penelope`. The lobby's glint,
powder, sparkles and hearts and the victory's checkered flag, sparkles and hearts are our own pixel art
(`scripts/build-penelope-lobby.py`, `scripts/build-penelope-victory.py`), laid out by `scripts/build-lobby-image.py`.

## lantern-bubble.png

Our own art: the green lantern's bubble forming, held and giving way, drawn by `scripts/build-lantern-bubble.py`.

## captain-spiral.png

The spiral of light round the captain's shield, made in PixelLab's VFX Creator ("Captain shield spiral"),
laid out by `scripts/build-captain-spiral.py` from its game pack (one row behind him, one in front).

## Generated art

Own art for this project, drawn in code by the scripts in `apps/client/scripts` (no source images),
in HD: drawn on a design grid at high resolution and scaled down, so edges are smooth.
`hd.py` holds the shared drawing helpers.

- `bombs.png` — `build-bombs.py`. Cells (128px): normal, pierce, remote.
- `items.png` — `build-items.py` (bomb items reuse bombs.png). Columns (192px): one per item,
  order = `ITEMS.order` in `src/render/sprites.ts`; rows: plain, then 3 frames of a glint.
- `flames.png` — `build-flames.py`. Rows (128px): fireball center, arm segment, arm tip; columns: 5 stages.
- `kamehameha.png` — `build-kamehameha.py`, Goku's beam. Rows (128px): ball of ki, beam segment (tiles
  seamlessly), head; columns: 8 looping frames.
- `rasengan.png` — `build-rasengan.py`, Naruto's Rasengan. Rows (128px): the spinning ball (8 looping frames),
  the burst where it strikes (8 frames, played once).
- `tiles.png` — `build-tiles.py`. Cells (128px): grass A (plain, flowers, pebbles), grass B (darker),
  breakable block, inner pillar, border wall, then the block burning away in 6 frames over the grass (struck, ablaze,
  breaking, collapsing, embers, ash; played over its flame's life). Order = `TILES.cells`.
- `bomber.png` — `build-bomber.py`, the bomb mascot: a demolition trooper with an iron bomb for a head, drawn as
  pixel art (a 3D puppet posed per frame, flat shading bands, reduced to the pixel grid without blending);
  rows = `SHEETS.bomber`.
