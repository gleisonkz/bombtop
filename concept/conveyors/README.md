# Approved conveyor atlas

`conveyor-concept.png` is the untouched approved 1254 × 1254 source. The packer
uses its actual pixels; it does not generate replacement artwork. Only cropping,
registration, seam blending, resizing, translation and rotation are performed.

## Runtime contract

- Output: `apps/client/public/sprites/conveyors.png`, RGBA, fully opaque,
  2048 × 512 pixels: 16 columns × 4 rows of 128 × 128 cells, without gutters.
- Rows: right, down, left, up. Down is clockwise 90°, left is 180°, and up is
  counterclockwise 90° from the right-facing cell of the same phase.
- Frame index: `floor(tick / 2) % 16`; one full tile of travel per 32 ticks.
- Each phase moves the rubber and its painted arrows exactly 8 native atlas
  pixels along the direction of travel. Metal rails stay fixed. Phase 15 to
  phase 0 is the same 8-pixel step as every other transition.
- Right-facing rails occupy rows `[0,14)` and `[114,128)`; moving rubber occupies
  `[14,114)`. Rails lie on the sides parallel to travel after rotation.
- Repeat using adjacent cells, with consistent global phase along each run.

## Exact source registration

All boxes are half-open Pillow `(left, top, right, bottom)` coordinates:

| Region | Source box | Destination size |
| --- | --- | --- |
| Upper stationary metal rail | `(20,113,1234,214)` | 128 × 14 |
| Moving rubber plus painted arrows | `(4,224,1250,1036)` | 128 × 100 |
| Lower stationary metal rail | `(20,1045,1234,1146)` | 128 × 14 |

The visible object is approximately `x=[0,1254), y=[103,1157)`. The inset crop
removes its black outer padding, rounded black rail corners and rubber edge
end treatment. Rail screws, metal weathering, rubber slats and painted arrows
come from the source. The separate region registration fills every runtime cell;
there is no transparent padding, black margin or transverse end cap.

Each region overlaps its final 128 source columns with its first 128 columns,
using a smoothstep crossfade. The unchanged middle is followed by this overlap,
so both joins retain adjacent source pixels. Rubber period: 1118 source pixels;
each rail period: 1086 source pixels. Three copies are tiled before Lanczos
reduction; the middle reduced copy is retained so filtering reads wrapped
neighbours at the period boundary. The reduced rubber is then translated with
integer wrapping. Rails use the same periodic preprocessing once and never move.

## Rebuild and verify

Run from `D:/Programação/Jogos/New folder/bombtop` with Python, Pillow and NumPy:

```powershell
python apps/client/scripts/pack-conveyors.py
python apps/client/scripts/test-conveyors.py
```

The unittest suite checks atlas geometry, opaque coverage, absence of black
padding, all 16 unique phases, exact uniform movement including loop closure,
stationary rails, periodic rail edge continuity, exact directional rotations,
deterministic rebuilding and equality with the saved runtime atlas.

`conveyor-preview.png` and `conveyor-preview.gif` show four contiguous tiles at
48 pixels per tile: right then left horizontal strips above down and up vertical
strips. The GIF follows phase order; its 30/30/40 ms frame quantization approximates
two ticks per frame at 60 Hz (530 ms total versus 533.3 ms in the runtime).
This is asset QA; runtime integration and application validation belong to the
coordinator.
