# Super Choque supplied atlas

Production source: `supplied-20261025-214803.png`, the exact user-supplied
1024 x 1536 RGBA image dated 2026-10-25 21:48:03. Older sources are retained
for provenance and are not used by the packer.

Rebuild: `python apps/client/scripts/pack-static.py`.
Validate: `python apps/client/scripts/test-static.py`.

The source contains 99 irregularly spaced poses in nine rows (12, 14, 12,
10, 11, 9, 11, 10, 10). Connected-component ownership separates neighboring
poses. RGB and alpha are retained inside each character; faint detached
background noise beyond two pixels of the character is excluded.

Runtime: transparent 2352 x 3534 atlas, 14 columns x 19 rows, 168 x 186
cells, feet anchor (82,170). Standing body is 148px; walking poses are
nearest-neighbor scaled from their smaller source size to match it. Arena
scale preserves the previous 21.588 game-pixel body height. Disc preview
body is 118px and uses that explicit measurement for menu normalization.

Rows 0-2: directional idle; 3-5: directional walk with 5/4/5 unique frames;
6: crouched reaction fallback; 7: knockdown ending prone; 8-9: fighting
poses for casting; 10: rear idle fallback; 11-13: directional carry;
14-16: reused directional carry motion; 17: ten front disc poses;
18: eleven celebration gestures. Rear disc and running poses remain in
the source for future actions.

The source has no dedicated dizzy, electric charge, rear cast, or complete
overhead carry animation. Existing supplied gestures fill those contracts;
no new poses were drawn. Thirty single-hand sockets follow visible gloves
including mirrored playback. The score portrait uses the new face crop.

Generated spatial recolor protection preserves hair and the silver board.
The coat uses the blue-violet hue range 195-245. Actual atlas pixel tests
check directional coat recoloring, board preservation and unchanged alpha;
the global white selection retains the original palette.

Copyright/licensing provenance beyond the user-supplied image is unverified.
