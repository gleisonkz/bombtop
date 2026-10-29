# Lantern head-edge audit

Read-only production audit. Coordinates and row/frame indices are zero-based. Atlas coordinate = (132*frame+x,164*row+y). Source SHA256 f7cd414a9a12596d28c4b6c101453a1a87ff7c3a37deec54d40f50d0f3c16ecc; 1188x2952 RGBA; 132x164 cells.

## Findings

Pale/gray crown and temple boundary pixels are present, especially idle c2/c3 and lobby c0/c6. All listed pixels are fully opaque, so these are baked RGB fringe, not partially transparent white matte. Walk c2 has cyan on the scalp boundary. Bright whites inside eyes and chest emblems are intentional and must be preserved.

The table lists selected boundary pixels for focused review, not an automatic deletion mask. Conservative correction: replace neutral fringe on the connected head contour with the existing dark outline sampled from the adjacent outline on the same frame; preserve occupied silhouette. Remove only demonstrably exterior protrusions after inspecting the crop. Walk r3c2 (32,56) is beside the ear and remains review-only, not a scalp correction. Cyan on the bald scalp at (95,31..33) is a stronger removal/correction candidate; do not globally remove green, white, or gray. Dark gray boundary colors below 100 remain review-only in boundary-candidates.json.

|row|frame|local x,y|atlas x,y|original RGBA|recommendation|
|---|---|---|---|---|---|
|0|2|57,14|321,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|76,14|340,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|77,14|341,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|78,14|342,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|79,15|343,15|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|80,15|344,15|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|81,15|345,15|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|86,19|350,19|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|87,20|351,20|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|93,28|357,28|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|94,31|358,31|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|95,33|359,33|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|95,34|359,34|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|2|96,47|360,47|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|57,14|453,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|76,14|472,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|77,14|473,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|78,14|474,14|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|79,15|475,15|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|80,15|476,15|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|81,15|477,15|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|86,19|482,19|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|87,20|483,20|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|93,28|489,28|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|94,31|490,31|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|95,33|491,33|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|95,34|491,34|(113, 108, 105, 255)|dark-outline correction preferred; removal only if exterior|
|0|3|96,47|492,47|(134, 130, 129, 255)|dark-outline correction preferred; removal only if exterior|
|3|2|95,31|359,523|(90, 186, 139, 255)|cyan scalp: inspect exterior removal; otherwise dark-outline correction|
|3|2|95,32|359,524|(90, 186, 139, 255)|cyan scalp: inspect exterior removal; otherwise dark-outline correction|
|3|2|95,33|359,525|(62, 97, 78, 255)|cyan scalp: inspect exterior removal; otherwise dark-outline correction|
|3|2|32,56|296,548|(62, 97, 78, 255)|cyan scalp: inspect exterior removal; otherwise dark-outline correction|
|17|0|77,18|77,2806|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|78,18|78,2806|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|79,18|79,2806|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|56,19|56,2807|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|57,19|57,2807|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|80,19|80,2807|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|81,19|81,2807|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|82,20|82,2808|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|87,23|87,2811|(124, 126, 124, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|89,24|89,2812|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|93,29|93,2817|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|96,35|96,2823|(124, 126, 124, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|97,37|97,2825|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|0|97,38|97,2826|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|5|95,29|755,2817|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|5|96,32|756,2820|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|6|57,18|849,2806|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|6|58,18|850,2806|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|6|55,19|847,2807|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|6|80,19|872,2807|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|6|81,19|873,2807|(134, 139, 137, 255)|dark-outline correction preferred; removal only if exterior|
|17|7|103,58|1027,2846|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|
|17|7|104,60|1028,2848|(124, 126, 124, 255)|dark-outline correction preferred; removal only if exterior|
|17|7|104,61|1028,2849|(124, 126, 124, 255)|dark-outline correction preferred; removal only if exterior|
|17|7|104,62|1028,2850|(124, 126, 124, 255)|dark-outline correction preferred; removal only if exterior|
|17|7|100,69|1024,2857|(112, 110, 108, 255)|dark-outline correction preferred; removal only if exterior|

## Pipeline

`build-character-sheet.py` green_iris explicitly writes white eyes (245,245,240) and white iris shine. no_blots targets two gray palettes within tolerance 6 and removes connected components of size >=3; isolated pixels survive. A glove-shade cleanup preserves regions near whites. This is selective blot cleanup, not general silhouette defringing. `build-lantern-paint-regions.py` produces recolor protection from skin silhouettes and checks source hash; it does not clean source alpha/RGB. No pipeline was executed against production.

## Scope and evidence

All 18 rows were scanned in existing HEAD_WINDOWS (108 occupied windows); light-pixels.json is an inclusive bright-neutral inventory (includes intentional eyes/logo), boundary-candidates.json is a 4-neighbor alpha-edge filter in upper 70% of those windows. This is a candidate detector, not proof of defect for every match. Three very bright neutral edge matches outside selection occur at r4c5 local(93,54), r15c1(95,51), r15c2(96,51), all RGBA(199,205,200,255); inspect profile-eye placement before changing these. No claim of full visual inspection of all 18 rows.

row-0-heads.png, row-3-heads.png, row-17-heads.png show original source on dark background at nearest-neighbor 2x. selected-detail.png shows each table location at 10x with magenta marking its center pixel. No corrected preview was produced and no production asset or metadata was edited.

Visual review of selected-detail.png confirms gray pixels interrupt black scalp outlines in idle c2/c3 and lobby c0/c6, with secondary fringe on lobby c5 right temple and c7 right ear. Treat ear-adjacent matches conservatively. Exact replacement RGB must be selected per contour segment; no universal replacement color is justified by this audit. Selection table totals: idle 28, walk 4 (3 scalp + 1 ear review), lobby 26. These are filtered matches, not exhaustive fringe counts.
