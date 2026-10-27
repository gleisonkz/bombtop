# Goku Super Saiyan aura

Generated with built-in image_gen (transparent edit mode), without PixelLab. Selected source is source.generated.png; exact final prompt is prompt.txt. pack.py extracts and translates the generated drawings without resampling.

Production: apps/client/public/sprites/goku-ssj-aura.png and matching JSON. RGBA 1280x1280, 4x4 grid, sixteen distinct 320x320 frames, foot anchor (160,304), 20 fps. Intro 0-7, loop 8-15, release 7-0. JSON includes recommended uniform scale for the 104px A1 body. Draw behind the character; effect contains no character. Integrated only in menu and victory previews through ui/goku-aura-preview.ts; no arena/gameplay aura. The overlay copies the character CSS animation startTime, grows at hair-rise frame9, loops from18 to32, releases33-49 and hides from50 until the next transformation.

The GIF goku-aura-preview.gif is a composite demonstration with the existing Goku animation; the production atlas contains only the aura. Native frame crops, source crop coordinates and registration offsets are archived in frames/ and packing.json.
