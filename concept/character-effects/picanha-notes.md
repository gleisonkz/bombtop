# Picanha pixel art

- Runtime sheet: `apps/client/public/sprites/picanha-pixel.png`, 256×64, four horizontal 64×64 frames; binary alpha; transparent frame borders.
- Authored entirely through Pixelart MCP polygon/line/copy operations. Replay `picanha.pixel.json`: create its transparent canvas, then pass the operations in order to `pixel_batch` (maximum 128 per batch). Do not apply SPAA, which would violate binary alpha.
- Rounded triangular cut with a wide cream fat cap, caramelized crust, red interior, three diagonal grill marks, top-left highlights and a darker lower thickness edge. Material ramps were built through `pixel_build_ramp` before drawing. No plate, medal, text or background.
- Frame 0 is the rest pose. Frames 1–3 change only tiny glints and rising warm steam; the body never wobbles. Suggested cadence: rest most of the time, brief accents at 8–12 ticks/frame. Parent retains canonical item timing/gameplay.
- Inspected the existing `ITEMS` atlas and its picanha column before drawing. Final sheet inspected through `pixel_view_canvas`; `picanha-14px.png` is the nearest-neighbor 14×14-per-frame readability proof, also created and inspected through Pixelart MCP. Cream fat cap and red cut remain readable; tiny specular detail naturally disappears at this scale.
- `loadPicanhaArt()` loads the atlas through Pixi Assets, selects nearest filtering and returns four shared-source Rectangle views. Parent integrates this into canonical item art; renderer and sprites modules are intentionally outside this change.
- Reference read: [PixiJS 8 texture documentation](https://pixijs.com/8.x/guides/components/textures). Its shared TextureSource/frame model guided the loader; installed version is 8.22.0.
- Structural validation: `python concept/character-effects/picanha-qa.py`; output saved in `picanha-qa.json`. This script only reads pixels and writes a report, never draws.
- Loader validation: `pnpm -C apps/client exec vitest run test/picanha-art.test.ts` (2 tests); `pnpm -C apps/client typecheck`.
- Required global game-asset-production and research-and-reference guideline files were absent at their instructed paths; used the explicit task contract, repository conventions, Pixelart workflow and official Pixi reference.
