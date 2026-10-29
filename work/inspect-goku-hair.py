from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
result = {}
for name in ('goku', 'goku-lobby'):
    image = Image.open(ROOT / f'apps/client/public/sprites/{name}.png').convert('RGBA')
    pixels = np.array(image)
    patches = []
    for row in range(image.height // 164):
        for col in range(image.width // 132):
            if name == 'goku-lobby' and 12 <= col <= 46:
                continue
            frame = pixels[row*164:(row+1)*164, col*132:(col+1)*132]
            rgb = frame[:, :, :3].astype(int)
            warm = (frame[:, :, 3] > 0) & (rgb[:, :, 0] > rgb[:, :, 1] * 1.25) & (rgb[:, :, 0] > 65) & (rgb[:, :, 2] > 50)
            warm[90:] = False
            labels, count = ndimage.label(warm, np.ones((3, 3)))
            sizes = np.bincount(labels.ravel())
            if count == 0:
                continue
            sizes[0] = 0
            face = labels == sizes.argmax()
            face_top = np.nonzero(face)[0].min()
            candidates = (labels > 0) & (sizes[labels] <= 12)
            candidates[face_top-3:] = False
            for y, x in zip(*np.nonzero(candidates)):
                patches.append([col*132+int(x), row*164+int(y), list(map(int, frame[y,x]))])
    result[name] = patches
    print(name, len(patches), 'pixels', len(set((x//132,y//164) for x,y,_ in patches)), 'frames')
    before = image.copy()
    for x,y,_ in patches:
        image.putpixel((x,y),(9,9,18,255))
    image.save(ROOT / f'work/{name}-hair-candidate.png')
    rows = image.height // 164
    count = image.width // 132
    sample_count = 18 if name == 'goku' else 12
    contact = Image.new('RGB', (sample_count*132, 328), '#342338')
    for i in range(sample_count):
        col, row = (0,i) if name == 'goku' else (i,0)
        for j,source in enumerate((before,image)):
            cell = source.crop((col*132,row*164,(col+1)*132,(row+1)*164))
            contact.paste(cell,(i*132,j*164),cell)
    contact.save(ROOT / f'work/{name}-hair-compare.png')
(ROOT / 'work/goku-hair-patches.json').write_text(json.dumps(result, separators=(',',':')))
