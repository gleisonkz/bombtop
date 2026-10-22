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
(character "Thor HD"; cast and carry walk posed with skeleton v3 from its rotations). Frames laid out by
`scripts/build-character-sheet.py thor`; rows = `SHEETS.thor`.

## goku.png

Fan art of Goku (Dragon Ball) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Goku HD"; Kamehameha and carry walk posed with skeleton v3 from its rotations). Frames laid out by
`scripts/build-character-sheet.py goku`; rows = `SHEETS.goku`.

## naruto.png

Fan art of Naruto (Naruto) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Naruto HD"; Rasengan dash and carry walk posed with skeleton v3 from its rotations). Frames laid out by
`scripts/build-character-sheet.py naruto`; rows = `SHEETS.naruto`.

## spider.png

Fan art of Spider-Man (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Spider-Man HD"; web shot and carry walk posed with skeleton v3 from its rotations). Frames laid out by
`scripts/build-character-sheet.py spider`; rows = `SHEETS.spider`.

## pikachu.png

Fan art of Pikachu (Pokémon, Nintendo / The Pokémon Company) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Pikachu HD" for the front rows and "Pikachu HD v3", a v3 rotation of its front, for the side and back; thunder
shock and carry walk posed with skeleton v3 from their rotations). Frames laid out by
`scripts/build-character-sheet.py pikachu`; rows = `SHEETS.pikachu`.

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
