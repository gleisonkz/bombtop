# Goku gameplay and lobby transformation

Both gameplay and the lobby now use the broader pixel-art Goku documented in
`gameplay-redraw/README.md`. The lobby transformation was regenerated from the
actual new gameplay idle and locomotion family, with the older transformation
used only as a pose/storyboard reference.

Current transformation source: `gameplay-redraw/lobby-transform.generated.png`.
Measured source bounds, scale and provenance are recorded in
`gameplay-redraw/lobby-packing.json`. The original source is immutable.

The runtime asset is `apps/client/public/sprites/goku-lobby.png`: sixteen RGBA
cells of 128 × 207, feet anchor `(64,194)`, with approximately 142px standing
body height. The resting key pose uses the actual gameplay idle pixels;
the remaining seven key poses use one fixed scale for the new generated art.
No whole-image horizontal stretching or per-pose size normalization is used.

Playback indices remain `0,1,2,3,4,5,6,7,6,5,4,3,2,1,0,0`: power up from black
hair to golden Super Saiyan, then reverse to black and hold the resting pose.
These are eight distinct key poses in sixteen playback cells. Alpha gutters,
feet registration, hair transitions and exact loop closure are tested.

Rebuild from the repository root:

```sh
python apps/client/scripts/pack-goku-lobby.py --write
python apps/client/scripts/test-goku-lobby.py
```

The packer isolates source poses and aura seams before nearest-neighbor sampling,
following [Pillow image operations](https://pillow.readthedocs.io/en/stable/reference/Image.html).
The game continues to draw gameplay Kamehameha effects separately.

Earlier artwork remains archived: `lobby-transform-selected.source.png` is the
exact user-selected 1536 × 1024 supplied board from before the broader redraw.
Its SHA256 is `66EF9F40579DBB965A410CB6E1BFDFEDA4F7186DF2067A108B7627FD3498C7D9`.
The `lobby-hair-transform-candidate.png`, `lobby-transform-v2.source.png`,
`lobby-transform-v3.source.png` and `PROMPT-v3.md` record earlier candidates.
The old `build-goku-lobby.py` documents the original PixelLab workflow.
