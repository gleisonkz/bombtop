# Naruto reference redraw

Appearance master: `appearance-reference.png`, the user's attached classic Naruto.
The original supplied atlas and its frame metadata remain in the parent folder.

The built-in ImageGen tool received the actual appearance PNG and the actual pose
guides as image attachments. Locomotion, actions and carry/celebration were drawn
as separate coherent families. `action-end.generated.png` supplies the three
complete final attack poses; the first action candidate touched its right edge.

## Generation prompts

Shared direction: redraw the same classic Naruto in every pose: golden spiky
hair, blue eyes, whisker marks, navy forehead cloth and silver Leaf plate,
cream collar, orange tracksuit with navy shoulders/cuffs, right-thigh wrap and
pouch, and blue open-toed sandals. Match the attached appearance and generated
locomotion family; preserve child proportions, palette, outline and lighting.
Use genuine RGBA transparency, complete bodies and generous gutters, without
labels, scenery, shadows, bombs or Rasengan effects. The game supplies props/FX.

- Locomotion: six rows, counts `4,4,4,6,6,6`; front/right/back idle and walk.
- Actions: five rows, counts `6,7,9,9,9`; hit, progressive knockdown, then
  front/right/back attack. Distinct motion phases; no duplicated stills.
- Carry/celebration: seven rows, counts `4,4,4,6,6,6,8`; front/right/back carry
  idle and walk with visible raised palms, then front-facing celebration.
- Attack repair: three isolated complete end poses, front/right/back, matching
  the action family. No halos, props, backdrop or cell-edge clipping.
- Knockdown refinement: seven fall phases ending in a compact curled pose,
  retaining a single body/head scale instead of shrinking the death animation.

## Production contract

`contract.json` preserves all 108 frames, their row order, and their original
80 × 116 cells in a 720 × 2088 atlas. Feet anchor remains `(40,112)`.
Generated source placement is reviewed in `packing.json`; do not assume that a
model-generated board is a correctly aligned runtime atlas.

Packing uses the documented [Pillow image operations](https://pillow.readthedocs.io/en/stable/reference/Image.html):
isolate each source pose before resizing/compositing, so neighboring cells never
contribute pixels. Use nearest-neighbor resampling for the authored pixel art.
Source hashes and frame inventory are checked by `test-naruto.py`.

Rebuild and register the reviewed atlas from the repository root:

```sh
python apps/client/scripts/pack-naruto.py --write
python apps/client/scripts/test-naruto.py
python apps/client/scripts/build-carry-anchors.py --character naruto --check
```

Omit `--write` to export a candidate and diagnostic contact sheet/GIF under
`.agent/`. Runtime timing, row indices and frame counts remain unchanged.
