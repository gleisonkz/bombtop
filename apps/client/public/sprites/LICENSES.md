# Sprite licenses

Trial character sheets. Both are CC0 (public domain, no attribution required).

- `foozle-legend.png` — "Legend - Main Character" by Foozle (commissioned from Atari Boy),
  https://foozlecc.itch.io/legend-main-character — CC0 1.0
- `james.png` — "Pixel Character 02 - James", https://opengameart.org/content/pixel-character-02-james — CC0 1.0
- `ninja.png` — the project's own character, made in PixelLab (pixellab.ai) for Bombtop;
  rows: idle S/E/N, walk S/E/N (6 frames), hit (6), death (7), ice-blast cast S/E/N (9); 64px cells.
  `ninja-hd.png` is the same sheet smoothed to 2x (128px cells) by `scripts/upscale-pixel-art.py`.

## ninja.png

The project's own character, made in PixelLab (pixellab.ai) for Bombtop at 128px (character "Ice ninja HD"
and its "Carry" state). Frames laid out by `scripts/build-ninja-sheet.py`; rows = `SHEETS.ninja`. Ice cast: skeleton-posed body plus ice effects drawn by `scripts/build-ninja-cast.py`.

## Generated art

Own art for this project, drawn in code by the scripts in `apps/client/scripts` (no source images),
in HD: drawn on a design grid at high resolution and scaled down, so edges are smooth.
`hd.py` holds the shared drawing helpers.

- `bombs.png` — `build-bombs.py`. Cells (128px): normal, pierce, remote.
- `items.png` — `build-items.py` (bomb items reuse bombs.png). Columns (192px): one per item,
  order = `ITEMS.order` in `src/render/sprites.ts`; rows: plain, then 3 frames of a glint.
- `flames.png` — `build-flames.py`. Rows (128px): fireball center, arm segment, arm tip; columns: 5 stages.
- `tiles.png` — `build-tiles.py`. Cells (128px): grass A (plain, flowers, pebbles), grass B (darker),
  breakable block, inner pillar, border wall. Order = `TILES.cells`.
- `bomber.png` — `build-bomber.py`, the bomb mascot. 128px frames; rows = `SHEETS.bomber`.
