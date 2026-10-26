# Pernalonga — approved option 1

The user selected `../pixellab-preview/option-1.png`: slender classic Bugs Bunny with a small blue scarf, gray/white fur, long rabbit ears, white gloves, two buck teeth and elongated rabbit feet. This exact image was supplied to PixelLab MCP as the rotation/animation reference. The old sheet supplied the animation contract only.

## Sources and contract

`jobs.json` records the four-direction reference rotation, empty-glove carry state, eighteen raw animation clips and five localized rear-ear edits. Original downloaded outputs are preserved under `generated/`; no old-character frames appear in the runtime atlas.

- Native animation source canvases: 128 × 160 RGBA.
- Runtime cells: 192 × 192, nine columns and eighteen rows, 1728 × 3456 RGBA.
- Fixed padding: (32,16), no pixel resampling or per-frame size normalization.
- Anchor: (96,163), standing body height 127, arena scale 0.17.
- Frame counts: 4,4,4,6,6,6,6,7,9,9,9,4,4,4,6,6,6,8; 108 occupied cells and 54 transparent tails.
- Row order: idle south/east/north, walk south/east/north, stun, death, cast south/east/north, carry-idle south/east/north, carry-walk south/east/north, lobby/victory south. West is mirrored from east.
- Raw frame zero is the supplied reference. Walk/stun/carry-walk select generated frames 1 onward; other strips preserve frame zero and select the following poses. No repeated drawings are manufactured as animation.
- Carried bombs, dirt/tunnel effects and shadows remain runtime-owned; the sprites contain the character only. Lobby/victory use the new empty-handed wave and hop.

The first standing cell preserves the approved option-1 pixels exactly. `manifest.json` records every selected file and SHA-256 hash. The original production PNG is backed up under `before-integration/`. The installer verifies production ownership against the original or last recorded installation before replacing it, and changes only Bugs metadata in shared files.

## Reviewed corrections

Initial review identified finger-tip rather than palm support points and pink inner ears in rear carry-walk frames. `measure-palms.py` now registers the dense palm surfaces and emits all fifty glove points for thirty carry frames. `palm-review.png` shows the points for manual review.

PixelLab edited the five rear-ear views. `correct-rear-ears.py` accepts those generated colors only inside the original pink ear masks, verifies gray replacement, and keeps every other source pixel and all alpha values unchanged. Corrected sources and generated edits remain separately discoverable. The approved standing pose is never altered.

## Reproduce

From the repository root, with downloaded sources present:

```powershell
python concept/bugs/pixellab-redraw/correct-rear-ears.py
python concept/bugs/pixellab-redraw/pack.py
python apps/client/scripts/test-bugs-pixellab.py
python concept/bugs/pixellab-redraw/measure-palms.py
python concept/bugs/pixellab-redraw/integrate.py
python apps/client/scripts/build-carry-anchors.py --character bugs
python apps/client/scripts/build-carry-anchors.py --check --character bugs
python apps/client/scripts/test-score-portraits.py
python concept/bugs/pixellab-redraw/preview.py
```

`apps/client/scripts/collect-pixellab-images.py jobs.json <clip names>` downloads known no-auth MCP result URLs without submitting generation. Structural acceptance checks grid, transparency, distinct drawings, clear tails/margins and pixel identity of the approved standing frame. Gameplay/UI validation covers sprite timing/layout, carry attachment, score portraits, cast bounds/layout, sheet previews, character guide, intro and special showcase. The GIF previews actual packed poses at game timing; static structural checks alone do not establish animation quality.
