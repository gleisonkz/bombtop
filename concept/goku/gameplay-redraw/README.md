# Broader pixel-art Goku

The user requested the same pixel-art treatment as the redrawn Naruto, with a
broader Goku body. `appearance-reference.png` preserves Goku's identity;
`original-atlas.png` preserves the old animation/order reference.

The built-in ImageGen tool received the actual Goku appearance, actual pose
guides, and Naruto's generated family as image attachments. Later families also
received the new Goku locomotion sheet to maintain identity and proportions.

Prompt direction: redraw Goku with a broader chest, rounded shoulders, sturdy
arms/calves and fuller orange gi trousers, without stretching the whole image.
Keep his asymmetric black spiky hair, dark eyes, blue undershirt, sash,
wristbands and boots with orange trim. Match Naruto's crisp pixel clusters,
controlled cel shading and outline quality. Use transparent isolated full-body
sprites with gutters, no labels, shadows, scenery, bombs or energy effects.

Production prompt groups:

- Locomotion: front/right/back idle and walk, `4,4,4,6,6,6` frames.
- Actions: stun, defeat and front/right/back Kamehameha, `6,7,9,9,9` frames.
  Kamehameha gathers during columns 0–4 and releases at column 5.
- Carry/celebration: three carry idle directions, three carry walks and the
  legacy celebration, `4,4,4,6,6,6,8` frames. Raised palms stay visible.

The original 108-frame contract remains 9 × 18 cells, each 146 × 159 pixels,
with feet anchor `(71.5,153)`. Registration uses fixed family scales and
nearest-neighbor sampling, following the existing Naruto packing workflow and
the [Pillow image operations](https://pillow.readthedocs.io/en/stable/reference/Image.html).
Artwork must be isolated before resampling; a generated board is not assumed
to be an aligned production grid.

The separate `goku-lobby.png` transformation is redrawn from this same wider
Goku. Its 16 playback cells retain their existing contract. The old selected
transformation source remains archived in the parent directory.

`lobby-transform.generated.png` was generated with the actual enlarged gameplay
idle, the new locomotion family and the old transformation storyboard attached.
Prompt: keep the same wider body, face, orange/blue costume and crisp pixel art;
draw eight key poses in four columns/two rows: calm black hair, clench, charge,
black-hair aura, golden upward Super Saiyan burst, golden hold, aura fading and
calm golden hair. Transparent gutters, consistent boots/scale, no beam/props or
labels. Reverse playback restores black hair. The packer uses the actual new
gameplay idle for the resting pose so its start/end identity is exact.

Rebuild the reviewed production atlas:

```sh
python apps/client/scripts/pack-goku.py --write
python apps/client/scripts/test-goku.py
python apps/client/scripts/build-carry-anchors.py --character goku --check
```

Without `--write`, the packer exports a candidate/contact/GIF under `.agent/`.
It reuses the verified pose registration functions from the Naruto packer with
explicit Goku configuration; Naruto's registered output remains byte-identical.

At the same native height, median front chest silhouette width increased from
49 to 62 pixels (26.5%). Body height remains 148 with arena scale 0.15.
