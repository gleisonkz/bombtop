# Companion effects

Native 256 × 384 RGBA atlas; 64 × 64 cells, four frames per row. Rows: heart, tunnel, spin, speed, smoke, stun. Authored using Pixelart MCP curve, polygon, ellipse and line operations, with a final palette pass. No resizing, soft gradients or generated high-resolution art.

`companion.pixel.json` contains every operation in execution order. Reproduce by creating a transparent canvas at its dimensions and passing operations to `pixel_batch` in batches of at most 128. Paths are intentionally omitted from individual operations.

## Integration

`new CompanionPixelEffects()` exposes `readonly root: Container`, `load(): Promise<void>`, `beginFrame(): void`, and `draw(kind, pose): boolean`.

Kinds: `heart | tunnel | spin | speed | smoke | stun`.

Pose: `{ x: number; y: number; tick: number; alpha?: number; size?: number; rotation?: number }`. Coordinates are world-pixel cell centers, rounded to whole pixels. Size is the full square footprint in world pixels; rotation is radians. Defaults: heart 16, tunnel 24, spin 28, speed 24, smoke 28, stun 24. Alpha defaults to 1. Heart artwork occupies roughly 7 pixels at its default size; use size 24 for a roughly 10-pixel heart.

Call `load()` with the other art loads, attach `root` to the character effects layer, and call `beginFrame()` once per render frame before draws. `draw` returns false while unavailable, enabling primitive fallback. Loading failures are swallowed and a later `load()` retries; concurrent loads coalesce. No sprite is allocated before an atlas is available. Frames advance every six simulation ticks and wrap after 24 ticks. Pass effect age for a new smoke burst; use global simulation tick for looping status marks. Hide expired smoke through the caller's lifetime logic.

The pool resets texture, anchor, pivot, skew, uniform scale, position, rotation, alpha, tint, blend mode and visibility on each draw. `beginFrame()` hides stale sprites. The renderer and electricity/magnet integration belong to the parent task.

## Evidence

Focused Vitest covers unavailable/retry/coalesced loads, all six rows, frame boundaries and invalid ticks, nearest sampling, pooled reuse and transform reset using real Pixi textures/sprites. Structural inspection verifies 256 × 384, binary alpha, four different pixel hashes in every row, nonempty cells, and visible content entirely inside cell margins. Pixel lint: 97/100, 21 colors, zero stray pixels; the remaining close pink pair intentionally separates smoke detail from heart highlight. Visual review confirms open alpha gaps and crisp native curves.

Implementation reference: installed Pixi 8.22 `Texture.d.ts` confirms shared `source` plus rectangular `frame`; `TextureSource.d.ts` confirms `scaleMode` sets all filters. This supports nearest-sampled subtextures matching the existing web-v2 helper without canvas resampling. [Pixi Texture API](https://pixijs.download/v8.22.0/docs/rendering.Texture.html).
