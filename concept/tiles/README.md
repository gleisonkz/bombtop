# Tilesheet destruction animation

`tiles-before-burn.png` preserves the original full atlas. Its first nine cells (six grass variants, brick block, pillar and border) remain pixel-identical in the new runtime `tiles.png`.

`intact-block-reference.png` is the actual original block bitmap. The first three stages retain those same bricks, mortar and golden cap, compositing only progressively growing generated effects from `block-ignition-overlays.png` (three square overlay cells in one row). Each stage accumulates the earlier effects so the ignition grows from the same cracks. Before the settling transform, the top 32 rows remain pixel-identical; no brick pattern is redrawn.

`block-break-source.png` is original AI-generated art conditioned on the actual tilesheet and the approved `concept/flames/flames-volume-source.png`. Its last three stages supply collapse, embers and ash. Its alternative intact-wall drawings are deliberately not used. The initial effect fades in over the original block during the first five ticks; simulation flame lifetime stays unchanged.

The complete runtime atlas remains 1920×128: fifteen cells of 128×128. Destruction occupies columns 9–14. Run `python apps/client/scripts/build-tiles.py apps/client/public/sprites/tiles.png` to reproduce it. Initial frames settle from 128×128 to 126×123 and then 122×116, keeping horizontal center x=64 and floor y=128 fixed. The restrained downward compression transforms the same bricks and fire together before rubble appears. For the final three stages, `pack_tile_burn.py` isolates the source's uneven column spacing with a fixed 500×500 native window and 128/500 scale, sharing a floor anchor. Runtime isolates all tile textures with clamped linear sampling to prevent stone or neighboring stages bleeding into transparent cells.

Checks: `python apps/client/scripts/test-tile-burn.py`, `python apps/client/scripts/test-tile-continuity.py` and the client's tile/ground-effect tests. The static-cell pixel comparison is against the saved original, not an independently changed generator. Continuity checks verify exact original pixels and bounded, progressively increasing effect coverage.
