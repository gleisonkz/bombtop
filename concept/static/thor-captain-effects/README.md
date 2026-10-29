# Detailed Static electromagnetic effects

Built-in image_gen used actual Thor/Captain game sprites and game electric effects as style references. special.source.png contains12distinct drawings:4beam,4impact,4coils. charge.source.png contains16distinct drawings,8behind and8front. pack.py thresholds genuine alpha, measures charge rowgaps, registers footanchors, exports128pxcells and shared16colorpalettes. Production static-special-detailed.png512x384 and static-charge-detailed.png1024x256. Front torso corridor is empty in all8phases.

EnergyPixelEffects selects the new beam/impact/coils only for magnet and newpairedcharge only for Static. Thor/shock/ki/Pikachu textures remain on oldatlas. Position,size,pathreach,3ticksperframe,4specialphases,8bodyphases and gameplayduration unchanged. Missing optionalart falls back to the originalsharedatlas. Coloroverride andspritepooling preserved. Exact prompts archived in special-prompt.txt and charge-prompt.txt.
