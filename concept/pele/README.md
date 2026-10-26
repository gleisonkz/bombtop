# Pelé supplied sprite integration

Current source: the PNG inside the user's `pele_pixel_art_final.zip`, copied unchanged
to `supplied-final-atlas.png` (1024 × 1536 RGBA). The previous `supplied-atlas.png`
(802 × 1962) is retained as historical source. No new character artwork was generated.

Runtime: `apps/client/public/sprites/pele-final.png`, nine columns × eighteen rows of
160 × 160 cells. Anchor (80, 148), nominal body height 128, scale 0.16875: the same
approximately 21.6-pixel standing height as before. Characters retain their native
source resolution; the packer translates and isolates them without upscaling.

Rows 0–2 idle, 3–5 walk, 6 stunned hold, 7 side fall, 8–10 special, 11–13 carry idle,
14–16 carry movement, 17 seven-pose front celebration. Directional groups are
front/right/back. Lobby and victory use row 17, replacing the old separate lobby
art. The football projectile remains renderer-owned.

The source has eleven irregular rows. The packer selects connected silhouettes
from alpha >=128, retains their two-pixel edge fringe above alpha 16, and clears
unrelated low-alpha background haze. Native color/detail and proportions remain intact.
Four footballs touching boots are masked before isolation; disconnected balls are
excluded, leaving the existing live projectile as the sole football.

This source does not contain dedicated stun, front/rear kick or bomb-carry families.
Stun holds front neutral poses with the shared overhead stars. The side dribble
approximates the side kick, front gestures and rear idle are explicit special
fallbacks, and raised-arm poses support the held bomb. Side carry holds its one
raised-hand pose while translating. Repeated cells are intentional holds/recovery,
not newly drawn animation. The whole side fall and final corpse are preserved.
The seven-pose front celebration is used in the menu and victory preview.

```sh
python apps/client/scripts/pack-pele.py
python apps/client/scripts/test-pele.py
python apps/client/scripts/build-carry-anchors.py --check
```

The existing Pillow/SciPy asset pipeline performs RGBA isolation and compositing;
see [Pillow's Image reference](https://pillow.readthedocs.io/en/stable/reference/Image.html).
The exact runtime PNG and its source mapping are checked by the regression tests.
