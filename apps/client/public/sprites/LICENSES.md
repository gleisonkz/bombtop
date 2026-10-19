# Sprite licenses

Trial character sheets. Both are CC0 (public domain, no attribution required).

- `foozle-legend.png` — "Legend - Main Character" by Foozle (commissioned from Atari Boy),
  https://foozlecc.itch.io/legend-main-character — CC0 1.0
- `james.png` — "Pixel Character 02 - James", https://opengameart.org/content/pixel-character-02-james — CC0 1.0

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
- `ninja.png` — `build-ninja.py`, the ninja in the same style. 128px frames; rows = `SHEETS.ninja`.
