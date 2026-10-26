"""Register generated Static carry drawings in the existing native atlas grid."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image
from scipy import ndimage

DIRECTORY = Path(__file__).resolve().parents[3] / 'concept/static/carry-redraw'
COUNTS = (4, 4, 4, 6, 6, 6)
CELL = (168, 186)
ANCHOR = (82, 170)
SCALE = .81


def frames():
    source = Image.open(DIRECTORY / 'carry.source.png').convert('RGBA')
    if source.size != (1254, 1254):
        raise ValueError('Carry source changed; remeasure its grid')
    config = json.loads((DIRECTORY / 'contract.json').read_text(encoding='utf-8'))
    if hashlib.sha256((DIRECTORY / 'carry.source.png').read_bytes()).hexdigest() != config['sha256']:
        raise ValueError('Carry source hash changed; review new artwork')
    result = {}
    for row, count in enumerate(COUNTS):
        current = []
        for column in range(count):
            pixels = np.array(source.crop((column * 209, row * 209, (column + 1) * 209, (row + 1) * 209)))
            labels, _ = ndimage.label(pixels[:, :, 3] >= 64)
            sizes = np.bincount(labels.ravel())
            sizes[0] = 0
            core = labels == sizes.argmax()
            # Retain original alpha along the authored silhouette, excluding stray pixels.
            pixels[~ndimage.binary_dilation(core, iterations=2), 3] = 0
            art = Image.fromarray(pixels)
            art = art.crop(art.getchannel('A').getbbox())
            art = art.resize((round(art.width * SCALE), round(art.height * SCALE)), Image.Resampling.NEAREST)
            cell = Image.new('RGBA', CELL)
            cell.alpha_composite(art, (ANCHOR[0] - art.width // 2, ANCHOR[1] - art.height))
            current.append(cell)
        result[row + 11] = current
    result[17] = menu_frames(config['menu'])
    for sequence in config.get('actions', []):
        result[sequence['row']] = registered_frames(sequence)
    return result


def menu_frames(config):
    return registered_frames({**config, 'file': 'menu.source.png'})


def registered_frames(config):
    path = DIRECTORY / config['file']
    if hashlib.sha256(path.read_bytes()).hexdigest() != config['sha256']:
        raise ValueError(f'Source changed; review new artwork: {path.name}')
    source = Image.open(path).convert('RGBA')
    result = []
    for index, box in enumerate(config['boxes']):
        art = source.crop(box)
        art = art.resize((round(art.width * config['scale']), round(art.height * config['scale'])), Image.Resampling.NEAREST)
        if art.width >= CELL[0] - 2 or art.height >= CELL[1] - 2:
            raise ValueError(f'Animation would clip: {path.name}/{index}')
        cell = Image.new('RGBA', CELL)
        lift = config.get('lifts', {}).get(str(index), 0)
        cell.alpha_composite(art, (ANCHOR[0] - art.width // 2, ANCHOR[1] - art.height - lift))
        result.append(cell)
    return result
