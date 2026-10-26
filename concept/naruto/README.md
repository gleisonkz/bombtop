# Naruto production artwork

Source: user attachment `naruto_slim_sprites (1).zip`.
`supplied-atlas.png` and `atlas.json` are untouched copies from the archive.
These original files remain untouched as the animation/order reference.
The production `apps/client/public/sprites/naruto.png` is now redrawn from the
user's classic Naruto appearance reference in `reference-remake/`.

108 frames in a 9 x 18 grid of transparent 80 x 116 cells. Feet anchor: (40, 112).
Arena scale: 0.2, keeping the standing body approximately 22 pixels tall.
Rows 0–16 retain the runtime idle, walk, hit, knockdown, action and carry order;
row 17 provides the eight-frame celebration used by the lobby.
All six front carry-walk poses now show their raised palms and play in order.
Carry sockets are rebuilt with
`python apps/client/scripts/build-carry-anchors.py --character naruto`.
See `reference-remake/README.md` for generation provenance and the packing contract.
