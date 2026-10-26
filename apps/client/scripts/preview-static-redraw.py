"""Offline reviews of packed native frames, including the game's bomb and sockets."""
from pathlib import Path
import json
import math
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'concept/static/carry-redraw'
ATLAS = Image.open(ROOT / 'apps/client/public/sprites/static-final.png').convert('RGBA')
GRIPS = json.loads((ROOT / 'apps/client/src/render/carry-anchors.json').read_text())['characters']['static']['rows']


def frame(row, column):
    return ATLAS.crop((column * 168, row * 186, (column + 1) * 168, (row + 1) * 186))


def save_gif(name, images, duration):
    images[0].save(OUT / name, save_all=True, append_images=images[1:], duration=duration, loop=0, disposal=2)


def menu():
    images = []
    for column in range(10):
        canvas = Image.new('RGBA', (168, 186), '#252936')
        canvas.alpha_composite(frame(17, column))
        images.append(canvas.convert('RGB').resize((336, 372), Image.Resampling.NEAREST))
    save_gif('menu-preview.gif', images, 116)


def carry():
    ratio = .1 / .14586486486486486
    art = Image.open(ROOT / 'apps/client/public/sprites/bombs/armed.png').convert('RGBA').crop((0, 0, 128, 128))
    art = art.resize((round(128 * ratio), round(128 * ratio)), Image.Resampling.NEAREST)
    images = []
    for index in range(12):
        canvas = Image.new('RGBA', (660, 480), '#252936')
        for position, row in enumerate(range(11, 17)):
            column = index % (4 if row < 14 else 6)
            grip = GRIPS[str(row)][column]
            rx = 42 * ratio
            half = grip['span'] / 2
            x = grip['x'] + (rx * .8 if half == 0 else 0)
            y = grip['y'] - rx * (.6 if half == 0 else math.sqrt(max(0, 1 - (half / rx) ** 2)))
            left, top = position % 3 * 220 + 26, position // 3 * 240 + 55
            canvas.alpha_composite(art, (round(left + x - 64 * ratio), round(top + y - 76 * ratio)))
            canvas.alpha_composite(frame(row, column), (left, top))
        images.append(canvas.convert('RGB'))
    save_gif('carry-preview.gif', images, 116)


def actions():
    images = []
    for index in range(22):
        canvas = Image.new('RGBA', (840, 220), '#252936')
        for position, (row, count) in enumerate(((6, 6), (7, 7), (8, 6), (9, 7), (18, 11))):
            column = min(index, count - 1) if row == 7 else index % count
            canvas.alpha_composite(frame(row, column), (position * 168, 20))
        images.append(canvas.convert('RGB'))
    save_gif('actions-preview.gif', images, 116)


if __name__ == '__main__':
    menu()
    carry()
    actions()
