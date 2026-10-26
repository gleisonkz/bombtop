# Conveyor runtime visual validation — 2026-10-25

Authoritative root: `D:/Programação/Jogos/New folder/bombtop`.
Live browser: Codex Browser Bridge, disposable tab 1410196126,
`http://localhost:5173/conveyor-visual-qa.html`. Temporary QA page removed after
validation. Browser lease acquired and released without foregrounding user tabs.

## Scene and visual evidence

Actual `Renderer`, `createMatch`, production tile/item/character/conveyor loaders
and PixiJS GPU renderer. Arena rendered at three display pixels per world pixel.
`qa-arena.png` is a 720 × 624 capture extracted from the rendered GPU stage.
No replacement screenshot mockup or alternate implementation was used.

The native conveyor stage has 26 belts, only left/right, at world y=48 and y=144.
For directional coverage, the QA scene adds two five-tile vertical runs through
empty cells, producing 36 belts total. Grass, bricks, pillars, portal, protection
marker, Bomber and the item inventory remain visible as material references.
Revenge was enabled only to expose the normally disabled cart for the asset audit.

Observed: no visible gaps, seams, neighboring atlas bleed or drifting rails. All
tiles remain 16 × 16 world pixels. Painted arrows and rubber move together.
Guide rails stay fixed. Horizontal runs and vertical runs connect cleanly to
their same-direction neighbors. Turning-corner artwork was not evaluated: the
native stage has no turns, and the synthetic vertical-to-horizontal junctions
are diagnostic placement, not a new corner-tile contract.

## GPU phase checks

Sampled every phase at ticks 0,2,…,30, then tick32 for exact loop closure.
Each directional tile is 48 × 48 display pixels. A phase advances the rubber
three display pixels (eight source pixels) in its own direction.

| Direction | Unique rendered frames | Correct-direction pixel error | Reverse-direction mean error | Rail changes | Nonopaque pixels |
| --- | ---: | ---: | ---: | ---: | ---: |
| Right | 16 | 0 | 61.527 | 0 | 0 |
| Left | 16 | 0 | 61.527 | 0 | 0 |
| Down | 16 | 0 | 61.528 | 0 | 0 |
| Up | 16 | 0 | 61.528 | 0 | 0 |

Correct-direction error compares each next GPU frame against the preceding
frame shifted by three pixels with periodic wrapping, within the rubber band.
Rail-change counts compare stationary outer bands throughout the cycle.
Tick32 versus tick0: zero changed conveyor pixels.

Adjacent-tile comparisons, across all phases, found zero differing pixels:
116,736 RGBA component comparisons per horizontal direction and 147,456 per
vertical direction. Horizontal comparison excludes the upper shadow strip,
which correctly depends on terrain above the belt. Alpha failures: zero.

The page's animation button was activated and stopped through the Bridge;
simulation display advanced from tick4 to tick181.174. This check demonstrates
playback, not foreground frame-rate performance (the tab remained in background).
A temporary block over a belt hid that sprite, reducing visible conveyors from
36 to35; restoring the empty tile restored the belt.

All six Python atlas tests pass. No production code or artwork correction was
needed during this validation. Live development reloads from concurrent changes
required restoring the diagnostic scene; successful observations above refer
to the loaded production renderer and atlas, not to a loading/blank page.

## Other assets

1. **Revenge cart — clear next candidate when this mode is enabled.** The arena
   capture shows its flat brown chassis and plain circular rider on the top
   border. `renderer.ts` draws it directly, with no sprite branch. It lacks the
   material/shading of tiles and conveyors. Suggested replacement: a compact
   shaded metal cart with wheels and rivets, reusing the conveyor steel palette.
   Revenge is disabled by default (`arena.ts`); this is not normally visible.
2. **Donatello staff — optional, lower priority; source audit only.** Its spin
   uses layered pixel strokes with existing highlights. A small art sheet could
   add wood grain/grip detail, but current procedural geometry intentionally
   preserves real rotation. No claim of a newly inspected live staff animation.

Items, terrain, bombs, portals, truck and soccer ball already have dedicated
art. Their primitive fallbacks do not prove that normal gameplay needs new
assets. The colored mount ellipse is likewise fallback-only: normal gameplay
uses the approved extra-hit protection ring. No broad redesign is indicated.
