# Selection/lobby head audit — worker

Root: `D:/Programação/Jogos/New folder/bombtop`.
Read-only production audit; all generated analysis is confined to this directory.

## Verified coverage

16 characters, 376 occupied frames, 23 PNG assets. Goku and Lantern excluded.
All idle.down (4), stun (6), lobby frames and all configured separate victory frames inspected visually, plus 8-connected actual-alpha component analysis.
Characters: Bomber, Captain, Thor, Naruto, Spider, Pikachu, Static, Flash, Bugs, Donatello, Penelope, Panther, Harry, Optimus, Pele, Lula.
Source consumer: `apps/client/src/ui/lobby.ts:237`: disconnected => dizzy; easy bot => idle; otherwise walk. `ui/sheet-art.ts` maps walk to lobby and uses own-image overrides. Bomber uses `bomber-menu-atlas.png`, at 208x288 cells, rather than arena atlas. Contact sheets use native source pixels with nearest-neighbor display.

All coordinates below are zero-based; boxes are [left,top,right,bottom), relative to the frame. Sheet offsets given separately.

## Suspicious pixels

1. `apps/client/public/sprites/spider.png`, stun/dizzy row 6, frame 0, 130x161: opaque grey 4-pixel detached component [17,98,19,100), RGBA (90,106,129,255). Sheet box [17,1064,19,1066). Visually a square floating well left of the glove, not a head effect or connected outline. Strong cleanup candidate. Evidence: `isolates-0.png`, first panel; full context `spider-all.png`.
2. `apps/client/public/sprites/panther-lobby.png`, 224x224, row 0, frames 4,5,6: detached jaw/neck outline at [97,116,99,117) (2 pixels) and [101,119,102,120) (1 pixel). Below left jaw, separated from both jaw and neck; suspicious clipping residue. Sheet x offsets respectively 896,1120,1344: first boxes [993,116,995,117), [1217,116,1219,117), [1441,116,1443,117); second points (997,119), (1221,119), (1445,119). Evidence: `isolates-1.png`, panels 4,5,6. Whisker-side components in these same frames [136,115,137,116) and [138,116,139,117) align with whiskers; do not delete automatically.
3. `apps/client/public/sprites/panther.png`, stun row 6, frame 2, 224x224: detached 2-pixel dark outline [105,114,107,115), directly below jaw, next to neck. Sheet box [553,1458,555,1459). Same neck-remnant concern, less conclusive than Spider. Evidence `isolates-0.png`, panel 6.

## Preserve / non-findings

- Panther detached eyebrow islands: idle f2/f3 [101,80,108,85), stun f3 [102,94,109,99), stun f5 [95,79,103,83). Visually intentional expressive eyebrows. Detached components at whisker tips across idle/lobby/stun align with whiskers; preserve unless manually redrawing continuity. `isolates-0/1/2.png`.
- Bugs idle f3 [79,97,80,99), lobby f4 [80,88,82,90): tiny dark components extend left lower whisker. Preserve as intentional whisker detail. `isolates-0.png`, panels 2/3.
- Thor lobby f8/f9/f11 disconnected pieces are cyan lightning and brown ground-impact debris, consistent with animation; preserve. `thor-all.png`.
- Optimus lobby f7 [316,99,320,109): detached truck exhaust tip at right edge during intentional exit, not head residue. Preserve. `isolates-2.png`, panel 3 and `optimus-all.png`.
- Bomber has many alpha=1/2 islands and antialiased edges from HD art. No visible white/brown head remnant in all 18 reviewed cells. Avoid blanket alpha/component cleanup because it would affect legitimate flame/glow and smooth edges.
- Other than Bomber, all reviewed alpha pixels are exactly 0 or 255. No semitransparent matte. No visible detached head remnants/white edge matte in Captain, Thor, Naruto, Pikachu, Static, Flash, Donatello, Penelope, Harry, Pele, Lula. Their legitimate bright hair, helmet wings, goggles and gloves remain intentional.

## Evidence and limits

`alpha-report.json`: per-frame cell/row/source, alpha bounds, partial-alpha counts and component bounding boxes.
`source-hashes.json`: SHA-256 of the 23 inspected sources.
`*-all.png`: all reviewed cells, labelled by zero-based pose/frame. Page files `*-0.png`, etc. retain larger previews.
This is source-art analysis, not a browser render or recolor execution; no application/browser shared state used. No production files changed. No global component-removal recommendation.
