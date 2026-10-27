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

Fan art of Goku (Dragon Ball) for this non-commercial project. The current family
was generated in PixelLab from the approved GOKU A1 alone, with game poses supplied
only as COCO-18 skeleton coordinates. The atlas contains 108 occupied cells:
105 distinct drawings and three explicit idle holds. Native 128 x 160 images
receive a two-pixel transparent border, without resampling or body compositing.
The separate transformation uses 27 drawings, including rising black hair,
mixed black/gold locks and the upright Super Saiyan crown, in 60 playback cells
at 20 fps. PixelLab inpainting preserves unmasked character pixels when deriving
hair references or removing isolated background marks. Sources, masks, job
selection and reproduction: `concept/goku/a1-redraw/`. Rejected earlier families
remain archived under `concept/goku/` and do not supply the current appearance.

## naruto.png

Fan art of Naruto for this non-commercial project. The approved user-selected
appearance was animated with the built-in image generator, using the previous
atlas only for pose order. All108 frames are newly drawn without baked-in FX.
`scripts/pack-naruto-approved.py` registers96x128 cells in a9-column,18-row
864x2304 atlas; row17 supplies both the eight-frame menu and victory animation.
The slightly wider transparent cells retain full-size extended hands and falls.
References, raw generations, pose guides, exact PixelLab edge-cleanup ledger,
packing measurements and palm positions are in `concept/naruto/approved-redraw/`.
The original supplied atlas and prior reference-remake remain preserved.

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
PixelLab (pixellab.ai), regenerated from approved option 4 as character `8b856f61-5e44-468e-97cc-b05a61f6525a`.
All 111 animation frames use the new design; the staff is held or strapped to the shell. Sources and reproducible
packing are in `concept/donatello/pixellab-redraw/`; rows = `SHEETS.donatello`.

## penelope.png, penelope-lobby.png, penelope-victory.png

Fan art of Penelope Pitstop (Wacky Races, Hanna-Barbera / Warner Bros.) for this non-commercial project, made in
PixelLab (pixellab.ai) (character "Penelope HD 2"; her blown kiss, carry walk, lobby and victory posed from our own
skeletons); laid out by `scripts/build-character-sheet.py penelope`; rows = `SHEETS.penelope`. The lobby's glint,
powder, sparkles and hearts and the victory's checkered flag, sparkles and hearts are our own pixel art
(`scripts/build-penelope-lobby.py`, `scripts/build-penelope-victory.py`), laid out by `scripts/build-lobby-image.py`.

## panther.png, panther-lobby.png

Fan art of the Pink Panther (DePatie-Freleng / MGM) for this non-commercial project, made in PixelLab (pixellab.ai)
(character "Pink Panther Bombtop slim option2", `d4a3e349-0c83-4c42-a0e3-72b4b85ff355`).
All poses follow the approved slender concept; no effects or props are baked into the character.
Native source frames and reproducible packing are in `concept/pink-panther/pixellab-redraw/`;
91 gameplay frames follow `SHEETS.panther`, with 16 separate lobby frames.

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

Caricature of Luiz Inácio Lula da Silva for this non-commercial project, redrawn
with PixelLab from the approved option 1 in the new Pelé pixel-art family.
All 108 poses are packed by `concept/lula/pele-style-redraw/pack.py` into
192 × 192 cells; sources, generation IDs, prior artwork and reviewed palm/head
regions are retained there. The same new celebration serves menus and victory.
The picanha he leaves remains a separate item in `items.png` (`pack-concept-items.py`).

## optimus.png, optimus-lobby.png, truck.png

Fan art of Optimus Prime (Hasbro / Takara Tomy) for this non-commercial project.
The user-approved armored option3 was drawn with the built-in image generator,
using existing game art only as pose/direction references. New robot, truck and
raised-fist art share one appearance; no visual effects are baked into the PNGs.
`pack-optimus-approved.py` packs224px gameplay cells and composes a clean16-frame
menu/victory. The special uses articulated panel-folding intermediates plus exact
idle/truck endpoints and explicit reverse playback. References, raw generations,
component selections, geometry and source hashes are in
`concept/optimus/approved-redraw/`. Legacy builders remain historical only.

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

### Approved Super Choque option4 redraw

The107 characterframes were regenerated from the user-approved PixelLab option4, using the previous spritesheet only for poses. The new168x224 cells retain full-size raised arms; electricity and aura remain separate runtime art. The menu retains its physical metaldisc. Actualreferences, generatedfamilies, measuredsourceboxes, palmpositions and reproduciblepacking are in concept/static/option4-redraw/; build with scripts/pack-static-approved.py.


## Regenerated character ability effects

`pikachu-electric-game.png`, `static-electric-game.png` and
`flash-speed-force.png` were generated with the built-in image tool from the
project's existing Thor and older electrical effect references. Native64px
exports, exact prompts, source boards and packing records are retained in
`concept/electric-game-remake/`. Each row contains8distinct generated phases.

`donatello-spin-detailed.png` contains8generated motion-trail drawings; it does
not include the character or staff. Source and packing records are retained in
`concept/pikachu-donatello-effects/`.

`lantern-construct-shield.png` uses the generated Thor/Captain sprite-family
redraw archived in `concept/lantern/thor-captain-style/`.
`goku-ssj-aura-detailed.png` is the separate generated transformation effect
archived in `concept/goku/aura-thor-captain/`; it is used only in menu/victory
previews. Earlier candidates remain archived for comparison.
