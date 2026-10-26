# Harry menu Patronus presentation

Historical pipeline. The active model-1 redraw and its clean gameplay, lobby and victory animations are documented in [pixellab-redraw/README.md](pixellab-redraw/README.md).

The old sixteen-frame menu strip made the stag orbit Harry in seven frames,
reversed its facing against its travel, hid it behind Harry, and removed it
abruptly. Changing the gameplay/guide Patronus source did not fix that baked strip.

The registered replacement is `apps/client/public/sprites/harry-lobby-patronus-v2.png`:
48 cells of 320 × 208, anchor (112, 194), 7 ticks per cell, 5.6-second loop.
`menu-source.png` preserves the original menu strip. Only its clean resting,
raising and casting cells (0–5) are used; the old orbit cells are never sampled.
The original `patronus.png` supplies eight right-facing gallop drawings.

Timeline:

- 0–3: quiet resting hold.
- 4–9: raise and prepare the wand.
- 10–13: gather light at the measured tip (117, 125).
- 14–20: resolve the stag at constant scale, muzzle/antlers then body/legs.
- 14–39: complete one smooth elliptical lap around Harry; side facing follows horizontal velocity.
- 21–33: continue the lap with Harry correctly in front on the far half and behind on the near half.
- 34–39: finish the lap while fading into particles from the actual silhouette.
- 36–38: two existing casting poses lower the arm into rest, without image blending or repeating the overhead flourish.
- 40–43: remaining particles fade locally.
- 44–47: clean resting hold; frame 47 is byte-identical to frame 0.

The 96px stag keeps its proportions, with a small uniform perspective scale
between 0.84 and 1.0. The orbit has horizontal radius 64, vertical radius 19.5,
center (112, 183.5), correct mirrored facing and depth layers. It remains inside
the canvas; the near half passes below Harry's face. Gameplay and snitch victory art
remain separate. Source characters are reused, not regenerated.

```sh
python apps/client/scripts/pack-harry-lobby.py
python apps/client/scripts/test-harry-lobby.py
pnpm -C apps/client test -- test/harry-menu-art.test.ts
```
