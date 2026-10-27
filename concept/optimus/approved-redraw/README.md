# Optimus Prime armored option 3

The user approved the rightmost detailed armored concept. approved-reference.png is its exact isolated crop. Every generated source received the actual reference pixels, and the old game atlas supplied pose/direction order only. idle/walk/reaction/carry-idle/carry-walk supply73 distinct non-special robot poses; fist supplies two celebration phases; truck supplies12 driving poses across right/front/rear views.

The additional user request for a natural special superseded crouch-only cast.generated.png. transform-raw.generated.png supplies articulated panel folding. transform.generated.png isolates the first three complete stages per direction, using component masks; the fourth column was excluded because complete-vehicle endpoints come from the actual truck sheet (one unused raw profile had a clipped bumper). transform-selection.json records this selection. All original pixels remain preserved in raw files.

The active109-slot gameplay atlas is2688x3808,12 columns by17 rows of224x224 cells, anchor(111.5,211), body164px. Wider cells preserve proportions rather than shrinking long poses. Carry and fist scaling use helmet-to-foot height, excluding the raised hand. Playback retains all original non-special frame counts. Special rows8/9/10 now have12 slots:

    idle, partial0, partial1, partial2, truck1, truck0,
    truck0, truck1, partial2, partial1, partial0, idle

This is deliberate mechanical reverse playback, not a claim of12 separately drawn transformation stages. Exact idle and truck endpoints prevent a different drawing at the state handoff. Runtime castWindup fits the first six phases into the existing12-tick windup; return uses the normal4-tick cadence. Truck scale.26 versus robot.134 is applied at packing to align the same vehicle art. No shared gameplay timing, hitboxes, movement or cooldown changed.

Truck remains512x288,128x96 cells, four frames per side/front/rear row. Menu/victory share the new16-frame5120x224 strip,320x224 cells, anchor(160,211). It composes the newly drawn robot/transform/fist poses and truck phases. Vehicle frames deliberately travel outside the card; frame8 is empty while off-card. No generation or builder adds smoke, glow, trails, energy or other FX.

Rebuild candidates and diagnostics:

    python apps/client/scripts/pack-optimus-approved.py --contact --gif
    python apps/client/scripts/test-optimus-approved.py

Promote accepted art and regenerate carry sockets:

    python apps/client/scripts/pack-optimus-approved.py --write
    python apps/client/scripts/build-carry-anchors.py --character optimus

The packer reuses existing offline component extraction (pack-naruto-approved.py) without mutating its globals. Reports store source hashes, actual component boxes, fixed scales, source/target anchors and menu provenance. Component masks exclude neighboring silhouettes even where bounding boxes overlap. Alpha is thresholded at128 and transparent RGB zeroed. No facial synthesis or per-frame normalization.

palms.json records50 inspected visible hand centers over30 carry frames. Integration refreshes the score portrait and native dimensions while preserving unrelated actors. Eye/window cyan is outside the armor recolor hue interval215-240; white/red players preserve the original outfit. The server's special behavior remains unchanged.
