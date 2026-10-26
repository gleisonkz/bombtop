# Character page special colors — 2026-10-25

The user clarified that this feature belongs **only to the special preview on
`/personagens`**, and requested undoing global gameplay application. The main
menu's original colors remain as previously requested.

## Cause and correction

The guide color buttons called `paintPreview()` for portraits and animation
strips but never notified the special scene. The scene always kept `you` in
original colors. This explains the reported blue Bomber remaining original in
the character-page arena, which earlier diagnostic arenas had not exercised.

- Guide color changes now reach `ItemPreview.setCharacterColor`; selecting a
  new character also carries the currently selected color.
- Only the Menu's character preview enables `characterColors`. The ordinary
  item guide and normal gameplay do not enable special palette recoloring.
- `Renderer` defaults `previewSpecialColors` to false. All owner and player
  special color resolution uses this gate. Thus the earlier global gameplay
  application is disabled while its shared rendering support serves this preview.
- The preview adjusts only the cloned caster view. The simulation, rival,
  network state, character selections and gameplay mechanics remain unchanged.
- Color changes redraw without restarting the scene or replaying its audio.

## Live validation on the actual page

Codex Browser Bridge, disposable tab1410196247:
`http://localhost:5173/personagens?special-color-preview-qa=2`.
Used the page's actual roster buttons and Original/Azul/Vermelho buttons, actual
`ItemPreview`, shared simulation and production `Renderer`; no replacement arena.
QA observed the live preview instance to stop its ticker and freeze a genuine
active special phase for pixel comparisons. UI behavior was unchanged.

All18 character specials were triggered successfully. For each character:

1. Selected Original and captured the special scene.
2. Clicked Azul, then Vermelho; each produced different rendered pixels.
3. Clicked Original again; all18 returned to an exact zero-difference capture.
4. Confirmed `previewSpecialColors` enabled only in this character preview,
   the rival still original, and the underlying simulation owner flag unchanged.

Repeated renders settle the existing8-render movement hold before comparison;
initial snapshots before that stabilization can differ in the rival's walk/idle
pose independently of palette. No motion/animation behavior was changed.

The blue Bomber screenshot on the real page confirmed its body uses the blue
skin source, with the mega bomb present at tick29/fuse171. The previous failure
was not failure of the Bomber texture shader: selected color never reached this
page's scene.

`character-page-special-palettes.jpg` shows Original / Azul / Vermelho for Bomber
and the ten previously outstanding families: Thor, Spider, Flash, Bugs, Lantern,
Donatello, Penelope, Panther, Pelé and Lula. The other seven were tested through
the same page. `character-page-palette-results.json` records all18 outcomes and
pixel-difference counts from the final run. Generic victim statuses keep their
authored colors; the rival does not inherit the selected caster's outfit.

## Checks

New tests cover selected caster color, rival preservation, unmodified simulation,
restoration, no audio replay on recoloring, unchanged item previews and normal
gameplay effects staying original by default. The full client suite passed895
tests across94 files. Browser tab and shared lease were cleaned up. No commits
or pushes were made.
