# Ground effects

Original AI artwork generated with the built-in image generator, referencing the implemented armed bomb and the original gameplay screenshots.

`portal-source.png`: six teleport vortex phases in the upper band (y=0..406). The unused lower row was an initial hover-pad concept and is deliberately excluded.

`protection-source.png`: six rose armor-ring phases with a gold shield and transparent center. This indicates a mounted player's extra hit, not teleportation.

Rebuild using `python apps/client/scripts/pack-ground-effects.py`. The export is RGBA, 768×256, six columns and two rows of 128×128 cells: warp then protection. Each family uses one fixed scale, centered anchors and source-spacing correction. Low-alpha generation haze is discarded during packing. Runtime draws 14 world pixels, changes phase every eight ticks, isolates texture cells and clamps sampling.

Check using `python apps/client/scripts/test-ground-effects.py`.
