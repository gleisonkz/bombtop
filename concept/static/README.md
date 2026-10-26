# Super Choque atlas

## Action redraw, 2026-10-26

The original directional idle/walk rows 0–5 remain byte-for-byte unchanged.
Generated clean drawings in `carry-redraw/` replace the other animation roles:
six dizzy poses, seven defeat poses ending prone, 6/7/4 directional magnetic
pull poses, 4/4/4 idle carry poses, 6/6/6 walking carry poses, ten thin-disc
menu poses and eleven victory poses. There are 81 distinct replacement poses.
Sprites contain no baked electricity, stars, aura or shadows; the existing
game effects remain in use. Carry drawings also omit the bomb, which the
game attaches at the inspected glove support points in `palms.json`.

`contract.json` records immutable source hashes, measured extraction boxes,
uniform nearest-neighbor scales, playback order and the preserved row hashes.
`pack-static-carry.py` supplies these rows to the canonical `pack-static.py`
rebuild. The victory hop lifts frame six by 12 native pixels; defeat ends on
the ground. Pull starts extended and recoils because the gameplay effect is
immediate. Runtime atlas dimensions and frame counts remain unchanged.

The new menu's body measurement is 142px, from hair top y17 to boot contact
y159 in its neutral pose; the disc is excluded from normalization. Its thin
silver rim is part of the character's physical prop, not a visual effect.
The measured full horizontal envelope is [13,152). Spatial hair/board recolor
protection is rebuilt from the new frames, including horizontal defeat poses.

Rebuild previews with `python apps/client/scripts/preview-static-redraw.py`.
`carry-preview.gif` composites the actual game bomb behind the character using
the runtime socket geometry. `menu-preview.gif` and `actions-preview.gif`
show the actual packed frames. These are offline inspections, not live browser
captures. The newly generated aura candidate was discarded at the user's
instruction; the production aura and shared electricity atlas are unchanged.

## Original supplied locomotion source

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
body was 118px before the redraw; the new menu uses the measurement above.

Rows 0-2: directional idle; 3-5: directional walk with 5/4/5 unique frames;
6: crouched reaction fallback; 7: knockdown ending prone; 8-9: fighting
poses for casting; 10: rear idle fallback; 11-13: directional carry;
14-16: reused directional carry motion; 17: ten front disc poses;
18: eleven celebration gestures. Rear disc and running poses remain in
the source for future actions.

The original source has no dedicated dizzy, electric charge, rear cast, or
complete overhead carry animation. The redraw above replaces those fallback
gestures. Front/back carry now use two supporting hands; side carry uses one
visible hand, including mirrored playback. The existing portrait is retained.

Generated spatial recolor protection preserves hair and the silver board.
The coat uses the blue-violet hue range 195-245. Actual atlas pixel tests
check directional coat recoloring, board preservation and unchanged alpha;
the global white selection retains the original palette.

Copyright/licensing provenance beyond the user-supplied image is unverified.
