# Super Choque approved option4 redraw

Appearance source: approved-reference.png, the user-selected PixelLab option4 (128x160). The prior game atlas supplied poses and playback order only. Actual appearance and pose-guide PNGs were attached to each generation. All107 final poses are newly generated in8 families. carry-walk.rejected-yellow-gloves.png is a rejected intermediate; the final carry-walk.generated.png corrects navy gloves to match the approved model.

Contract:19 rows,14 columns;168x224 cells;2352x4256 RGBA atlas; feetanchor82,208. Counts:4,4,4,5,4,5,6,7,6,7,4,4,4,4,6,6,6,10,11. The extra transparent height accommodates raised arms without shrinking the character. Every family uses a single fixed scale targeting a148px initial standing body. Victoryframe6 keeps its12px hop. Menu keeps the existing thin physical metaldisc, with soles in contact. No electricity, aura, particles, trails or ability effects are baked into character frames.

Measurements: measurements.json orders the two-row menu/victory source boards into their single runtime strips. report.json records source hashes, boxes, family scales, registered anchors and final frame hashes. All frames remain distinct. Extraction and alpha-component validation reuse pack-naruto-approved.py; registration and paint protection remain Static-specific and reuse pack-static.py protection generation.

Rebuild:

    python apps/client/scripts/pack-static-approved.py --contact --gif
    python apps/client/scripts/test-static-approved.py

Promotion:

    python apps/client/scripts/pack-static-approved.py --write

Copy its static-paint-regions.json into apps/client/src/render/static-paint-regions.json when promoting newly changed artwork. palms.json records the50 inspected glove support positions across30 carryframes; run build-carry-anchors.py --character static after a registered replacement. The original source and carry-redraw sources remain historical, and pack-static.py routes active builds here while integration.json exists.

Runtime registration, scoreboard portrait, title bounds, hand origins and image cache revision were updated only for Static. Brown skin, white goggles, headband and black hair remain protected; player recoloring affects the long bluecoat. Native bodyH148 and scale.14586486486486486 preserve21.588 worldpixels. Menu bodyH136 is based on first-frame boot highlights excluding the silverdisc.
