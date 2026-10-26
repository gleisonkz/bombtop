# Sprite licenses

## captain.png

Fan art of Captain America (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Captain America HD" and its "Carry" state). Frames laid out by
`scripts/build-character-sheet.py captain`; rows = `SHEETS.captain`.

## thor.png

Fan art of Thor (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Thor HD"; cast, carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's
lightning, shockwave, dust and the struck hammer's head are drawn by `scripts/build-thor-lobby.py`. Frames laid out by
`scripts/build-character-sheet.py thor`, rows = `SHEETS.thor`. The lobby is its own image, `thor-lobby.png`, laid out by `scripts/build-lobby-image.py thor`.

## goku.png

Fan art of Goku (Dragon Ball) for this non-commercial project. The original
PixelLab artwork is retained as an appearance/pose reference. The current wider
pixel-art gameplay family was redrawn with the built-in image generator using
the actual Goku reference and the new Naruto family. `scripts/pack-goku.py`
preserves 108 frames in the original 146 x 159 cells. Sources, prompts and
measurements: `concept/goku/gameplay-redraw/`.
The separate `goku-lobby.png` transformation is generated from the same new Goku;
`scripts/pack-goku-lobby.py` registers eight key poses into 16 playback cells,
including reverse power-down and resting holds. The resting pose uses the actual
gameplay idle pixels. Earlier supplied/selected sources remain archived in
`concept/goku/`. See its README for reproduction.

## naruto.png

Fan art of Naruto for this non-commercial project. Current artwork was redrawn
with the built-in image generator from the user's classic Naruto appearance
reference, preserving the supplied atlas's 108-frame animation contract.
`scripts/pack-naruto.py` registers 80 x 116 cells in nine columns and 18 rows;
row 17 supplies the eight-frame celebration. Actual references, generated sources,
prompts and registration measurements are in `concept/naruto/reference-remake/`.
The original supplied atlas/metadata remain untouched in `concept/naruto/`.

## spider.png

Fan art of Spider-Man (Marvel) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Spider-Man HD"; web shot, carry walk and the lobby poses posed with skeleton v3 from its rotations). The
lobby's web lines and dust are drawn by `scripts/build-spider-lobby.py`. Frames laid out by
`scripts/build-character-sheet.py spider`, rows = `SHEETS.spider`. The lobby is its own image, `spider-lobby.png`, laid out by `scripts/build-lobby-image.py spider`.

## pikachu.png

Fan art of Pikachu (Pokémon, Nintendo / The Pokémon Company) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Pikachu HD" for the front rows and "Pikachu HD v3", a v3 rotation of its front, for the side and back; thunder
shock and carry walk posed with skeleton v3 from their rotations). Frames laid out by
`scripts/build-character-sheet.py pikachu`; rows = `SHEETS.pikachu`.

## static.png

Fan art of Static (Static Shock, DC / Milestone) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Static Shock HD 2" and "Static Shock HD v3", a v3 rotation of its front and sides for the back; magnet pull,
carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's flying disc, its glow, shadow and
sparks are drawn by `scripts/build-static-lobby.py`. Frames laid out by `scripts/build-character-sheet.py static`;
rows = `SHEETS.static`.

## flash.png

Fan art of the Flash (DC) for this non-commercial project, made in PixelLab (pixellab.ai) (character "Flash HD"; skid
stop, carry walk and the lobby poses posed with skeleton v3 from its rotations). The lobby's afterimages, speed lines,
bolts and dust are drawn by `scripts/build-flash-lobby.py`. Frames laid out by `scripts/build-character-sheet.py flash`;
rows = `SHEETS.flash`.

## bugs.png

Fan art of Bugs Bunny (Looney Tunes, Warner Bros.) for this non-commercial project, made in PixelLab (pixellab.ai)
(characters "Bugs Bunny HD" and "Bugs Bunny HD v3", a v3 rotation of its front for the side and back; popping out of his
tunnel and carry walk posed with skeleton v3 from its rotations; the lobby's carrot is a v3 animation). Frames laid out by
`scripts/build-character-sheet.py bugs`; rows = `SHEETS.bugs`.

## lantern.png

Fan art of the Green Lantern John Stewart (DC) for this non-commercial project, made in PixelLab (pixellab.ai) (character
"John Stewart HD 2", its face repainted with glowing green eyes and a serious mouth and imported as "John Stewart HD v3";
the ring cast and carry walk posed with skeleton v3 from its rotations). Frames laid out by
`scripts/build-character-sheet.py lantern`; rows = `SHEETS.lantern`.

## donatello.png

Fan art of Donatello (Teenage Mutant Ninja Turtles, Paramount / Nickelodeon) for this non-commercial project, made in
PixelLab (pixellab.ai) (character "Donatello HD"; his bo staff spin and carry walk posed from our own skeletons, a lobby
twirling the staff); laid out by `scripts/build-character-sheet.py donatello`; rows = `SHEETS.donatello`.

## penelope.png, penelope-lobby.png, penelope-victory.png

Fan art of Penelope Pitstop (Wacky Races, Hanna-Barbera / Warner Bros.) for this non-commercial project, made in
PixelLab (pixellab.ai) (character "Penelope HD 2"; her blown kiss, carry walk, lobby and victory posed from our own
skeletons); laid out by `scripts/build-character-sheet.py penelope`; rows = `SHEETS.penelope`. The lobby's glint,
powder, sparkles and hearts and the victory's checkered flag, sparkles and hearts are our own pixel art
(`scripts/build-penelope-lobby.py`, `scripts/build-penelope-victory.py`), laid out by `scripts/build-lobby-image.py`.

## panther.png, panther-lobby.png

Fan art of the Pink Panther (DePatie-Freleng / MGM) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Pink Panther HD 4"; his tiptoe and carry walk posed from our own skeletons, a lobby going "shh");
laid out by `scripts/build-character-sheet.py panther`; rows = `SHEETS.panther`. The lobby (tiptoeing in, then
"shh") is laid out by `scripts/build-panther-lobby.py` and `scripts/build-lobby-image.py`.

## harry.png, harry-lobby.png, harry-victory.png, patronus.png

`harry-lobby-patronus-v2.png` reuses clean Harry cells from the original menu strip
and the original eight-frame stag, recomposed by `scripts/pack-harry-lobby.py`.
Its preserved source, timeline and reproduction are documented in `concept/harry/README.md`.

Fan art of Harry Potter (J. K. Rowling / Warner Bros.) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Harry Potter HD v3b", its front retouched by hand: a shorter wand, the scar; his spell and carry walk posed
from our own skeletons, a lobby swirling the wand and a victory jump); laid out by `scripts/build-character-sheet.py harry`;
rows = `SHEETS.harry`. The stag is a PixelLab image (`scripts/build-patronus.py`); the lobby's stag run and sparkles and the
victory's golden snitch are laid out and drawn by `scripts/build-harry-lobby.py` and `scripts/build-lobby-image.py`.

## pele-final.png, pele.png, pele-lobby.png, ball.png

The current `pele-final.png` uses the user-supplied `pele_pixel_art_final.zip`, preserved unchanged as
`concept/pele/supplied-final-atlas.png`; its original author/license was not specified.
The earlier source `concept/pele/supplied-atlas.png` remains historical; the unused public `pele.png` was removed. `scripts/pack-pele.py` isolates
and registers the supplied art without generating new poses. The lobby now uses this atlas's celebration row.
See `concept/pele/README.md` for inventory and reproduction.

The historical Pelé artwork and unused `pele-lobby.png` were fan art in the 1970 Brazil kit, made in PixelLab
(pixellab.ai) (character "Pele HD"; his kick, carry walk, keepy-uppy and jump posed from our own skeletons); laid out by
`scripts/build-character-sheet.py pele`; rows = `SHEETS.pele`. The ball is a PixelLab image (`scripts/build-ball.py`); the
lobby's ball and confetti are drawn by `scripts/build-pele-lobby.py`, laid out by `scripts/build-lobby-image.py`.

## lula.png

Caricature of Luiz Inácio Lula da Silva for this non-commercial project, made in PixelLab (pixellab.ai) (character
"Lula HD V2", after a vinyl toy of him: red t-shirt with a yellow star; his setting the picanha down and carry walk posed
from our own skeletons, his "L" raised high a v3 animation); laid out by `scripts/build-character-sheet.py lula`; rows =
`SHEETS.lula`. The picanha he leaves is an item in `items.png` (`pack-concept-items.py`).

## optimus.png, optimus-lobby.png, truck.png

Fan art of Optimus Prime (Hasbro / Takara Tomy) for this non-commercial project, made in PixelLab (pixellab.ai) (character
"Optimus Prime HD"; his crouch from PixelLab's crouching template, his carry walk and raised fist posed from our own
skeletons); laid out by `scripts/build-character-sheet.py optimus`; rows = `SHEETS.optimus`. The truck is three PixelLab
images (side, front, back: `scripts/build-truck.py`); the lobby's glow, plates, sparks, speed lines, exhaust and dust are
drawn by `scripts/build-optimus-lobby.py`, laid out by `scripts/build-lobby-image.py`.

## lantern-bubble.png

Our own art: the green lantern's bubble forming, held and giving way, drawn by `scripts/build-lantern-bubble.py`.

## captain-spiral.png

The spiral of light round the captain's shield, made in PixelLab's VFX Creator ("Captain shield spiral"),
laid out by `scripts/build-captain-spiral.py` from its game pack (one row behind him, one in front).

## Generated art

Project art built from the authored sources listed below or drawn in code by the scripts in
`apps/client/scripts`, in HD with smooth edges.
`hd.py` holds the shared drawing helpers.

- `bombs/armed.png`, `bombs/warning.png`, `bombs/critical.png`, `bombs/detonation-start.png` and white masks are the active normal/pierce/remote atlases (128px cells). The obsolete `bombs.png` was removed.
- `items.png` — `pack-concept-items.py`, packed from the concept art `concept/powerups/powerup-family-concept-v1.png`;
  the last column is Lula's picanha, `build-items.py`'s icon set in that art's gold ring. Columns (192px): one per item,
  order = `ITEMS.order` in `src/render/sprites.ts`; rows: plain, then 3 frames of a glint.
- `flames.png` — original AI-generated art for Bombtop, created with the built-in image generator using the implemented bombs as a style reference. Source and prompt: `concept/flames/flames-volume-source.png` and `volume-generation.txt`. Packed by `build-flames.py`; six rows of 128px cells: fireball center, four arm variants, terminal tip; five lifetime stages. Textures are isolated and clamped at runtime to prevent atlas bleeding.
- `kamehameha.png` — `build-kamehameha.py`, Goku's beam. Rows (128px): ball of ki, beam segment (tiles
  seamlessly), head; columns: 8 looping frames.
- `rasengan.png` — `build-rasengan.py`, Naruto's Rasengan. Rows (128px): the spinning ball (8 looping frames),
  the burst where it strikes (8 frames, played once).
- `tiles.png` — `build-tiles.py`. Cells (128px): grass A (plain, flowers, pebbles), grass B (darker),
  breakable block, inner pillar, border wall, then the block burning away in 6 frames over the grass (struck, ablaze,
  breaking, collapsing, embers, ash; played over its flame's life). Order = `TILES.cells`.

## Bomber regenerated sheet (2026-10-25)

Original Bombtop character, regenerated with OpenAI's built-in image generation using
the project's previous Bomber as the visual reference: black bomb head, amber eyes,
violet armor and red cape. Source: `concept/bomber/bomber-sheet.png` (1872 x 5472,
RGBA, 9 columns, 19 rows of 208 x 288 master cells). The first 18 rows match `SHEETS.bomber`;
the last contains nine distinct menu-flight poses. Dedicated generated carry poses
keep both arms raised; the renderer supplies the carried bomb.

`scripts/pack-bomber.py` exports `bomber-atlas.png` (arena) and
`bomber-menu-atlas.png` (HD lobby/portraits) from the compiled
source and `bomber-title-fly.png` (768 x 768, 3 x 3 menu loop) from the regenerated
`concept/bomber/menu-flight-source.png` (1152 x 1152). The menu source preserves
HD details and transparent padding; the compiled sheet includes matching thumbnails.
`scripts/build-bomber.py` is the historical procedural generator, not the source
of the current art. See `concept/bomber/README.md` for the frame inventory.

`bombs/mega/*.png` is original Bomber-specific art generated with OpenAI from the
game's bomb-family reference and Bomber's approved identity. Canonical source:
`concept/bombs/mega-bomber.png` (approved armed art) and `mega-stages.png`
(four-stage grid); exported at 512 x 512 by `pack-mega-bomb.py`. White-flash
variants are technical alpha-preserving masks, not additional hand-drawn stages.

## Ground effects

ground-effects.png is original AI-generated artwork, styled against the project's implemented bomb. Six purple teleport-vortex phases and six rose extra-hit protection-ring phases are separate concepts. Source images and reproducible packing notes: concept/ground-effects/README.md. No third-party sprite was copied.

## Block destruction tiles

The six destruction cells in tiles.png are original AI-generated artwork based on this project's original brick tile and approved sculpted fire. The other nine tiles remain unchanged. Source, prompt and reproducible packing notes: concept/tiles/README.md.

## Conveyors

`conveyors.png` derives from original artwork generated with OpenAI's built-in
image tool using this project's tilesheet as its material reference and approved
by the user. `concept/conveyors/conveyor-concept.png` retains the source.
`scripts/pack-conveyors.py` registers the pixels into four directional rows with
16 translated belt phases and stationary rails. See `concept/conveyors/README.md`.

## Supplied Super Choque replacement

`static-final.png` is packed from the image supplied by the user in
`Imagem do ChatGPT 25 de out. de 2026, 21_48_03.png`. The original image is retained in
`concept/static/supplied-20261025-214803.png`; packing and fallback animation notes
are in `concept/static/README.md`. No additional licensing grant was supplied.
