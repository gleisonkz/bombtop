"""Builds a character sheet (SHEETS.<name> in render/sprites.ts) from its PixelLab animation frames:
  ninja: sprites/ninja.png, character "Ice ninja HD4" (180px canvas; cast = the ice cast posed from our own
    skeletons with the ice drawn over it by build-ninja-cast.py; carry walk posed from our own skeletons, carry idle =
    its standing frames; lobby = the v3 "hand seal" frames 1..8)
  captain: sprites/captain.png, character "Captain America HD" (180px canvas; "Carry" state too); then run
    lock-walk-head.py captain: the template side walk redrew his head on every frame (it wobbled, the jaw changed)
  goku: sprites/goku.png, character "Goku HD" (180px canvas; cast = Kamehameha and carry walk posed from our own
    skeletons; lobby = the v3 "victory pose" frames 1..8). PixelLab drew a glow at his hands in the side
    thrust: that view holds its clean last frame. The hands in the side and front thrust are the "muzzle".
  thor: sprites/thor.png, character "Thor HD" (180px canvas; cast and carry walk posed from our own skeletons;
    the back view comes from a second "Thor HD", made in v3 from the first's south/east/west, whose cape
    covers his back (the first one's hung in front of him),
    carry idle = the carry walk's standing frames, lobby = the v3 "victory pose" frames 1..8).
    PixelLab drew sparks round the thrust hammer that clash with the game's own bolt: the thrust holds its
    first frame (clean in front and back; in the side view cut off at the hammer's face). The hammer's
    face in the side and front thrust frames is printed as "muzzle" (from the anchor) for the bolt to leave from.
  naruto: sprites/naruto.png, character "Naruto HD" (180px canvas; Rasengan dash and carry walk posed from our own
    skeletons, 6 frames each: 3 running with his hand out, 2 lunging, 1 settling; carry idle = the carry walk's
    standing frames; lobby = the v3 "victory pose" frames 1..8). The breathing idle blew puffs of breath in the side
    view and shut his eyes in front: idle front and side are his rotation ("rot/<dir>.png") bobbing a pixel instead.
    The hand in the side and front lunge is the "muzzle" (where the Rasengan spins).
  spider: sprites/spider.png, character "Spider-Man HD" (180px canvas, chibi proportions per concept/PROMPT-BASE.md;
    cast = the web shot and carry walk posed from our own skeletons, 6 frames each; carry idle = the carry walk's
    standing frames; lobby = the v3 "victory pose" frames 1..8). PixelLab drew a web strand off the side thrust: the
    thrust holds its clean first frame (the game draws the web). The thrusting hand is the "muzzle".
  pikachu: sprites/pikachu.png, character "Pikachu HD v3" (a v3 rotation of "Pikachu HD"'s front, whose own side view
    mixed his back into a side head; the front rows come from "Pikachu HD", the same drawing). cast = the thunder shock
    and carry walk posed from our own skeletons, 6 frames each (crouch gathering the charge, then arms flung out
    crackling); carry idle = the carry walk's standing frames; lobby = the v3 "victory pose" frames 1..8. Idle side and
    back are his rotation bobbing (the breathing template puffed breath and shut his eye); the stun skips frame 3 (a
    grey smudge).
  static: sprites/static.png, character "Static Shock HD v3" (a v3 rotation of "Static Shock HD 2"'s front, side and side
    mirrored, for a back view: the first drew his front twice). cast = the magnet pull and carry walk posed from our own
    skeletons, 6 frames each (the back view only gathering: see STATIC_CAST_UP) (hands gathered at his chest, both pushed out ahead as the field leaves, fists yanked back
    pulling the catch in); carry idle = the carry walk's standing frames; lobby = 14 poses from our own skeletons
    ("lobby14": charging sparks, jumping, surfing with arms spread) that build-static-lobby.py lifts onto his flying
    disc (FRAMES_DIR/lobby). His pushed-out hands are the "muzzle".
  flash: sprites/flash.png, character "Flash HD" (180px canvas). cast = the skid stop after his dash, posed from our own
    skeletons (crouched, leaning back, arms flung out, then up again): the dash itself is instant, so the row starts
    skidding (FLASH_CAST); carry walk posed from our own skeletons (the back view from a second try, "carry-walk-n":
    the first turned him to face us), carry idle = its standing frames; lobby = 6 south and 5 sprinting east poses from
    our own skeletons ("lobby6", "lobby5") that build-flash-lobby.py turns into his streak across the card (FRAMES_DIR/lobby).
  bugs: sprites/bugs.png, character "Bugs Bunny HD v3" (a v3 rotation of "Bugs Bunny HD"'s front, whose own side and back
    views were his front again; front walk, stun, death and lobby from "Bugs Bunny HD"). Idle = the still rotation bobbing
    (the breathing template shut his eyes); cast = popping out of his tunnel (squashed low, arms flung up, a hand over his
    brow looking round) and carry walk posed from our own skeletons ("cast6": the side view's first frame came out
    smudged, BUGS_CAST_SIDE skips it); lobby = a v3 animation munching a carrot ("lobby9", its first frame the rotation).
  lantern: sprites/lantern.png, character "John Stewart HD v3" (180px canvas; "John Stewart HD 2"'s
    rotations with the face repainted: green eyes, a serious mouth). Its eyes were painted whole green; every frame gets
    them white with a green iris (green_iris), as in the cartoon, and loses the gray blots PixelLab left in some (no_blots).
    Idle front = the still rotation bobbing (the breathing template shut his eyes); the back cast holds its first frames
    (LANTERN_CAST_UP: PixelLab turned him to face us once his fist went up). cast = willing his bubble (down on one knee, the
    ring fist thrust high, "kneel"), posed from our own skeletons like the carry walk (LANTERN_CAST); the
    bubble itself is build-lantern-bubble.py's art; lobby = a v3 animation, ring fist raised ("lobby9").
Frames come on different canvas sizes, so each row is aligned by the feet of its first frame
(standing pose) to one baseline, centered, and every cell is cropped to the union of what is drawn.
Usage: python build-character-sheet.py ninja|captain|thor|goku|naruto|spider|pikachu|static|flash|bugs|lantern FRAMES_DIR public/sprites/<name>.png
  FRAMES_DIR holds <animation>/<direction>/<i>.png as downloaded from PixelLab."""
import colorsys, json, sys
import numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage

# (sheet row name, animation folder, direction, frames)
CHARACTERS = {
    "ninja": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "castice", "south", 9), ("cast.side", "castice", "east", 9), ("cast.up", "castice", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = raising the shield (skeleton-posed brace); "up" is the back view without the shield, the
    # renderer draws the big shield in front of him.
    "captain": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = hammer swung overhead, then thrust forward as the bolt leaves it (frame 5, BEAM_DELAY)
    "thor": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = Kamehameha: hands cupped at his hip while it charges, thrust forward as the beam leaves (frame 5)
    "goku": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = Rasengan: dashing with his hand out (frames 0-2, RASENGAN_TICKS), the lunge as it strikes (3+)
    "naruto": [
        ("idle.down", "idle-rot", "south", 4), ("idle.side", "idle-rot", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = the web shot: hand pulled back (frames 0-4), thrust forward as the web leaves (frame 5, BEAM_DELAY)
    "spider": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = the thunder shock: crouched gathering the charge (cells 0-4), arms flung out as it bursts (cell 5, BEAM_DELAY)
    "pikachu": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle-rot", "east", 4), ("idle.up", "idle-rot", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = the magnet pull: hands gathered (cells 0-4), pushed out as the field leaves (cell 5, BEAM_DELAY), yanked back
    "static": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 14),
    ],
    # cast = the skid stop after the dash (FLASH_CAST)
    "flash": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 16),
    ],
    # cast = popping out of his tunnel (BUGS_CAST): the dig is instant, so the row starts as he comes up
    "bugs": [
        ("idle.down", "idle-rot", "south", 4), ("idle.side", "idle-rot", "east", 4), ("idle.up", "idle-rot", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = willing his bubble: down on one knee, the ring fist thrust high (LANTERN_CAST); held while he stands in it
    "lantern": [
        ("idle.down", "idle-rot", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
}
BASE = 400
LUNGE = 3  # naruto: first cast frame of the lunge
CAST6 = [0, 1, 2, 3, 3, 3, 4, 4, 5]  # naruto: his 6 posed cast frames spread over the 9 cast cells
BOB = [0, 0, 1, 1]  # naruto: idle breathing from a still rotation, pixels down  # work canvas size, feet baseline at BASE * 0.75
THRUST = 5  # thor: first cast frame with the hammer thrust forward (BEAM_DELAY / CAST_TICKS_PER_FRAME)


def feet(im):
    """Lowest drawn row of a frame."""
    a = im.getchannel("A")
    bb = a.point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    """Middle of the body's widest solid columns: thin parts (the katana hilt) don't pull it off center."""
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def silver(p):
    """The hammer head's grey: opaque, light, unsaturated (the sparks are tinted blue)."""
    r, g, b, a = p
    return a > 200 and max(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 40


def hammer_face(im):
    """Side view: the rightmost column holding 8+ silver pixels (the hammer's face), and those pixels' rows."""
    px = im.load()
    for x in range(im.width - 1, -1, -1):
        ys = [y for y in range(im.height) if silver(px[x, y])]
        if len(ys) >= 8:
            return x, ys
    raise ValueError("no hammer face")


def hammer_face_cut(im):
    """Side view: erase everything past the hammer's face, sparks included."""
    edge = hammer_face(im)[0]
    px = im.load()
    for y in range(im.height):
        for x in range(edge + 1, im.width):
            px[x, y] = (0, 0, 0, 0)
    return im


def thor_cast(folder, d, frames):
    if folder != "cast":
        return frames
    thrust = hammer_face_cut(frames[THRUST]) if d == "east" else frames[THRUST]
    return frames[:THRUST] + [thrust.copy() for _ in frames[THRUST:]]


def ki_blue(im):
    """The ki PixelLab drew at his hip while charging is yellow: turn it the game's Kamehameha blue."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if 45 <= h * 360 <= 70 and l > 0.6:
                r, g, b = colorsys.hls_to_rgb(195 / 360, l, s)
                px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)
    return im


def goku_cast(folder, d, frames):
    if folder != "cast":
        return frames
    if d != "east":
        return frames[:THRUST] + [frames[THRUST].copy() for _ in frames[THRUST:]]
    return [ki_blue(f) for f in frames[:THRUST]] + [frames[-1].copy() for _ in frames[THRUST:]]


def skin(p):
    r, g, b, a = p
    return a > 200 and r > 190 and r - b > 40 and g > 120


def hands_side(im):
    """Side view: the tip of his outstretched hands (rightmost opaque pixel in the middle band) and its row."""
    px = im.load()
    band = range(int(im.height * 0.4), int(im.height * 0.75))
    for x in range(im.width - 1, -1, -1):
        ys = [y for y in band if px[x, y][3] > 128]
        if ys:
            return x + 1, sum(ys) / len(ys)
    raise ValueError("no hands")


def hands_front(im):
    """Front view: the bottom middle of the skin pixels in the body's middle band (his hands at his chest)."""
    px = im.load()
    pts = [(x, y) for y in range(int(im.height * 0.4), int(im.height * 0.75)) for x in range(im.width) if skin(px[x, y])]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs) + max(xs) + 1) / 2, max(ys) + 1


def silver_box(im):
    """Bounding box of the hammer head's grey (low saturation, light) pixels below the face."""
    px = im.load()
    pts = []
    for y in range(im.height // 2, im.height):
        for x in range(im.width):
            if silver(px[x, y]) and max(px[x, y][:3]) > 170:
                pts.append((x, y))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def bob(im, dy):
    out = Image.new("RGBA", im.size)
    out.alpha_composite(im.crop((0, 0, im.width, im.height - dy)), (0, dy))
    return out


def naruto_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "idle-rot":
        still = Image.open(src.parent / "rot" / f"{d}.png").convert("RGBA")
        return [bob(still, dy) for dy in BOB]
    if folder == "cast":
        return [load("cast6", i) for i in CAST6]
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    if folder == "lobby":
        return [load("lobby9", i) for i in range(1, 9)]
    return None


# spider: his 6 posed cast frames over the 9 cast cells, thrust (posed frame 3) on cell THRUST; the front's
# frame 2 came out with a smudge over an eye, so it is skipped
SPIDER_CAST = {"south": [0, 1, 1, 1, 1, 3, 4, 4, 4], "east": [0, 1, 2, 2, 2, 3, 3, 3, 3], "north": [0, 1, 2, 2, 2, 3, 4, 4, 4]}
SPIDER_WRIST = (81, 126)  # spider: the thrusting hand in the front thrust, on PixelLab's 180px canvas (its skeleton)


def spider_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "cast":
        return [load("cast6", i) for i in SPIDER_CAST[d]]
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    if folder == "lobby":
        return [load("lobby9", i) for i in range(1, 9)]
    return None


PIKA_CAST = [0, 1, 1, 2, 2, 3, 4, 4, 5]  # pikachu: his 6 posed cast frames over the 9 cast cells, burst on cell THRUST
PIKA_STUN = [0, 1, 2, 2, 4, 5]  # pikachu: the stun without its smudged frame 3


def pikachu_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "idle-rot":
        still = Image.open(src.parent / "rot" / f"{d}.png").convert("RGBA")
        return [bob(still, dy) for dy in BOB]
    if folder == "hit":
        return [load("hit", i) for i in PIKA_STUN]
    if folder == "cast":
        return [load("cast6", i) for i in PIKA_CAST]
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    if folder == "lobby":
        return [load("lobby9", i) for i in range(1, 9)]
    return None


STATIC_CAST = [0, 1, 1, 2, 2, 3, 4, 5, 5]  # static: his 6 posed cast frames over the 9 cast cells, push on cell THRUST
# static, back view: PixelLab turned him to face us once his hands left his chest (twice), so the back cast holds the
# first three frames of a second try ("cast6n": gathering at his chest), the push hidden in front of him anyway
STATIC_CAST_UP = [0, 1, 1, 2, 2, 2, 2, 1, 0]
STATIC_HANDS = (90, 111)  # static: his pushed-out hands in the front cast, on PixelLab's 180px canvas (its skeleton)


def static_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "cast" and d == "north":
        return [load("cast6n", i) for i in STATIC_CAST_UP]
    if folder == "cast":
        return [load("cast6", i) for i in STATIC_CAST]
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    return None


FLASH_CAST = [1, 1, 1, 2, 2, 3, 3, 4, 5]  # flash: his 6 posed skid frames over the 9 cast cells, skidding from the first


def flash_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    carry = "carry-walk-n" if d == "north" else "carry-walk"
    if folder == "cast":
        return [load("cast6", i) for i in FLASH_CAST]
    if folder == "carry-walk":
        return [load(carry, i) for i in range(6)]
    if folder == "carry-idle":
        return [load(carry, i) for i in (0, 0, 3, 3)]
    return None


BUGS_CAST = [0, 1, 1, 2, 2, 3, 3, 4, 5]  # bugs: his 6 posed frames over the 9 cast cells, squashed low as he comes up
BUGS_CAST_SIDE = [1, 1, 1, 2, 2, 3, 3, 4, 5]  # bugs, side view: without its smudged first frame


def bugs_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "idle-rot":
        still = Image.open(src.parent / "rot" / f"{d}.png").convert("RGBA")
        return [bob(still, dy) for dy in BOB]
    if folder == "cast":
        return [load("cast6", i) for i in (BUGS_CAST_SIDE if d == "east" else BUGS_CAST)]
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    if folder == "lobby":
        return [load("lobby9", i) for i in range(1, 9)]
    return None


def green_iris(im):
    """John Stewart's eyes as in the cartoon: white, with a glowing green iris. The face was repainted with whole green
    eyes (bright pale green in the middle, emerald at the rim); each such blob in his head becomes a white eye with a
    round green iris in its middle."""
    a = np.array(im.convert("RGBA")).astype(int)
    alpha = a[..., 3] > 0
    ys, xs = np.nonzero(alpha)
    if not len(ys):
        return im
    head = np.zeros_like(alpha)
    head[ys.min(): ys.min() + int((ys.max() - ys.min()) * 0.45)] = True
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    eyeish = alpha & head & (g > 150) & (g - r > 25) & (g - b > 20) & (r > 30)
    lab, n = ndimage.label(eyeish)
    out = a.copy()
    for k in range(1, n + 1):
        blob = lab == k
        if blob.sum() < 6:
            continue
        sl = ndimage.find_objects(blob.astype(int))[0]
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        cy, cx = ndimage.center_of_mass(blob)
        yy, xx = np.nonzero(blob)
        rad = np.hypot((yy - cy) / (h / 2), (xx - cx) / (w / 2))
        iris = rad < 0.62
        light = 1 - np.clip(rad / 0.62, 0, 1)
        # emerald, a hue past his suit's (SHEETS.lantern.hues) so the iris keeps its green in every player color
        green = np.array([25, 200, 125])[None] * (1 - light[:, None] * 0.6) + np.array([175, 255, 215])[None] * light[:, None] * 0.6
        out[yy, xx, :3] = np.where(iris[:, None], green, np.array([245, 245, 240])[None]).astype(int)
        # a small shine on the iris
        out[int(cy - h * 0.15), int(cx - w * 0.12), :3] = (255, 255, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


LANTERN_CAST = [0, 1, 2, 3, 4, 5, 5, 5, 5]  # lantern: his 6 kneeling frames over the 9 cast cells, held on the last
# lantern, back view: PixelLab turned him to face us (twice) as he knelt, so the back row is the first try's ("cast6"):
# standing, ring fist at his chest
LANTERN_CAST_UP = [0, 1, 1, 1, 1, 1, 1, 1, 1]
LANTERN_BLOTS = [(129, 129, 127), (83, 78, 87)]  # flat gray blots PixelLab left beside him in some frames
LANTERN_GLOVE_SHADE = (173, 168, 179)  # his gloves' shading, which PixelLab also left as blots by his feet


def no_blots(im):
    """Takes out the flat gray blots (LANTERN_BLOTS) PixelLab left in some of his frames: patches of exactly those grays."""
    a = np.array(im)
    gray = np.zeros(a.shape[:2], bool)
    for c in LANTERN_BLOTS:
        gray |= (np.abs(a[..., :3].astype(int) - c).max(axis=2) <= 6) & (a[..., 3] > 0)
    lab, n = ndimage.label(gray)
    sizes = ndimage.sum(gray, lab, range(1, n + 1))
    for k, size in enumerate(sizes, 1):
        if size >= 3:
            a[lab == k] = 0
    # his gloves' shade gray, where it lies away from any glove: a blot too
    shade = (np.abs(a[..., :3].astype(int) - LANTERN_GLOVE_SHADE).max(axis=2) <= 6) & (a[..., 3] > 0)
    white = (a[..., :3].min(axis=2) > 215) & (a[..., 3] > 0)
    lab, n = ndimage.label(shade)
    for k in range(1, n + 1):
        part = lab == k
        if not (ndimage.binary_dilation(part, iterations=2) & white).any():
            a[part] = 0
    return Image.fromarray(a, "RGBA")


def lantern_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "idle-rot":
        still = Image.open(src.parent / "rot" / f"{d}.png").convert("RGBA")
        return [bob(still, dy) for dy in BOB]
    if folder == "cast":
        return [load("cast6", i) for i in LANTERN_CAST_UP] if d == "north" else [load("kneel", i) for i in LANTERN_CAST]
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    if folder == "lobby":
        return [load("lobby9", i) for i in range(1, 9)]
    return None


def ninja_frames(src, folder, d):
    """His frames by sheet folder, from what was downloaded (see the docstring)."""
    load = lambda f, i: Image.open(src / f / d / f"{i}.png").convert("RGBA")
    if folder == "carry-idle":
        return [load("carry-walk", i) for i in (0, 0, 3, 3)]
    if folder == "lobby":
        return [load("lobby9", i) for i in range(1, 9)]
    return None


def hand_front(im):
    """Front view: the lowest middle of the skin pixels in the lower body band, near the middle (his hand held out)."""
    px = im.load()
    mid = im.width / 2
    pts = [(x, y) for y in range(int(im.height * 0.5), int(im.height * 0.8)) for x in range(im.width)
           if abs(x - mid) < im.width * 0.2 and skin(px[x, y])]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys)) / 2


def main():
    character, src, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    rows = []
    for name, folder, d, n in CHARACTERS[character]:
        frames = {"naruto": naruto_frames, "ninja": ninja_frames, "spider": spider_frames, "pikachu": pikachu_frames, "static": static_frames, "flash": flash_frames, "bugs": bugs_frames, "lantern": lantern_frames}.get(character, lambda *_: None)(src, folder, d)
        if frames is None:
            frames = [Image.open(src / folder / d / f"{i}.png").convert("RGBA") for i in range(n)]
        if character == "lantern":
            frames = [green_iris(no_blots(im)) for im in frames]
        if character == "thor":
            frames = thor_cast(folder, d, frames)
        if character == "goku":
            frames = goku_cast(folder, d, frames)
        ground = feet(frames[0])
        placed = []
        for im in frames:
            canvas = Image.new("RGBA", (BASE, BASE))
            x = (BASE - im.width) // 2
            y = int(BASE * 0.75) - ground
            canvas.alpha_composite(im, (x, y))
            placed.append(canvas)
        rows.append((name, placed))
    # union of everything drawn → the cell
    box = None
    for _, frames in rows:
        for c in frames:
            bb = c.getchannel("A").getbbox()
            if bb:
                box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    # keep the cell centered on the canvas center so mirroring stays aligned
    half = max(BASE // 2 - box[0], box[2] - BASE // 2)
    left, right = BASE // 2 - half, BASE // 2 + half
    top, bottom = box[1], box[3]
    cw, ch = right - left, bottom - top
    cols = max(len(f) for _, f in rows)
    sheet = Image.new("RGBA", (cw * cols, ch * len(rows)))
    for r, (_, frames) in enumerate(rows):
        for c, im in enumerate(frames):
            sheet.alpha_composite(im.crop((left, top, right, bottom)), (c * cw, r * ch))
    sheet.save(out)
    stand = rows[0][1][0].crop((left, top, right, bottom))
    bb = stand.getchannel("A").getbbox()
    info = {
        "width": sheet.width, "height": sheet.height, "frameW": cw, "frameH": ch,
        "anchorX": body_middle(stand), "anchorY": int(BASE * 0.75) - top, "bodyH": bb[3] - bb[1],
        "rows": {name: i for i, (name, _) in enumerate(rows)},
    }
    if character == "thor":
        names = [name for name, _ in rows]
        ax, ay = info["anchorX"], info["anchorY"]
        side = rows[names.index("cast.side")][1][THRUST].crop((left, top, right, bottom))
        sb = side.getchannel("A").getbbox()
        fx, rows_at = hammer_face(side)
        face = fx + 1
        down = rows[names.index("cast.down")][1][THRUST].crop((left, top, right, bottom))
        x0, y0, x1, y1 = silver_box(down)
        info["muzzle"] = {
            "side": [face - ax, (rows_at[0] + rows_at[-1]) / 2 - ay],
            "down": [(x0 + x1 + 1) / 2 - ax, y1 + 1 - ay],
            # the back view hides the hammer in front of his face: the bolt leaves from over his head
            "up": [0, sb[1] + (sb[3] - sb[1]) * 0.25 - ay],
        }
    if character == "goku":
        names = [name for name, _ in rows]
        ax, ay = info["anchorX"], info["anchorY"]
        side = rows[names.index("cast.side")][1][THRUST].crop((left, top, right, bottom))
        sx, sy = hands_side(side)
        down = rows[names.index("cast.down")][1][THRUST].crop((left, top, right, bottom))
        dx, dy = hands_front(down)
        sb = side.getchannel("A").getbbox()
        info["muzzle"] = {
            "side": [sx - ax, sy - ay],
            "down": [dx - ax, dy - ay],
            # the back view hides his hands in front of him: the beam leaves from over his shoulders
            "up": [0, sb[1] + (sb[3] - sb[1]) * 0.35 - ay],
        }
    if character == "naruto":
        names = [name for name, _ in rows]
        ax, ay = info["anchorX"], info["anchorY"]
        side = rows[names.index("cast.side")][1][LUNGE].crop((left, top, right, bottom))
        sx, sy = hands_side(side)
        down = rows[names.index("cast.down")][1][LUNGE].crop((left, top, right, bottom))
        dx, dy = hand_front(down)
        sb = side.getchannel("A").getbbox()
        info["muzzle"] = {
            "side": [sx - ax, sy - ay],
            "down": [dx - ax, dy - ay],
            # the back view hides his hand in front of him: the ball shows over his shoulder
            "up": [0, sb[1] + (sb[3] - sb[1]) * 0.45 - ay],
        }
    if character == "spider":
        names = [name for name, _ in rows]
        ax, ay = info["anchorX"], info["anchorY"]
        side = rows[names.index("cast.side")][1][THRUST].crop((left, top, right, bottom))
        sx, sy = hands_side(side)
        # the front frames sit on the work canvas centered, feet on the baseline (see above)
        first = Image.open(src / "cast6" / "south" / "0.png")
        wx = (BASE - first.width) // 2 + SPIDER_WRIST[0] - left
        wy = int(BASE * 0.75) - feet(first.convert("RGBA")) + SPIDER_WRIST[1] - top
        sb = side.getchannel("A").getbbox()
        info["muzzle"] = {
            "side": [sx - ax, sy - ay],
            "down": [wx - ax, wy - ay],
            # the back view hides his hand in front of him: the web leaves from over his shoulder
            "up": [0, sb[1] + (sb[3] - sb[1]) * 0.45 - ay],
        }
    if character == "static":
        names = [name for name, _ in rows]
        ax, ay = info["anchorX"], info["anchorY"]
        side = rows[names.index("cast.side")][1][THRUST].crop((left, top, right, bottom))
        sx, sy = hands_side(side)
        first = Image.open(src / "cast6" / "south" / "0.png")
        wx = (BASE - first.width) // 2 + STATIC_HANDS[0] - left
        wy = int(BASE * 0.75) - feet(first.convert("RGBA")) + STATIC_HANDS[1] - top
        sb = side.getchannel("A").getbbox()
        info["muzzle"] = {
            "side": [sx - ax, sy - ay],
            "down": [wx - ax, wy - ay],
            # the back view hides his hands in front of him: the field leaves from over his shoulders
            "up": [0, sb[1] + (sb[3] - sb[1]) * 0.45 - ay],
        }
    print(json.dumps(info))


main()
