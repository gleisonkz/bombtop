# Goku lobby transformation

`lobby-transform-v3.source.png` is the current generated source (1266 × 1243).
The built-in image tool received `base-front-reference.png` as its sole visual
reference: the actual first 146 × 159 cell from `goku.png`, enlarged 4× with
nearest-neighbor sampling. The prompt preserves the original pixel treatment,
slender body, small face, orange/navy palette and chest badge.
See `PROMPT-v3.md` for the generation prompt and reproducible reference crop.

The runtime asset is `apps/client/public/sprites/goku-lobby.png`: 16 RGBA cells of
192 × 207, anchor (96, 194). The wider transparent cell fits the new aura at a
single 0.5 scale, retaining approximately 142px standing body height. Menu alpha
bounds are [32, 160); metadata and measured cast bounds match this export.
Frames 0–3 power up; 4–11 transform/hold; 12–14 return to normal;
15 deliberately holds the exact opening pose for the loop boundary.

Rebuild from the repository root:

```sh
python apps/client/scripts/pack-goku-lobby.py
python apps/client/scripts/test-goku-lobby.py
```

The packer applies a single scale to all poses, translates using measured boot
anchors, removes faint detached generation debris and isolates touching aura
seams. It does not redraw or recolor hair. The old `build-goku-lobby.py` documents
the original PixelLab source workflow and does not rebuild the current artwork.
`lobby-hair-transform-candidate.png` is the previous runtime source.
`lobby-transform-v2.source.png` was rejected for its smooth anime/chibi restyling
and is not used by the game. Gameplay still uses the original `goku.png`.

Pillow's [RGBA compositing and image resizing](https://pillow.readthedocs.io/en/stable/reference/Image.html)
guide the export: resize each frame separately with Lanczos before packing to
avoid mixing pixels across cells.
