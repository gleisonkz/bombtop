# Ability accents

Native 256 x 512 transparent RGBA atlas, four 64 x 64 cells per row. All artwork authored through MCP Pixelart batch shapes, curves and clusters. No smooth resampling, gradients, blur, generated character silhouettes, or Python drawing. Palette: 11 opaque colors plus transparency; highlights favor top-left. Four distinct drawings per row; margins prevent neighboring-cell sampling. No alpha smoothing: alpha is binary and runtime opacity supplies fades.

## Contract

`AbilityPixelEffects.root` is a Pixi Container. Add it to the intended overlay once. Await `load()` alongside other renderer assets. Call `beginFrame()` once before drawing each rendered frame. `draw(kind, {x,y,tick,alpha?,size?,rotation?})` returns false while unloaded or for invalid poses, allowing existing fallback art. Positions round to screen pixels. Rotation uses radians. Tick is simulation time (or ability age), with a deterministic four-frame loop at five ticks/frame. Freeze tick for reduced motion. Size means the square cell footprint, including transparent margins, with center anchor. Sprite pooling grows to peak concurrent demand and hides unused entries each frame.

| Row / kind | Default cell footprint | Suggested integration |
| --- | ---: | --- |
| 0 ki | 24 px | `drawKamehameha`, replace orb embellishment only; retain beam body/head and existing segmentation |
| 1 chakra | 20 px | Rasengan hand-orb placement using current hand coordinates; retain burst timing and collision |
| 2 lantern | 40 px | Bubble centered around player torso; this hollow green ring can replace smooth held-loop art, while retaining form/pop timing |
| 3 patronus | 40 px | `drawPatronus`, spectral halo behind existing stag centered around body, not feet |
| 4 shield | 36 px | `placeSpiral`, blue-white accent centered around torso; one ring, not the existing split behind/front spiral contract |
| 5 exhaust | 20 px | `drawTruck`, stack position (`cx-dx*6`, `cy-20-dy*4`); orient native rightward jet away from travel |
| 6 kick | 28 px | `drawBall`, foot contact at blast start or impact endpoint; caller controls short lifetime, never continuously loop across flight |
| 7 promise | 24 px | Lula anticipation/star at existing cast pose; caller controls visibility before promise release |

Visible marks occupy roughly 40–56 of the 64 native pixels; a 24 px cell produces approximately 15–21 px of visible art. Integer screen sizes preserve deliberately stepped silhouettes, though downsampling still drops fine features. Use size 64 or integer multiples when exact 1:1 pixel inspection is required.

The current dedicated Kamehameha (128 px / 8 frames / 3 rows), Rasengan (128 px / 8 frames / 2 rows), Lantern (192 px cells / variable row lengths) and Captain spiral (134 x 168 / 12 frames / behind-front rows) loaders explicitly use linear. Patronus (96 px / 8 frames / 3 views), truck (128 x 96 / 4 frames / 3 views), and ball (32 px) explicitly use nearest already. Their character silhouettes are retained. `textureFromCanvas` in texture-cells.ts uses linear; the new module deliberately bypasses it and slices its own nearest source.

## Source and QA

`ability-pixel-source.json` contains canvas, palette, row contract and the complete ordered Pixelart operations. Replay on a fresh transparent canvas using `pixel_create_canvas`, then `pixel_batch` chunks no larger than 128. `ability-pixel-source-finishing.json` contains the final ki swirl pass and must run last. Outputs are the public PNG and `ability-pixel-qa.json` recording per-cell bounds, opaque counts and SHA-256 of RGBA bytes. Four unique hashes are required within every row, and every cell must retain two transparent pixels at every edge. Pixelart lint scored 100, with no near-duplicates or stray pixels before the finishing pass; final structural QA is recorded separately.

Primary reference read: [PixiJS 8 textures](https://pixijs.com/8.x/guides/components/textures). It confirms Assets async loading, lightweight Texture views over one source, and source sampling configuration. The module preserves that ownership: it never destroys or changes filtering on the existing character textures. Context7 resolution was tried first but returned unrelated Pixi integrations, so official PixiJS documentation was used directly.

Validation: five focused tests cover fallback, concurrent/idempotent loading, every row/frame, negative phase wrapping, pose rejection, pool reset, hiding surplus sprites, opacity clamp and retry after asset failure. Root-wide typecheck is independently affected by the concurrent missing `render/bomb-motion` import; no changes were made to that task's files. Browser and commits were excluded by task instruction. No live gameplay integration or viewport QA is claimed here.
