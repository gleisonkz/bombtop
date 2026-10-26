# Approved Naruto redraw

Appearance master: approved-reference.png, explicitly selected by the user. Existing naruto.png supplied only poses and playback order. Seven image_gen generations received the real master PNG and the corresponding pose-guide PNG; matching idle/carry models also accompanied later generations. Raw outputs are preserved as *.generated.png. They contain 108 distinct poses and no baked-in ability effects.

Runtime atlas: 864x2304 RGBA; 9 columns, 18 rows; cells96x128; feet anchor(48,124). The order/counts remain4,4,4,6,6,6,6,7,9,9,9,4,4,4,6,6,6,8. Row17 is both menu and victory fallback. Enlarged transparent cells allow extended palms and falls without shrinking those animation families. All seven families use one fixed scale based on a109px initial standing pose, with no per-frame normalization. Arena bodyH109, scale.20366972 preserves the prior22.2px display height.

The packer detects actual alpha components rather than trusting requested grid positions, strips low-alpha generation fringe, preserves source colors and uses nearest-neighbor sampling. edge-cleanup.json records118 inspected exterior red-fringe corrections applied through PixelLab exact pixel tools and replayed with source hash/expected-color guards. Interior shading and all alpha remain unchanged by that cleanup. The uncorrected and remote-corrected tiles remain in edge96/.

Rebuild deterministically:

    python apps/client/scripts/pack-naruto-approved.py --contact --gif
    python apps/client/scripts/test-naruto-approved.py

Promote accepted output and refresh carry metadata:

    python apps/client/scripts/pack-naruto-approved.py --write
    python apps/client/scripts/build-carry-anchors.py --character naruto

palms.json stores the inspected visible palm centers for all30 carry frames. Runtime metadata, scoreboard crop, title bounds and ability muzzle offsets were updated with this atlas. Legacy reference-remake/ and pack-naruto.py remain historical reproduction assets; do not run their --write to replace this approved redraw.

Validation: native108-frame count, all frames distinct, empty trailing cells, true alpha, clean gutters, deterministic packing, no silhouette cropping; visual review of all generated directions and final endpoints. The client tests cover playback, head/bomb clearance and menu bounds.
