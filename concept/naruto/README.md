# Supplied slim Naruto

Source: user attachment `naruto_slim_sprites (1).zip`.
`supplied-atlas.png` and `atlas.json` are untouched copies from the archive.
The production `apps/client/public/sprites/naruto.png` is byte-identical to the supplied atlas.

108 frames in a 9 x 18 grid of transparent 80 x 116 cells. Feet anchor: (40, 112).
Arena scale: 0.2, keeping the standing body approximately 22 pixels tall.
Rows 0–16 retain the runtime idle, walk, hit, knockdown, action and carry order;
row 17 provides the eight-frame celebration used by the lobby.
The final front carry-walk pose hides its palms: the existing frame-zero fallback is retained.
Carry sockets are rebuilt with `python apps/client/scripts/build-carry-anchors.py`.
