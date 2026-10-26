# Character effect pixel-art standard

Applies the approved web-family finish to character abilities. Authored native 64 × 64 cells, four distinct frames per row, transparent RGBA, compact material palettes, solid pixel clusters, dark edge accents, bright selective cores, and nearest sampling. No smooth blur halos or generated character silhouettes. Source drawing operations are retained beside this document. Texture framing follows the already verified PixiJS 8 model: https://pixijs.com/8.x/guides/components/textures .

| Character | New effect treatment |
| --- | --- |
| Pikachu | Layered gold discharge wrapping the body, forked gold lightning, terminal sparks |
| Thor | Thick blue-white lightning from existing hammer muzzle, long forks and bright impact |
| Super Choque | Dedicated eight-frame blue-white hand charges and body coils split behind/front; full visibility for the main pull and a one-second aura envelope |
| Goku | Cyan pixel beam with flowing core and end orb, ki charge |
| Naruto | Swirling chakra orb and expanding/fading burst |
| Lanterna Verde | Hollow emerald shield, preserving form/hold/pop timing |
| Capitão América | Dedicated twelve-frame golden helix split behind/front, preserving depth and the actual shield pose |
| Harry Potter | Dedicated native 64px stag, articulated gallop and branched antlers; eight poses in each of three views, no generic halo |
| Flash | Red/yellow streaks plus golden lightning along the same dash path |
| Pernalonga | Two floor-layer holes and separate raised-earth mounds; path marks skip walls/blocks and stay below items, bombs and players |
| Donatello | Staff actually rotates from spinLook, drawn with shaded pixel strokes and fading trails |
| Penélope | Shaded pink hearts for projectile and charm |
| Pantera | Pink pixel smoke as invisibility starts |
| Optimus | Cyan/orange exhaust accent; existing truck preserved |
| Pelé | Pixel foot-contact burst; existing spinning ball preserved |
| Lula | Dedicated four-frame picanha cut with cream fat cap, seared edge and grill marks |
| Bomber, Homem-Aranha | Keep their separately refined summon and silk families |

Energy atlas: 256 × 768, twelve rows, with layered body coronas for Static/Pikachu. Companion atlas: 256 × 384. Ability atlas: 256 × 512. Captain: 768 × 160, twelve 64 × 80 cells per layer. Picanha: 256 × 64. The generic companion staff and ability shield ring are intentionally unused after feedback; they must not replace actual rotation or depth again. The Kamehameha footprint is reduced to 18px cell thickness, 16px terminal cell and 14px muzzle cell before envelope scaling.

Latest refinements: Static has a separate 512 × 128 atlas overriding the legacy energy body rows; companion terrain adds a seventh row (256 × 448 total) for closed dirt mounds; Patronus uses a 512 × 192 atlas, 24 distinct poses, foot anchor (32,56) and scale 0.45. Reviewed together in the real renderer through `/character-effects-qa.html?characters=static,bugs,harry`; the second capture confirmed holes below other art and mounds instead of repeated mini-holes.

Sprite pools hide unused instances each rendered frame and derive frames from simulation time. These are cosmetic changes; reach, collision, stun, cooldowns, reflection and authoritative special timing are untouched. Existing procedural art remains the load-failure fallback. The separately developed stun-star effect remains authoritative for actual stunned characters; the companion atlas stun row is not added over it.

Development visual fixture: `/character-effects-qa.html` renders fixed snapshots of Pikachu, Static, Thor and Goku, using the real renderer. Query `?characters=naruto,lantern,captain,harry` selects another group. This fixture is not a production entry point.


## Static clean aura

`static-power-pixel.png` now uses eight paired 64px phases of thin cyan side arcs and brief hand sparks. Both layers keep the central 14px corridor empty; the old torso rings are gone. Four opaque colors and binary alpha match the existing pixel effects. The 512x128 layout, three-tick frame timing and 44x46 runtime footprint are unchanged. Replayable drawing operations are in `static-power.pixel.json`; validate with `python apps/client/scripts/test-static-power.py`.
