# Animated conveyors implementation plan

**Goal:** Integrate the approved ribbed rubber / steel rail conveyor in all four directions.

**Architecture:** Pack the actual approved concept into a separate 128px-cell atlas (16 columns, rows right/down/left/up). `ConveyorArt` owns isolated textures and reusable floor sprites; `Renderer` draws them above terrain and below world shadows/items/players.

**Tech stack:** PixiJS 8.22, TypeScript, Pillow, Vitest.

**Constraints:** Work in `D:/Programação/Jogos/New folder/bombtop`. Preserve parallel uncommitted changes, tile atlas and gameplay. No commit/push. Browser control only via Bridge with shared lease.

1. Pack approved concept via `apps/client/scripts/pack-conveyors.py`; retain actual pixels, crop black margins, periodic belt and fixed rails. Export `public/sprites/conveyors.png`, preview and contract in `concept/conveyors/README.md`. Validate opaque 2048x512 atlas, 16 unique phases and correct rotations using `test-conveyors.py`.
2. Add `src/render/conveyor-art.ts`, reusing `isolatedTextureRow`, 16 phases at two ticks each and pooled sprites. Test missing-art fallback, directional rows, full-tile scale, animation wrap and stale-sprite hiding in `test/conveyor-art.test.ts` (initial missing-module failure verified).
3. Load with tile art, add floor layer, reset each draw and use it before primitive fallback. Update layer assertions and add renderer regression for direction, occlusion and removed floors in `test/ground-effects.test.ts`.
4. Run Python asset tests, client tests, client typecheck and build in authoritative root. Inspect actual arena via Bridge using a disposable task tab and one targeted capture. Inspect focused diff and preserve concurrent work.

Reference: https://pixijs.com/8.x/guides/components/textures — Assets loading, CanvasSource, linear sampling; reuse existing clamped cell isolation instead of sharing neighboring atlas frames.
