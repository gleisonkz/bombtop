# Pelé option-4 independent visual QA

Reviewed actual carry-review.png, front-review.png, new raw cast-south and
cast-east contact sheet (qa/cast-rear-review.png), palm-review.png,
sheet-review.png and north-kick-review.png. The rejected ball cast in the old
front-review.png is excluded from acceptance.

Final-sheet verdict: ACCEPT WITH MINOR IDENTITY CONSISTENCY NOTE. No visible
clipped anatomy, foreign props or baked ball in the final cast sequences.
North kick has readable leg extension and preserves the rear silhouette.
Face, hair, yellow shirt, blue shorts, socks and shoes remain recognizable
across the selected poses. Carry poses have open raised hands and no baked
carried object. Static frame inspection does not certify runtime playback.

Minor note: the shirt back has no number in idle-north, walk-north and
cast-north; carry-north has a clear 10. This is a visible cross-action costume
inconsistency, not a registration/clipping blocker. CarryWalk-south/04 also
changes to a pursed-mouth expression, while retaining the character identity.

Palm registration: 30 poses, 50 measured centers, frameW/frameH 192, raw
128x160 at (32,16). Rows 11/12/13 use idle 00..03; rows 14/15/16 use walk
01..06. South/north register two palms, east only the visible right hand.
Pink-center overlay reviewed for every selected pose. Detection is bounded
to inspected hand interiors and measures brown skin; sources are not edited.
qa/palm-measurements.json records individual source SHA-256, selected source
index, alpha bounds, centers and local 5x5 skin occupancy. Script can run
without any packed candidate present.

Only measure-palms.py, palms.json, palm-review.png and qa/ were written by
this independent QA task. Coordinator owns runtime integration and playback.
