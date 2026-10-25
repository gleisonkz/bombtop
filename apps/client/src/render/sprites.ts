import { BLAST_TICKS, blastLife, PATRONUS_FADE, TRUCK_SHIFT, TRUCK_TICKS, BUBBLE_TICKS, DIR_VECTORS, FUSE_TICKS, KAME_CHARGE, RASENGAN_TICKS, SHIELD_TICKS, type Blast, type Bomb, type Player, type Flame, FLAME_TICKS, TICK_RATE, TILE, ItemKind, Tile, type BombType, type Facing } from "@bombtop/shared";
import type { MascotView, Mood } from "../ui/art";

type Rgb = readonly [number, number, number];

/** One animation: a row of the sheet and how many frames it has. */
export interface Strip {
  row: number;
  frames: number;
}

/**
 * A lobby showpiece in an image of its own, one row of cells (scripts/build-lobby-image.py): its effects need bigger
 * cells than the arena's, and only the menus play it, so the sheet each menu preview paints stays small.
 */
export interface LobbyImage {
  url: string;
  width: number;
  height: number;
  frameW: number;
  frameH: number;
  anchorX: number;
  anchorY: number;
}

/** Where each animation sits on a character sheet (all frames are one fixed cell size). */
export interface SheetLayout {
  url: string;
  width: number;
  height: number;
  frameW: number;
  frameH: number;
  /** Cell pixel that sits on the player's position (between the feet). */
  anchorX: number;
  anchorY: number;
  /** Character height in pixels, to hold a bomb over its head. */
  bodyH: number;
  /** Where a bolt leaves the cast pose (sheet pixels from the anchor; `side` faces `side`). */
  muzzle?: Record<"down" | "side" | "up", readonly [number, number]>;
  /** Ticks each walk frame stays on screen. */
  ticksPerFrame: number;
  /** Ticks each idle frame stays on screen, when standing breathes slower than walking. */
  idleTicksPerFrame?: number;
  /** The sheet draws one side; the other one is mirrored. */
  side: "left" | "right";
  idle: Record<"down" | "up" | "side", Strip>;
  walk: Record<"down" | "up" | "side", Strip>;
  /** Arms-up rows for holding a bomb overhead, when the sheet has them. */
  carryIdle?: Record<"down" | "up" | "side", Strip>;
  carryWalk?: Record<"down" | "up" | "side", Strip>;
  /** Clothing colors, repainted in each player's color (base shade first). */
  clothes?: Rgb[];
  /** Or: a hue range (degrees) repainted in each player's color, for sheets without a fixed palette. */
  hues?: readonly [number, number];
  /** With `hues`: the body's base shade, which becomes exactly the player color (see shadeHues). */
  hueBase?: Rgb;
  /** Player colors the art already uses all over: those players keep the sheet's own colors instead. */
  keepFor?: readonly Rgb[];
  /** Hit reaction, shown facing the camera while stunned. */
  stun?: Strip;
  /** Played once when the player dies. */
  death?: Strip;
  /** A pose for the menus (lobby seats), facing the camera; in its own image when it has one (`row` is then that image's). */
  lobby?: Strip & { image?: LobbyImage };
  /** A pose for winning (the results' champion), when not the lobby's; facing the camera, in its own image when it has one. */
  victory?: Strip & { image?: LobbyImage };
  /** Casting the special, once per use (CAST_TICKS_PER_FRAME each frame). */
  cast?: Record<"down" | "up" | "side", Strip>;
  /** Drawn size relative to the sheet (big sheets are shrunk to the tile). */
  scale?: number;
}

const strips = (down: number, side: number, up: number, frames: number) => ({
  down: { row: down, frames },
  side: { row: side, frames },
  up: { row: up, frames },
});

/** Trial sheets (both CC0, see public/sprites/LICENSES.md). */
export const SHEETS = {
  foozle: {
    url: "sprites/foozle-legend.png",
    width: 1344,
    height: 4928,
    frameW: 64,
    frameH: 64,
    anchorX: 32,
    anchorY: 46,
    bodyH: 23,
    ticksPerFrame: 6,
    side: "right",
    idle: strips(0, 26, 51, 1),
    walk: strips(3, 29, 54, 8),
    carryIdle: strips(5, 31, 56, 1),
    carryWalk: strips(6, 32, 57, 8),
    clothes: [[82, 174, 35], [58, 123, 25], [4, 57, 31]],
  },
  james: {
    url: "sprites/james.png",
    width: 64,
    height: 128,
    frameW: 8,
    frameH: 16,
    anchorX: 4,
    anchorY: 15,
    bodyH: 17,
    ticksPerFrame: 8,
    side: "right",
    idle: { down: { row: 0, frames: 1 }, side: { row: 3, frames: 1 }, up: { row: 2, frames: 1 } },
    walk: strips(1, 3, 2, 4),
    clothes: [[235, 115, 201], [255, 173, 198]],
  },
  /** Captain America, made in PixelLab (scripts/build-character-sheet.py captain lays out its frames). */
  captain: {
    url: "sprites/captain.png",
    width: 1116,
    height: 2484,
    frameW: 124,
    frameH: 138,
    anchorX: 61,
    anchorY: 135,
    bodyH: 124,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The special: shield forward, he drops to one knee as it grows huge; the kneel holds while it is up. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** The navy suit and helmet (the carried bomb's blue-black stays). */
    hues: [200, 232],
    hueBase: [35, 56, 92],
    /** White would melt his suit into his stars, stripes and shield: that player keeps the navy. */
    keepFor: [[245, 245, 245]],
    scale: 0.17,
  },
  /** Thor (fan art), made in PixelLab (scripts/build-character-sheet.py thor lays out its frames). */
  thor: {
    url: "sprites/thor.png",
    width: 1260,
    height: 2628,
    frameW: 140,
    frameH: 146,
    anchorX: 71,
    anchorY: 143,
    bodyH: 124,
    /** The hammer's face in the thrust (the back view hides it: over his head). */
    muzzle: { side: [69, -73.5], down: [1, -30], up: [0, -93] },
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The special: hammer swung overhead, then thrust forward as the bolt leaves it. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Mjolnir raised, struck by lightning, crackling, then slammed down in a shockwave (scripts/build-thor-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/thor-lobby.png", width: 2880, height: 204, frameW: 180, frameH: 204, anchorX: 91, anchorY: 191 } },
    /** The navy armor (the silver helmet and chest discs sit just past it, at hue 229). */
    hues: [205, 226],
    hueBase: [47, 56, 73],
    /** White would melt his armor into his silver helmet and discs: that player keeps the navy. */
    keepFor: [[245, 245, 245]],
    scale: 0.17,
  },
  /** Goku (fan art), made in PixelLab (scripts/build-character-sheet.py goku lays out its frames). */
  goku: {
    url: "sprites/goku.png",
    width: 1314,
    height: 2862,
    frameW: 146,
    frameH: 159,
    anchorX: 71.5,
    anchorY: 153,
    bodyH: 148,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The Kamehameha: hands cupped at his hip while it charges, thrust forward as the beam leaves. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Powering up, a flash, Super Saiyan in a golden aura crackling with lightning, and back (scripts/build-goku-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/goku-lobby.png", width: 2048, height: 207, frameW: 128, frameH: 207, anchorX: 64, anchorY: 194 } },
    /** His hands at the thrust (the back view hides them: over his shoulders). */
    muzzle: { side: [46.5, -67.5], down: [2.5, -34], up: [0, -97] },
    /** The blue undershirt, sash, wristbands and boots (his orange gi is too close to his skin to repaint). */
    hues: [205, 235],
    hueBase: [8, 59, 137],
    scale: 0.15,
  },
  /** Naruto (fan art), made in PixelLab (scripts/build-character-sheet.py naruto lays out its frames). */
  naruto: {
    url: "sprites/naruto.png",
    width: 1188,
    height: 2952,
    frameW: 132,
    frameH: 164,
    anchorX: 66.5,
    anchorY: 159,
    bodyH: 158,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The Rasengan: dashing with his hand out, then the lunge as it strikes. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Shadow Clone Jutsu: a hand seal, two clones out of the smoke, poses, and back into smoke (scripts/build-naruto-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/naruto-lobby.png", width: 3296, height: 165, frameW: 206, frameH: 165, anchorX: 103.5, anchorY: 164 } },
    /** His hand in the lunge, where the Rasengan spins (the back view hides it: over his shoulders). */
    muzzle: { side: [49.5, -66.5], down: [0, -52.5], up: [0, -84.7] },
    /** The navy of his jacket, headband and sandals (his orange is too close to his skin to repaint). */
    hues: [205, 232],
    hueBase: [6, 42, 92],
    /** White would bleach his jacket: that player keeps the navy. */
    keepFor: [[245, 245, 245]],
    scale: 0.14,
  },
  /** Spider-Man (fan art), made in PixelLab (scripts/build-character-sheet.py spider lays out its frames). */
  spider: {
    url: "sprites/spider.png",
    width: 1170,
    height: 2898,
    frameW: 130,
    frameH: 161,
    anchorX: 64.5,
    anchorY: 155,
    bodyH: 152,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The web shot: hand pulled back, then thrust forward as the web leaves. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** A web shot up, yanked out of the card, swinging back in and landing crouched (scripts/build-spider-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/spider-lobby.png", width: 2880, height: 200, frameW: 180, frameH: 200, anchorX: 91, anchorY: 195 } },
    /** His thrust hand, where the web leaves (the back view hides it: over his shoulder). */
    muzzle: { side: [42.5, -74], down: [-8.5, -39], up: [0, -84.2] },
    /** The blue of his suit's sides and legs (his red is the suit itself). */
    hues: [205, 240],
    hueBase: [5, 89, 194],
    /** White would bleach his blue into his web lines, red would melt it into his suit: those players keep the blue. */
    keepFor: [[245, 245, 245], [232, 74, 74]],
    scale: 0.139,
  },
  /** Pikachu (fan art), made in PixelLab (scripts/build-character-sheet.py pikachu lays out its frames). */
  pikachu: {
    url: "sprites/pikachu.png",
    width: 1620,
    height: 2952,
    frameW: 180,
    frameH: 164,
    anchorX: 96,
    anchorY: 157,
    bodyH: 146,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The thunder shock: crouched gathering the charge, then arms flung out crackling. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** His blue scarf (his yellow fur, red cheeks and black ear tips stay his own). */
    hues: [205, 240],
    hueBase: [34, 82, 149],
    scale: 0.145,
  },
  /** Static (fan art), made in PixelLab (scripts/build-character-sheet.py static lays out its frames). */
  static: {
    url: "sprites/static.png",
    width: 2352,
    height: 3348,
    frameW: 168,
    frameH: 186,
    anchorX: 82,
    anchorY: 182,
    bodyH: 155,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The magnet pull: hands gathered at his chest, pushed out as the field leaves, then yanked back. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Sparks between his hands, a jump onto his flying manhole cover and a surf on it (scripts/build-static-lobby.py). */
    lobby: { row: 17, frames: 14 },
    /** His pushed-out hands, where the field leaves (the back view hides them: over his shoulders). */
    muzzle: { side: [59, -75], down: [2, -58], up: [0, -86.35] },
    /** His long blue coat. */
    hues: [200, 222],
    hueBase: [24, 61, 94],
    /** White would bleach his coat (and grey his hair): that player keeps the blue. */
    keepFor: [[245, 245, 245]],
    scale: 0.139,
  },
  /** The Flash (fan art), made in PixelLab (scripts/build-character-sheet.py flash lays out its frames). */
  flash: {
    url: "sprites/flash.png",
    width: 2880,
    height: 3024,
    frameW: 180,
    frameH: 168,
    anchorX: 91,
    anchorY: 161,
    bodyH: 157,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** The skid stop after his dash (the dash itself is instant). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Crackling, gone in a flash, streaking across and back, a skid and a thumbs up (scripts/build-flash-lobby.py). */
    lobby: { row: 17, frames: 16 },
    /** His red suit (the range wraps through 360; his yellow boots, belt and ear wings stay his own). */
    hues: [335, 12],
    hueBase: [210, 56, 53],
    /** White would bleach his whole suit (a ghost of the flash): that player keeps the red. */
    keepFor: [[245, 245, 245]],
    scale: 0.137,
  },  /** Bugs Bunny (fan art), made in PixelLab (scripts/build-character-sheet.py bugs lays out its frames). */
  bugs: {
    url: "sprites/bugs.png",
    width: 1098,
    height: 2952,
    frameW: 122,
    frameH: 164,
    anchorX: 64.5,
    anchorY: 161,
    bodyH: 155,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** Popping out of his tunnel (the dig itself is instant): squashed low, arms flung up, a hand over his brow. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Munching a carrot, then a wave. */
    lobby: { row: 17, frames: 8 },
    /** His blue scarf (his gray fur and white gloves stay his own). */
    hues: [195, 225],
    hueBase: [63, 122, 162],
    /** His tall ears take up a third of his height. */
    scale: 0.145,
  },
  /** The green lantern, John Stewart (fan art), made in PixelLab (scripts/build-character-sheet.py lantern lays out its frames). */
  lantern: {
    url: "sprites/lantern.png",
    width: 1170,
    height: 2898,
    frameW: 130,
    frameH: 161,
    anchorX: 67.5,
    anchorY: 157,
    bodyH: 150,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** Willing his bubble: the ring fist drawn to his chest, then thrust overhead (the bubble is its own art, BUBBLE). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Ring fist to the sky, then fists on his hips. */
    lobby: { row: 17, frames: 8 },
    /** His green suit and boots (his emerald irises sit past this range and keep their green). */
    hues: [100, 140],
    hueBase: [7, 180, 20],
    scale: 0.145,
  },
  /** Donatello (fan art), made in PixelLab (scripts/build-character-sheet.py donatello lays out its frames). */
  donatello: {
    url: "sprites/donatello.png",
    width: 1992,
    height: 2772,
    frameW: 166,
    frameH: 154,
    anchorX: 87.5,
    anchorY: 152,
    bodyH: 130,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 6 },
    /** Both hands on his bo, swept round him (the whirl itself is drawn by the renderer, spinLook). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Twirls his bo overhead, plants it and grins. */
    lobby: { row: 17, frames: 12 },
    /** His purple bandana and pads (his green skin, shell and staff stay his own). */
    hues: [250, 300],
    hueBase: [143, 33, 228],
    scale: 0.165,
  },
  /** Penelope Pitstop (fan art), made in PixelLab (scripts/build-character-sheet.py penelope lays out its frames). */
  penelope: {
    url: "sprites/penelope.png",
    width: 1656,
    height: 2686,
    frameW: 184,
    frameH: 158,
    anchorX: 87,
    anchorY: 156,
    bodyH: 148,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 5 },
    /** Blowing a kiss: a hand to her lips, then thrown out (the heart itself is drawn by the renderer, kissHearts). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** A touch-up in her compact mirror, powder, a fluff of her ponytail and a kiss blown at us (scripts/build-penelope-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/penelope-lobby.png", width: 2208, height: 154, frameW: 138, frameH: 154, anchorX: 64, anchorY: 154 } },
    /** A jump for joy, then a checkered race flag waved over her head, hearts floating up (scripts/build-penelope-victory.py). */
    victory: { row: 0, frames: 16, image: { url: "sprites/penelope-victory.png", width: 3200, height: 164, frameW: 200, frameH: 164, anchorX: 95, anchorY: 164 } },
    /** Her lips (the kiss leaves from them; the back view: over her head). */
    muzzle: { side: [30, -80], down: [0, -76], up: [0, -100] },
    /** Her pink helmet and suit (her blonde hair, white goggles, gloves and boots stay her own). */
    hues: [322, 348],
    hueBase: [235, 77, 133],
    scale: 0.145,
  },

  /** The pink panther (fan art), "Pink Panther HD 4" in PixelLab (scripts/build-character-sheet.py panther). */
  panther: {
    url: "sprites/panther.png",
    width: 1092,
    height: 2601,
    frameW: 156,
    frameH: 153,
    anchorX: 78.5,
    anchorY: 149,
    bodyH: 141,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** His tiptoe, paws before his chest: walked through while he sneaks out of sight (playerFrame's `sneaking`). */
    cast: strips(8, 9, 10, 6),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Tiptoeing in from the left, then a finger to his lips and a sly look (scripts/build-panther-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/panther-lobby.png", width: 4288, height: 150, frameW: 268, frameH: 150, anchorX: 134, anchorY: 149 } },
    /** His blue scarf (his pink fur, yellow eyes and nose stay his own). */
    hues: [182, 222],
    hueBase: [18, 178, 214],
    scale: 0.152,
  },

  /** Harry Potter (fan art), "Harry Potter HD v3b" in PixelLab (scripts/build-character-sheet.py harry). */
  harry: {
    url: "sprites/harry.png",
    width: 1368,
    height: 2856,
    frameW: 152,
    frameH: 168,
    anchorX: 78.5,
    anchorY: 164,
    bodyH: 157,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** Expecto patronum: the wand swung up, then thrust out (the stag is its own art, PATRONUS). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** His wand lit and swirled overhead, thrust out, and his stag galloping once round him (scripts/build-harry-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/harry-lobby.png", width: 4320, height: 171, frameW: 270, frameH: 171, anchorX: 135, anchorY: 157 } },
    /** A jump for joy, the golden snitch snatched out of the air and held up in his fist (scripts/build-harry-lobby.py). */
    victory: { row: 0, frames: 16, image: { url: "sprites/harry-victory.png", width: 4192, height: 200, frameW: 262, frameH: 200, anchorX: 131, anchorY: 200 } },
    /** The red lining of his robe (his blush and scar, a redder hue, stay his own). */
    hues: [1, 6],
    hueBase: [161, 45, 38],
    keepFor: [[232, 74, 74]],
    scale: 0.137,
  },
  optimus: {
    url: "sprites/optimus.png",
    width: 1566,
    height: 3094,
    frameW: 174,
    frameH: 182,
    anchorX: 90.5,
    anchorY: 169,
    bodyH: 164,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** Turning into his truck: down into a crouch, then (where it stopped) back up (the truck is its own art, TRUCK). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** His eyes flare, he bursts into his truck, which drives off the card and brakes back in, and he rises with his fist high (scripts/build-optimus-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/optimus-lobby.png", width: 5120, height: 182, frameW: 320, frameH: 182, anchorX: 160, anchorY: 166 } },
    /** His helmet, hands, thighs' plates and boots (the blue of his eyes and windows, a paler cyan, stay his own). */
    hues: [200, 240],
    hueBase: [5, 80, 174],
    keepFor: [[245, 245, 245], [232, 74, 74]],
    scale: 0.134,
  },


  pele: {
    url: "sprites/pele.png",
    width: 1098,
    height: 2839,
    frameW: 122,
    frameH: 167,
    anchorX: 61.5,
    anchorY: 154,
    bodyH: 152,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    death: { row: 7, frames: 7 },
    /** His kick: the leg drawn back, struck through, followed through high (the ball is its own art, BALL). */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    /** Keepy-uppy, the ball sent up and away, and his jump punching the air in a shower of confetti (scripts/build-pele-lobby.py). */
    lobby: { row: 0, frames: 16, image: { url: "sprites/pele-lobby.png", width: 4800, height: 230, frameW: 300, frameH: 230, anchorX: 150.5, anchorY: 226 } },
    /** His blue shorts (the CBF crest's blue goes with them). */
    hues: [205, 230],
    hueBase: [30, 72, 137],
    scale: 0.142,
  },

  /** The bomb mascot, a demolition trooper with an iron bomb for a head, drawn in code as pixel art (scripts/build-bomber.py). */
  bomber: {
    url: "sprites/bomber-atlas.png",
    width: 936,
    height: 2592,
    frameW: 104,
    frameH: 144,
    anchorX: 52,
    anchorY: 140,
    bodyH: 110,
    ticksPerFrame: 7,
    idleTicksPerFrame: 15,
    side: "right",
    idle: strips(0, 1, 2, 4),
    walk: strips(3, 4, 5, 6),
    stun: { row: 6, frames: 6 },
    /** He buckles, his visor goes dark, and he blows up. */
    death: { row: 7, frames: 7 },
    /** Planting the mega bomb: down on one knee with both hands pushed onto it, then up. */
    cast: strips(8, 9, 10, 9),
    carryIdle: strips(11, 12, 13, 4),
    carryWalk: strips(14, 15, 16, 6),
    lobby: { row: 17, frames: 8 },
    /** His armor plates (shoulders, vest, knees). */
    hues: [250, 290],
    hueBase: [106, 71, 145],
    /** White would bleach his armor into the steel round his head: that player keeps the violet. */
    keepFor: [[245, 245, 245]],
    scale: 0.2,
  },
} satisfies Record<string, SheetLayout>;

export type SheetName = keyof typeof SHEETS;

/** Bomb art (scripts/build-bombs-hd.py): one square cell per bomb type, side by side, on a 32-unit grid at 4 px per unit. */
export const BOMBS = {
  url: "sprites/bombs.png",
  stages: ["armed", "warning", "critical", "detonation-start"] as const,
  width: 384,
  size: 128,
  /** Cell pixel at the center of the bomb's body. */
  anchorX: 64,
  anchorY: 76,
  scale: 0.1,
  order: ["normal", "pierce", "remote"] satisfies BombType[],
  /** Cell pixel of the fuse spark (or the remote's light) and its glow color. */
  glow: {
    normal: { x: 100, y: 17, color: 0xffd23f },
    pierce: { x: 64, y: 20, color: 0xffd23f },
    remote: { x: 62, y: 10, color: 0xff3b3b },
  } satisfies Record<BombType, { x: number; y: number; color: number }>,
};

/** Left edge of a bomb type's cell. */
export const bombFrame = (type: BombType): number => BOMBS.order.indexOf(type) * BOMBS.size;

const SPARK = [1, 1, 0, 1, 0, 1, 1, 1, 0]; // irregular, like a burning fuse

/** How much bigger the bomb mascot's mega bomb is drawn. */
export const MEGA_SCALE = 1.6;

/**
 * How a bomb looks this tick: it breathes (squash and stretch), faster and
 * flashing red in its last second, while its spark (or remote light) flickers.
 * Timed by the remaining fuse, including remote bombs.
 */
export function bombLook({ fuse, tick, type, mega }: { fuse: number; tick: number; type: BombType; mega?: boolean | undefined }) {
  const urgent = fuse <= TICK_RATE;
  const stage = fuse <= Math.round(TICK_RATE * 0.3) ? "detonation-start" : urgent ? "critical" : fuse <= TICK_RATE * 2 ? "warning" : "armed";
  const breath = Math.sin((tick / TICK_RATE) * Math.PI * 2 * (urgent ? 5 : 2)) * 0.1;
  const size = mega ? MEGA_SCALE : 1;
  return {
    stage,
    sx: (1 + breath) * size,
    sy: (1 - breath) * size,
    tint: 0xffffff,
    flash: urgent && Math.floor((FUSE_TICKS - fuse) / 6) % 2 === 0,
    glow: type === "remote" ? Math.floor(tick / 20) % 2 === 0 : SPARK[Math.floor(tick / 3) % SPARK.length] === 1,
  };
}

/** The mascot (ui/art.ts SVG) as an arena character, rasterized at one pixel per SVG unit. */
export const MASCOT = {
  width: 100,
  height: 108,
  /** Between the feet. */
  anchorX: 48,
  anchorY: 104,
  /** Drawn size: the body comes out a bit under a tile wide. */
  scale: 0.21,
  /** Height to hold a bomb over, in SVG units. */
  bodyH: 100,
  deathTicks: 40,
  moods: ["happy", "wow", "sad"] satisfies Mood[],
};

/** Ticks per walk step: two steps cross a tile at base speed. */
export const MASCOT_STEP_TICKS = 8;

const VIEWS: Record<Facing, MascotView> = { down: "front", up: "back", left: "side", right: "side" };

/**
 * How the mascot stands this tick: it breathes while idle, steps its feet (bobbing
 * on the lifted steps) while walking, wobbles wide-eyed facing us while stunned, and
 * shows its face, back or side by where it is going (the side mirrored for left).
 */
export function mascotPose({ moving, stunned, facing, tick }: { moving: boolean; stunned: boolean; facing: Facing; tick: number }) {
  const t = (tick / TICK_RATE) * Math.PI * 2;
  const view = VIEWS[facing];
  const flip = facing === "left";
  if (stunned) return { sx: 1, sy: 1, dy: 0, rot: Math.sin(t * 4) * 0.3, flip: false, view: "front" as MascotView, step: 0, mood: "wow" as Mood };
  if (moving) {
    const step = Math.floor(tick / MASCOT_STEP_TICKS) % 4;
    const lifted = step % 2 === 1;
    return { sx: 1, sy: 1, dy: lifted ? -1.2 : 0, rot: lifted ? (step === 1 ? -0.04 : 0.04) : 0, flip, view, step, mood: "happy" as Mood };
  }
  const breath = Math.sin(t * 1.5) * 0.04;
  return { sx: 1 + breath, sy: 1 - breath, dy: 0, rot: 0, flip, view, step: 0, mood: "happy" as Mood };
}

/** The mascot `ticks` after dying: it floats up, squashed and fading; null once gone. */
export function mascotDeath(ticks: number) {
  if (ticks >= MASCOT.deathTicks) return null;
  const k = ticks / MASCOT.deathTicks;
  return { alpha: 1 - k * k, sx: 1 + k * 0.3, sy: 1 - k * 0.3, dy: -k * 10, mood: "sad" as Mood };
}

/** Explosion flames: rows of square cells per piece, one column per stage of the flame's life. */
export const FLAMES = {
  url: "sprites/flames.png",
  size: 128,
  frames: 5,
  rows: { center: 0, mid: 1, end: 2 },
  /** Drawn size: one cell per tile. */
  scale: 0.125,
};

export type FlamePiece = { kind: keyof typeof FLAMES.rows; rot: number };

/**
 * Which piece a flame tile shows, from its burning neighbours: the fireball where
 * arms meet (or a lone flame), arm segments between, and a tip at each arm's end.
 * Mid and end cells point right with the join on the left; `rot` turns them.
 */
export function flamePiece(burning: (x: number, y: number) => boolean, x: number, y: number): FlamePiece {
  const [l, r, u, d] = [burning(x - 1, y), burning(x + 1, y), burning(x, y - 1), burning(x, y + 1)];
  const q = Math.PI / 2;
  if ((l || r) === (u || d)) return { kind: "center", rot: 0 };
  if (l && r) return { kind: "mid", rot: 0 };
  if (u && d) return { kind: "mid", rot: q };
  return { kind: "end", rot: l ? 0 : r ? 2 * q : u ? q : -q };
}

/** Column of a flame `ttl` ticks from going out: flare, burn, die down. */
export function flameFrame(ttl: number): number {
  const age = 1 - ttl / FLAME_TICKS;
  return Math.min(FLAMES.frames - 1, Math.max(0, Math.floor(age * FLAMES.frames)));
}

/**
 * Arena art (scripts/build-tiles.py): one row of square cells. Grass has plain, flower and pebble variants per shade;
 * `burn` is a blown-up block burning away (struck, ablaze, breaking, collapsing, embers, ash), drawn over the grass.
 */
export const TILES = {
  url: "sprites/tiles.png",
  size: 128,
  /** Drawn size: one cell per tile. */
  scale: 0.125,
  cells: { grassA: [0, 1, 2], grassB: [3, 4, 5], block: 6, pillar: 7, border: 8, burn: [9, 10, 11, 12, 13, 14] },
};

/** Cell of a blown-up block whose flame goes out in `ttl` ticks: it burns away with it. */
export function burnCell(ttl: number): number {
  const { burn } = TILES.cells;
  const age = 1 - ttl / FLAME_TICKS;
  return burn[Math.min(burn.length - 1, Math.max(0, Math.floor(age * burn.length)))]!;
}

/** Which cell a tile shows. Grass variants are picked by a hash of the position, so they stay put. */
export function tileCell(tile: Tile, x: number, y: number, width: number, height: number): number {
  const { cells } = TILES;
  if (tile === Tile.Block) return cells.block;
  if (tile === Tile.Wall) return x === 0 || y === 0 || x === width - 1 || y === height - 1 ? cells.border : cells.pillar;
  const shade = (x + y) % 2 === 0 ? cells.grassA : cells.grassB;
  const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const roll = hash % 100;
  return shade[roll < 72 ? 0 : roll < 86 ? 1 : 2]!;
}

/** Walls and blocks stand up from the floor and shade the tile below them. */
export const castsShadow = (tile: Tile): boolean => tile === Tile.Wall || tile === Tile.Block;

/** Power-up art (scripts/build-items.py): one column per item, rows = plain, then a glint sweeping across. */
export const ITEMS = {
  url: "sprites/items.png",
  size: 192,
  frames: 4,
  /** Drawn a little smaller than a tile, so the floor shows around it. */
  scale: 0.0725,
  order: [
    ItemKind.Bomb,
    ItemKind.Fire,
    ItemKind.FullFire,
    ItemKind.Speed,
    ItemKind.Kick,
    ItemKind.Remote,
    ItemKind.Pierce,
    ItemKind.Punch,
    ItemKind.Glove,
    ItemKind.Skull,
    ItemKind.Egg,
  ] satisfies ItemKind[],
};

/** Left edge of an item's column. */
export const itemCell = (kind: ItemKind): number => ITEMS.order.indexOf(kind) * ITEMS.size;

const GLINT_EVERY = 3 * TICK_RATE;
const GLINT_TICKS_PER_FRAME = 4;

/** Row an item shows: plain most of the time, with a glint every few seconds, staggered by tile. */
export function itemFrame(tick: number, x: number, y: number): number {
  const t = (tick + x * 23 + y * 41) % GLINT_EVERY;
  const f = Math.floor(t / GLINT_TICKS_PER_FRAME) + 1;
  return f < ITEMS.frames ? f : 0;
}

/** Ticks each cast frame stays on screen: the cast lasts as long as its blast. */
export const CAST_TICKS_PER_FRAME = 4;

/** Ticks into the cast when the hands thrust forward and the beam shows. */
export const BEAM_DELAY = 20;

/** Opacity of a blast's beam `ticks` after the cast began. */
export function beamAlpha(ticks: number): number {
  if (ticks < BEAM_DELAY) return 0;
  return 1 - ((ticks - BEAM_DELAY) / (BLAST_TICKS - BEAM_DELAY)) * 0.8;
}

/** Ticks before a blast in which its cast already ran (Goku's charge, Naruto's dash). */
const WINDUP: Partial<Record<Blast["kind"], number>> = { kamehameha: KAME_CHARGE, rasengan: RASENGAN_TICKS, truck: TRUCK_SHIFT };

/**
 * Ticks into a player's cast animation: Goku's runs from the start of his Kamehameha's charge (the
 * beam leaves on the thrust frame, KAME_CHARGE in), Naruto's from the start of his Rasengan dash (it
 * strikes on the lunge frame), the bomb mascot's from when his mega bomb lands, Optimus's while he turns into his truck
 * (and on from TRUCK_SHIFT as he turns back where it stopped), the others' from their blast; undefined when not casting.
 */
export function castTicks(
  p: Pick<Player, "charge" | "rasengan"> & Partial<Pick<Player, "truck">>,
  blast: (Pick<Blast, "ttl" | "kind"> & Partial<Pick<Blast, "length">>) | undefined,
  mega?: Pick<Bomb, "fuse">,
): number | undefined {
  if (p.charge > 0) return KAME_CHARGE - p.charge;
  if (mega) return FUSE_TICKS - mega.fuse;
  if (p.rasengan > 0) return RASENGAN_TICKS - p.rasengan;
  if (p.truck && p.truck > TRUCK_TICKS) return TRUCK_SHIFT + TRUCK_TICKS - p.truck;
  if (!blast) return undefined;
  return (WINDUP[blast.kind] ?? 0) + blastLife({ kind: blast.kind, length: blast.length ?? 0 }) - blast.ttl;
}

/**
 * Goku's Kamehameha art (scripts/build-kamehameha.py): the ball of ki at his hands, the beam (tiles
 * seamlessly), and its head; FRAMES looping frames each, pointing right. Drawn one cell per tile.
 */
export const KAMEHAMEHA = {
  url: "sprites/kamehameha.png",
  size: 128,
  frames: 8,
  rows: { orb: 0, body: 1, head: 2 },
  scale: 0.125,
  /** The head's ball sits this far (in tiles) right of its cell's center. */
  headBall: 0.05,
};

export type KamePiece = { kind: keyof typeof KAMEHAMEHA.rows; x: number; y: number; rot: number };

/** Where the Kamehameha's pieces go for a beam from (x0,y0) to (x1,y1), `tile` pixels a tile. */
export function kameSegments(x0: number, y0: number, x1: number, y1: number, tile = 16): KamePiece[] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = len ? (x1 - x0) / len : 1;
  const uy = len ? (y1 - y0) / len : 0;
  const rot = Math.atan2(uy, ux);
  const parts: KamePiece[] = [{ kind: "orb", x: x0, y: y0, rot }];
  let t = tile / 2;
  for (; t <= len - tile / 2 + 1e-6; t += tile) parts.push({ kind: "body", x: x0 + ux * t, y: y0 + uy * t, rot });
  // a last piece flush with the head, so no gap is left before it
  if (len > tile && t - tile < len - tile / 2 - 1e-6) parts.push({ kind: "body", x: x1 - ux * (tile / 2), y: y1 - uy * (tile / 2), rot });
  const back = KAMEHAMEHA.headBall * tile;
  parts.push({ kind: "head", x: x1 - ux * back, y: y1 - uy * back, rot });
  return parts;
}

/**
 * Naruto's Rasengan art (scripts/build-rasengan.py): the spinning ball of chakra in his hand (looping)
 * and the burst where it strikes (played once).
 */
export const RASENGAN = {
  url: "sprites/rasengan.png",
  size: 128,
  frames: 8,
  rows: { orb: 0, burst: 1 },
  orbScale: 0.085,
  burstScale: 0.2,
  /** Ticks each burst frame stays on screen. */
  burstTicks: 2,
};

/**
 * What of Naruto's Rasengan shows, given his dash ticks left and his latest blast: the ball spinning
 * in his hand (a frame a tick) all through the dash, then the burst where it struck; null for nothing.
 */
export function rasenganLook(rasengan: number, blast: Pick<Blast, "ttl" | "kind"> | undefined): { orb: number } | { burst: number } | null {
  if (rasengan > 0) return { orb: (RASENGAN_TICKS - rasengan) % RASENGAN.frames };
  if (blast?.kind !== "rasengan") return null;
  const frame = Math.floor((BLAST_TICKS - blast.ttl) / RASENGAN.burstTicks);
  return frame < RASENGAN.frames ? { burst: frame } : null;
}

/** Flames without those inside a green lantern's bubble: the fire stops at it and goes on past it, drawn round it. */
export function outsideBubbles<F extends Pick<Flame, "x" | "y">>(flames: F[], players: readonly Pick<Player, "px" | "py" | "bubble" | "alive">[]): F[] {
  const inside = players.filter((p) => p.alive && p.bubble > 0).map((p) => `${Math.floor(p.px / TILE)},${Math.floor(p.py / TILE)}`);
  return inside.length ? flames.filter((f) => !inside.includes(`${f.x},${f.y}`)) : flames;
}

/** Flames without the Kamehameha's own fire along its beam (the beam is drawn over those tiles instead). */
export function outsideBeams<F extends Pick<Flame, "x" | "y" | "ownerId">>(flames: F[], blasts: readonly Blast[]): F[] {
  const beams = blasts.filter((b) => b.kind === "kamehameha");
  if (!beams.length) return flames;
  return flames.filter(
    (f) =>
      !beams.some((b) => {
        if (f.ownerId !== b.ownerId) return false;
        const [dx, dy] = DIR_VECTORS[b.dir];
        const i = dx ? (f.x - b.x) * dx : (f.y - b.y) * dy;
        return i >= 1 && i <= b.length && (dx ? f.y === b.y : f.x === b.x);
      }),
  );
}

/**
 * Where a bolt cast toward `dir` by a player standing at (cx,cy) starts: the sheet's muzzle (Thor's
 * hammer) placed like the sprite (anchor at cy + 6, mirrored when facing away from `side`), or else
 * 6 px in front of the tile's center.
 */
export function boltOrigin(sheet: SheetLayout | undefined, dir: Facing, cx: number, cy: number): [number, number] {
  const [dx, dy] = DIR_VECTORS[dir];
  if (!sheet?.muzzle) return [cx + dx * 6, cy + dy * 6];
  const view = dir === "left" || dir === "right" ? "side" : dir;
  const [mx, my] = sheet.muzzle[view];
  const flip = view === "side" && dir !== sheet.side ? -1 : 1;
  const s = sheet.scale ?? 1;
  return [cx + mx * s * flip, cy + 6 + my * s];
}

/**
 * Thor's lightning bolt from (x0,y0) to (x1,y1): a zigzag every ~6 px, at most 4 px off the
 * straight line. The same `seed` draws the same bolt; a new one every few ticks makes it crackle.
 */
export function boltPoints(x0: number, y0: number, x1: number, y1: number, seed: number): [number, number][] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.round(len / 6));
  const nx = len ? -(y1 - y0) / len : 0;
  const ny = len ? (x1 - x0) / len : 0;
  const pts: [number, number][] = [[x0, y0]];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const r = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const off = ((r - Math.floor(r)) * 2 - 1) * 4;
    pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
  }
  pts.push([x1, y1]);
  return pts;
}

/** How often a new ring of Static's magnet pull leaves the one pulled, and how long it takes to reach him. */
const MAGNET_WAVE_GAP = 5;
const MAGNET_WAVE_TICKS = 15;

/**
 * Static's magnet pull from (x0,y0) (him) to (x1,y1) (where it caught): rings of force, `age` ticks in,
 * running from the far end back to him and shrinking as they arrive (radius 7 px there, 2 px at his hand).
 */
export function magnetWaves(x0: number, y0: number, x1: number, y1: number, age: number): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < MAGNET_WAVE_TICKS / MAGNET_WAVE_GAP; k++) {
    const t = 1 - ((age + k * MAGNET_WAVE_GAP) % MAGNET_WAVE_TICKS) / MAGNET_WAVE_TICKS;
    out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, r: 2 + 5 * t });
  }
  return out;
}

/** How see-through the sneaking panther is to himself and to screens that only watch. */
export const SNEAK_FAINT = 0.35;
/** Ticks over which he fades back in for everyone before his tiptoe ends. */
const SNEAK_FADE = 30;

/**
 * How visible player `p` is on the screen of `viewer` (null: a screen that only watches, or several players at once):
 * a sneaking panther is gone for his rivals and faint for himself and for watchers, and fades back in at the end.
 */
export function sneakAlpha(p: Pick<Player, "id" | "sneak">, viewer: string | null): number {
  if (p.sneak <= 0) return 1;
  const back = Math.max(0, 1 - p.sneak / SNEAK_FADE);
  return viewer === null || viewer === p.id ? Math.max(SNEAK_FAINT, back) : back;
}

/** The green lantern's bubble (scripts/build-lantern-bubble.py): forming, held (a loop), giving way. */
export const BUBBLE = {
  url: "sprites/lantern-bubble.png",
  size: 192,
  rows: { form: 0, loop: 1, pop: 2 },
  frames: { form: 8, loop: 12, pop: 8 },
  /** Ticks each frame stays on screen. */
  ticks: 2,
  /** Drawn about 28 px across, round a player. */
  scale: 0.18,
};

/**
 * Ticks into a held pose, if any: the captain planted behind his shield, the green lantern kneeling with his ring up in his
 * bubble (only while he stands still: walking in it, he walks). Drawn with his cast row, held on its last frame.
 */
export function bracing(p: Pick<Player, "shield" | "bubble">, moving: boolean): number | undefined {
  if (p.shield > 0) return SHIELD_TICKS - p.shield;
  if (p.bubble > 0 && !moving) return BUBBLE_TICKS - p.bubble;
  return undefined;
}

/**
 * How the green lantern's bubble looks with `bubble` ticks left, at `tick`: forming as it rises, shimmering while held
 * (flickering in its last second), giving way over its last ticks; null with none.
 */
export function bubbleLook(bubble: number, tick: number): { row: number; frame: number; alpha: number } | null {
  if (bubble <= 0) return null;
  const { rows, frames, ticks } = BUBBLE;
  const age = BUBBLE_TICKS - bubble;
  if (age < frames.form * ticks) return { row: rows.form, frame: Math.floor(age / ticks), alpha: 1 };
  if (bubble <= frames.pop * ticks) return { row: rows.pop, frame: frames.pop - Math.ceil(bubble / ticks), alpha: 1 };
  const alpha = bubble <= TICK_RATE && Math.floor(tick / 4) % 2 === 0 ? 0.45 : 1;
  return { row: rows.loop, frame: Math.floor(tick / ticks) % frames.loop, alpha };
}

/**
 * Bugs' tunnel from (x0,y0) to (x1,y1), `age` ticks after he went under: a ridge of dirt mounds heaved up along it, one
 * every few pixels between the two holes, running ahead from where he went under faster than the eye can follow.
 */
export function tunnelMounds(x0: number, y0: number, x1: number, y1: number, age: number): { x: number; y: number; r: number }[] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = len ? (x1 - x0) / len : 0;
  const uy = len ? (y1 - y0) / len : 0;
  const mounds: { x: number; y: number; r: number }[] = [];
  for (let d = 7; d < len - 5 && d <= 7 + (age + 1) * 16; d += 6) {
    mounds.push({ x: x0 + ux * d, y: y0 + uy * d, r: 2.2 + ((d / 6) % 2) * 0.6 });
  }
  return mounds;
}

/**
 * Donatello's staff spin, `age` ticks in: his bo turning round him (two full turns, quick at first and slowing),
 * a whoosh ring swelling out from him and fading as the spin ends.
 */
export function spinLook(age: number): { angle: number; ring: number; alpha: number } {
  const t = Math.min(1, Math.max(0, age / BLAST_TICKS));
  return { angle: 4 * Math.PI * (1 - (1 - t) ** 2) + t * 0.5, ring: 10 + 10 * Math.sin(t * Math.PI * 0.75), alpha: 1 - t * t };
}

/** Ticks penelope's kiss takes to fly from her hand to where it stopped. */
const KISS_FLIGHT = 14;

/**
 * Penelope's blown kiss from (x0,y0) to (x1,y1), `age` ticks after it: a heart flying out (quick, then easing in,
 * bobbing up as it goes) with two little ones trailing, then a ring of little hearts bursting out where it landed and
 * fading with the blast. `size` is the heart's width in arena pixels.
 */
export function kissHearts(x0: number, y0: number, x1: number, y1: number, age: number): { x: number; y: number; size: number; alpha: number }[] {
  const at = (t: number) => {
    const e = 1 - (1 - Math.min(1, Math.max(0, t))) ** 2;
    return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e - Math.sin(e * Math.PI) * 3 };
  };
  if (age < KISS_FLIGHT) {
    const t = age / KISS_FLIGHT;
    return [
      { ...at(t), size: 7, alpha: 1 },
      { ...at(t - 0.18), size: 3.5, alpha: 0.7 },
      { ...at(t - 0.34), size: 2.5, alpha: 0.45 },
    ];
  }
  const t = Math.min(1, (age - KISS_FLIGHT) / (BLAST_TICKS - KISS_FLIGHT));
  const r = 4 + 9 * t;
  const hearts = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: x1 + Math.cos(a) * r, y: y1 + Math.sin(a) * r - 2 * t, size: 3.5, alpha: 1 - t };
  });
  return [{ x: x1, y: y1 - 3 * t, size: 7 + 3 * t, alpha: 1 - t }, ...hearts];
}

/**
 * Harry's patronus, a silver stag galloping (scripts/build-patronus.py): one row per view (side facing right, front
 * running at us, back running away), `frames` gallop frames each, its feet at (anchorX, anchorY) of a cell.
 */
export const PATRONUS = { url: "sprites/patronus.png", size: 96, frames: 8, rows: { side: 0, down: 1, up: 2 }, anchorX: 48, anchorY: 84, scale: 0.3 };
/** Ticks a gallop frame lasts. */
const PATRONUS_FRAME_TICKS = 3;

/**
 * Harry's stag from (x0,y0) to (x1,y1), running `dir`, `age` ticks after he cast it: a steady gallop there in `run`
 * ticks (bounding a little, its legs going round the gallop frames), a trail of sparkles behind it, then standing there
 * fading into light for PATRONUS_FADE ticks. Null once it is gone.
 */
export function patronusLook(x0: number, y0: number, x1: number, y1: number, dir: Facing, run: number, age: number):
  { x: number; y: number; alpha: number; flip: boolean; view: "side" | "down" | "up"; frame: number; sparkles: { x: number; y: number; size: number; alpha: number }[] } | null {
  if (age >= run + PATRONUS_FADE) return null;
  const at = (k: number) => {
    const t = run > 0 ? Math.min(1, Math.max(0, k / run)) : 1;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - Math.abs(Math.sin((k / (PATRONUS_FRAME_TICKS * PATRONUS.frames)) * Math.PI * 2)) * 2 };
  };
  const { x, y } = at(Math.min(age, run));
  const fading = Math.max(0, age - run) / PATRONUS_FADE;
  const sparkles = Array.from({ length: 5 }, (_, k) => {
    const back = at(Math.min(age, run) - 2 - k * 3);
    return { x: back.x, y: back.y + 3 + ((k * 5) % 4) - 2, size: 1.6 - k * 0.2, alpha: (1 - k / 5) * (1 - fading) };
  });
  const view = dir === "up" || dir === "down" ? dir : "side";
  const frame = Math.floor(Math.min(age, run) / PATRONUS_FRAME_TICKS) % PATRONUS.frames;
  return { x, y, alpha: 0.9 * (1 - fading * 0.9), flip: dir === "left", view, frame, sparkles };
}

/**
 * The hearts circling over the head of someone charmed by penelope's kiss, `charmed` ticks left: three of them going
 * round, offsets from the top of the head (the circle squashed, seen from above), each bobbing.
 */
export function charmHearts(charmed: number, tick: number): { dx: number; dy: number; size: number }[] {
  if (charmed <= 0) return [];
  return Array.from({ length: 3 }, (_, k) => {
    const a = tick / 9 + (k * Math.PI * 2) / 3;
    return { dx: Math.cos(a) * 7, dy: -3 + Math.sin(a) * 2.5 - Math.abs(Math.sin(tick / 6 + k)), size: 3.5 };
  });
}

/**
 * The flash's dash from (x0,y0) to (x1,y1), `age` ticks after it: speed lines side by side along it (the middle one
 * longest), from where he left to where he stopped, their tails catching up with him as they fade.
 */
export function speedLines(x0: number, y0: number, x1: number, y1: number, age: number): { x0: number; y0: number; x1: number; y1: number }[] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = len ? (x1 - x0) / len : 0;
  const uy = len ? (y1 - y0) / len : 0;
  return [-5, -2.5, 0, 2.5, 5].map((off, k) => {
    const tail = Math.min(len, age * 4 + Math.abs(off) * 3 + (k % 2) * 6);
    return { x0: x0 + ux * tail - uy * off, y0: y0 + uy * tail + ux * off, x1: x1 - uy * off, y1: y1 + ux * off };
  });
}

/**
 * The spiral of light round the captain while his shield is up (PixelLab VFX "Captain shield spiral",
 * laid out by scripts/build-captain-spiral.py): one row drawn behind him, one in front. The anchor is
 * the point between his feet, like the character sheets', and it is drawn at the captain's scale.
 */
export const SPIRAL = {
  url: "sprites/captain-spiral.png",
  width: 1608,
  height: 336,
  frameW: 134,
  frameH: 168,
  anchorX: 80,
  anchorY: 138,
  frames: 12,
  fps: 12,
  ticksPerFrame: 5,
  rows: { behind: 0, front: 1 },
} as const;

/** The spiral's frame `ticks` after the shield went up (it loops). */
export function spiralFrame(ticks: number): number {
  return Math.floor(ticks / SPIRAL.ticksPerFrame) % SPIRAL.frames;
}

/** Where players' feet stand, below the tile center. */
export const FEET_DY = 6;

/**
 * How a player caught in the spider's web looks: shaking as they struggle, the web flickering
 * in its last second as it comes loose. Null when not webbed.
 */
export function webbedLook(webbed: number, tick: number): { shake: number; wraps: boolean } | null {
  if (webbed <= 0) return null;
  const loosening = webbed <= TICK_RATE;
  return { shake: Math.floor(tick / 5) % 2 ? 0.75 : -0.75, wraps: !loosening || Math.floor(tick / 4) % 2 === 0 };
}

type Strand = [number, number, number, number];

/**
 * The web cocoon around a player whose drawn body is `bodyH` tall, and the strands wound round it
 * (x0,y0,x1,y1): a spiral, the turns in front all slanting one way and fewer seen through it behind, the other way.
 */
export function cocoon(cx: number, cy: number, bodyH: number): { x: number; y: number; w: number; h: number; strands: Strand[]; back: Strand[] } {
  const w = 14;
  const top = cy + FEET_DY - bodyH - 2;
  const h = bodyH + 4;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const strands: Strand[] = [];
  const back: Strand[] = [];
  for (let y = top + 2; y + 3 <= top + h - 1; y += 3) strands.push([x0, y + 3, x1, y]);
  for (let y = top + 3; y + 3 <= top + h - 1; y += 6) back.push([x0, y, x1, y + 3]);
  return { x: x0, y: top, w, h, strands, back };
}

export interface FrameRect {
  x: number;
  y: number;
  flip: boolean;
}

/** The sheet cell to draw for a player this tick. */
export function playerFrame(
  sheet: SheetLayout,
  {
    facing,
    moving,
    carrying,
    stunned,
    casting,
    shielding,
    sneaking,
    tick,
  }: { facing: Facing; moving: boolean; carrying: boolean; stunned?: boolean; casting?: number | undefined; shielding?: number | undefined; sneaking?: boolean; tick: number },
): FrameRect {
  if (stunned && sheet.stun) return cell(sheet, sheet.stun, Math.floor(tick / sheet.ticksPerFrame) % sheet.stun.frames);
  const view = facing === "left" || facing === "right" ? "side" : facing;
  const flip = view === "side" && facing !== sheet.side;
  // The pink panther's cast row is his tiptoe: walked through while he sneaks, its first frame while he stands.
  if (sneaking && sheet.cast && !carrying) {
    const strip = sheet.cast[view];
    return { ...cell(sheet, strip, moving ? Math.floor(tick / sheet.ticksPerFrame) % strip.frames : 0), flip };
  }
  if (sheet.cast && shielding !== undefined) {
    const strip = sheet.cast[view];
    return { ...cell(sheet, strip, Math.min(Math.floor(shielding / CAST_TICKS_PER_FRAME), strip.frames - 1)), flip };
  }
  const castCol = casting === undefined ? -1 : Math.floor(casting / CAST_TICKS_PER_FRAME);
  if (sheet.cast && castCol >= 0 && castCol < sheet.cast[view].frames) return { ...cell(sheet, sheet.cast[view], castCol), flip };
  const set = carrying && sheet.carryIdle ? (moving ? sheet.carryWalk! : sheet.carryIdle) : moving ? sheet.walk : sheet.idle;
  const strip = set[view];
  const per = !moving && sheet.idleTicksPerFrame ? sheet.idleTicksPerFrame : sheet.ticksPerFrame;
  const col = Math.floor(tick / per) % strip.frames;
  return { x: col * sheet.frameW, y: strip.row * sheet.frameH, flip };
}

const cell = (sheet: SheetLayout, strip: Strip, col: number): FrameRect => ({
  x: col * sheet.frameW,
  y: strip.row * sheet.frameH,
  flip: false,
});

/** The death frame `ticks` after dying, or null once it has played (or the sheet has none). */
export function deathFrame(sheet: SheetLayout, ticks: number): FrameRect | null {
  const strip = sheet.death;
  if (!strip) return null;
  const col = Math.floor(ticks / sheet.ticksPerFrame);
  return col < strip.frames ? cell(sheet, strip, col) : null;
}

/** Repaints a sheet's clothes (by palette or by hue) in a player's color, in place. */
export function paintSheet(px: Uint8ClampedArray, sheet: SheetLayout, to: Rgb): void {
  if (sheet.keepFor?.some((c) => c.every((v, i) => v === to[i]))) return;
  if (sheet.clothes) recolor(px, sheet.clothes, to);
  if (sheet.hues && sheet.hueBase) shadeHues(px, sheet.hues, sheet.hueBase, to);
  else if (sheet.hues) paintHues(px, sheet.hues, to);
}

const luma = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Repaints pixels of the `from` colors in `to`, in place. The first color maps to
 * `to` exactly; the others keep their brightness relative to it (shading survives).
 */
export function recolor(px: Uint8ClampedArray, from: readonly Rgb[], to: Rgb): void {
  const base = luma(from[0]!);
  const shades = from.map((c) => ({ c, k: luma(c) / base }));
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const hit = shades.find(({ c }) => c[0] === px[i] && c[1] === px[i + 1] && c[2] === px[i + 2]);
    if (!hit) continue;
    for (let ch = 0; ch < 3; ch++) px[i + ch] = to[ch]! * hit.k;
  }
}

/**
 * Repaints pixels whose hue lies in `range` (degrees) in `to`, by brightness relative to
 * `base`: the base shade becomes `to` exactly, darker shades darker, lighter ones toward white.
 * For smooth (anti-aliased, gradient) art, where exact palette matching can't work.
 */
export function shadeHues(px: Uint8ClampedArray, range: readonly [number, number], base: Rgb, to: Rgb): void {
  const ref = luma(base);
  eachColor(px, (c) => {
    const [h, s] = toHsl(c);
    if (s < 0.2 || !inHues(h, range)) return null;
    const k = luma(c) / ref;
    const shade = (v: number) => (k <= 1 ? v * k : v + (255 - v) * Math.min(1, (k - 1) * 0.8));
    return [shade(to[0]), shade(to[1]), shade(to[2])];
  });
}

/**
 * Repaints every opaque pixel by what `paint` makes of its color (null: left as it is), working each color out once:
 * pixel art repeats a few dozen colors over millions of pixels (a phone took seconds repainting the menus' sheets).
 */
function eachColor(px: Uint8ClampedArray, paint: (c: Rgb) => Rgb | null): void {
  const seen = new Map<number, Rgb | null>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const key = (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!;
    let out = seen.get(key);
    if (out === undefined) {
      out = paint([px[i]!, px[i + 1]!, px[i + 2]!]);
      seen.set(key, out);
    }
    if (!out) continue;
    px[i] = out[0];
    px[i + 1] = out[1];
    px[i + 2] = out[2];
  }
}

/**
 * Tells, frame by frame, whether each player is walking. A player counts as
 * walking for `hold` frames after its drawn position last changed, so frames
 * between two snapshots don't flash the idle pose.
 */
export class MotionTracker {
  private readonly seen = new Map<string, { x: number; y: number; left: number }>();

  constructor(private readonly hold = 8) {}

  moving(id: string, x: number, y: number): boolean {
    const last = this.seen.get(id);
    if (!last) {
      this.seen.set(id, { x, y, left: 0 });
      return false;
    }
    if (last.x !== x || last.y !== y) {
      Object.assign(last, { x, y, left: this.hold });
      return true;
    }
    if (last.left === 0) return false;
    last.left--;
    return true;
  }
}

/** Whether hue `h` lies in `range` (degrees); a range whose start is past its end wraps through 360 (reds). */
function inHues(h: number, range: readonly [number, number]): boolean {
  return range[0] <= range[1] ? h >= range[0] && h <= range[1] : h >= range[0] || h <= range[1];
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rr ? ((gg - bb) / d + 6) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Repaints pixels whose hue lies in `range` (degrees) in the hue and saturation of
 * `to`, in place, shifting lightness toward it so shading survives.
 */
export function paintHues(px: Uint8ClampedArray, range: readonly [number, number], to: Rgb): void {
  const [th, ts, tl] = toHsl(to);
  eachColor(px, (c) => {
    const [h, s, l] = toHsl(c);
    if (s < 0.2 || !inHues(h, range)) return null;
    const lit = Math.min(1, Math.max(0, l + (tl - 0.5) * 0.6));
    return fromHsl(th, s * ts, lit);
  });
}

interface Pos {
  px: number;
  py: number;
}

/**
 * Where to draw a player `alpha` of the way from one snapshot to the next. Past 1
 * (the next snapshot is late) a walk carries on; a jump of a tile or more between
 * snapshots is a teleport and stays where it landed.
 */
export function between(from: Pos, to: Pos, alpha: number): Pos {
  const jumped = Math.abs(to.px - from.px) + Math.abs(to.py - from.py) >= TILE;
  const a = alpha > 1 && jumped ? 1 : alpha;
  return { px: from.px + (to.px - from.px) * a, py: from.py + (to.py - from.py) * a };
}

/**
 * Optimus's truck (scripts/build-truck.py): one row per view, seen from the side (a flat profile facing right), its front
 * (coming down) and its back (going up), FRAMES frames driving each (the side's wheels turning, the cab rocking), its
 * wheels on the anchor's line.
 */
export const TRUCK = { url: "sprites/truck.png", w: 128, h: 96, frames: 4, rows: { side: 0, down: 1, up: 2 }, anchorX: 64, anchorY: 90, scale: 0.26 };
const TRUCK_FRAME_TICKS = 2;

/** The truck as he drives (null while he is not driving): the view his facing shows, and its driving frame. */
export function truckLook(p: Pick<Player, "truck" | "facing">, tick: number): { view: "side" | "down" | "up"; flip: boolean; frame: number } | null {
  if (p.truck <= 0 || p.truck > TRUCK_TICKS) return null;
  const view = p.facing === "down" ? "down" : p.facing === "up" ? "up" : "side";
  return { view, flip: p.facing === "left", frame: Math.floor(tick / TRUCK_FRAME_TICKS) % TRUCK.frames };
}

/** Pelé's soccer ball (scripts/build-ball.py): one 32 px frame, spun by the renderer. */
export const BALL = { url: "sprites/ball.png", size: 32, scale: 0.32 };
/** Ticks the ball takes per tile on its way (fast: a kick). */
const BALL_TICKS_PER_TILE = 1.5;

/**
 * Pelé's ball `age` ticks after the kick, from his feet (x0,y0) to where it stopped (x1,y1) `length` tiles off: flying
 * there in an arc, spinning, then dropping back a little off whatever stopped it, bouncing low, and fading out before
 * its blast is gone (null then). `lift`: how high it is (its shadow stays on the ground).
 */
export function ballLook(x0: number, y0: number, x1: number, y1: number, length: number, age: number): { x: number; y: number; lift: number; spin: number; alpha: number } | null {
  if (age >= BLAST_TICKS) return null;
  const flight = Math.max(4, length * BALL_TICKS_PER_TILE);
  const spin = age * 0.7;
  const alpha = Math.min(1, (BLAST_TICKS - age) / 10);
  if (age < flight) {
    const t = age / flight;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, lift: Math.sin(Math.PI * t) * (3 + length), spin, alpha };
  }
  // the rebound: back off what it hit, two low bounces
  const after = Math.min(1, (age - flight) / 14);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const back = 6 * after;
  return {
    x: x1 - ((x1 - x0) / len) * back,
    y: y1 - ((y1 - y0) / len) * back,
    lift: Math.abs(Math.sin(Math.PI * 2 * after)) * 3 * (1 - after),
    spin: flight * 0.7 + (age - flight) * 0.25 * (1 - after),
    alpha,
  };
}
