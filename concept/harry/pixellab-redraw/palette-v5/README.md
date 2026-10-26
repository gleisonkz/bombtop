Palette refinement v5

Final outputs are harry.png, harry-lobby-pixellab.png and harry-victory-pixellab.png. The 124 occupied frames were extracted unchanged into eight 896x896 boards, mapped by PixelLab exact map_colors, and repacked at their original cell coordinates. Alpha and geometry are byte-identical. jobs.json records approved palette substitutions; chunks.json records cell provenance; pixellab-results.json records remote edit IDs.

These palette-v5 outputs are the final production pass after pack-harry-pixellab.py and integrate.py. If either older pipeline stage is rerun, copy these three finalized PNGs back to public/sprites and the corresponding candidate filenames, or replay the recorded palette pass on newly changed source art. Do not silently promote the older pre-palette candidates.
