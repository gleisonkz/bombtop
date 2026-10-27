# Detailed Goku aura in Thor/Captain sprite family

Built-in image_gen redrew the approved aura using actual captain.png/thor.png pixels and energy-effects-pixel.png for style. Original source.raw.png preserved; source.generated.png applies a single nearest-neighbor board fit and binary alpha threshold before frame registration. pack.py registers the16generated drawings at footanchor160,304. pixel-export.py exports fine160logicalpixel cells with one shared16colorpalette and nearest2x to320px. Intro/loop/release,20fps, menu/victoryonly, sharedcastbackdrop andnegativeaura layer preserved. Normal alpha compositing keeps darkamber outlines. No arena aura.

Production goku-ssj-aura-detailed.png and updated goku-ssj-aura.json. Prior aura versions retained. Exact imagegen prompt in prompt.txt.
