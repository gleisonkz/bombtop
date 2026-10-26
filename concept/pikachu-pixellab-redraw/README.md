# Approved Pikachu redraw

Approved reference: `pikachu-smaller-paws-v2-black-eyes.png`, produced from the previous game's first idle frame through PixelLab MCP. The user approved smaller, slimmer anatomy, short animal paws, black eyes and white eye highlights.

Generation receipts are in `jobs.json`. New directional rotations and eighteen animation clips were made through PixelLab MCP using actual image URLs, not text-only descriptions. The carry variant was regenerated with short paws beside the cheeks after independent visual review rejected long overhead arms. North attack frames 5–8 were edited individually to replace splayed fingers with compact paws. Rejected outputs remain outside the final pack.

## Production contract

- PNG: 1620 × 2952 RGBA; 180 × 164 cells, nine columns and eighteen rows.
- Occupied cells: 108; unused cells: 54, fully transparent.
- Row counts: 4,4,4,6,6,6,6,7,9,9,9,4,4,4,6,6,6,8.
- Rows: idle south/east/north, walk south/east/north, stun, death, attack south/east/north, carry-idle south/east/north, carry-walk south/east/north, lobby/victory south.
- All poses use one nearest-neighbor canvas transform: scale 0.84, fixed offset, feet anchor (96,157). No per-frame scale normalization. Standing body height is 129 native pixels, rendered at scale 0.145; this is intentionally smaller than Captain.
- Cast release stays at column 5, matching game timing. Electrical effects and carried bombs remain separate runtime props.
- Raw animation frame zero is the supplied starting image. Idle, attack, defeat and victory preserve that starting pose; walk and stun use generated frames 1 onward. No duplicate frames were manufactured as animation.
- West is the runtime mirror of east. There are no separate Pikachu lobby/transformation overrides.

## Reproduce and verify

Run from the repository root:

```powershell
python concept/pikachu-pixellab-redraw/pack.py
python apps/client/scripts/test-pikachu-pixellab.py
python concept/pikachu-pixellab-redraw/measure-palms.py
python concept/pikachu-pixellab-redraw/integrate.py
python apps/client/scripts/build-carry-anchors.py --character pikachu
python apps/client/scripts/build-carry-anchors.py --check --character pikachu
python apps/client/scripts/test-score-portraits.py
python concept/pikachu-pixellab-redraw/preview.py
```

`manifest.json` records selected original PNGs and SHA-256 hashes, including each corrected north attack frame. `palms.json` and `palm-review.png` record the reviewed contact points for all thirty carry cells. The integration script checks the old sprite hash before replacing it and updates only Pikachu's runtime layout, head portrait and menu bounds. The old PNG is preserved in `before-integration/`.

Focused validation includes sprite layout/timing, carry attachment, head portraits, cast bounds/layout, sheet previews, character guide, intro and special showcase. The structural test also checks black eyes with white highlights on the approved standing pose. Visual identity and motion require the contact sheets and actual playback, rather than structural checks alone.
