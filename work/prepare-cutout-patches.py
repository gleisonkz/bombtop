from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / 'apps/client/public/sprites'
patches = {}
for name, points in json.loads((ROOT / 'work/goku-hair-patches.json').read_text()).items():
    patches[name] = [[x,y,old,[9,9,18,255]] for x,y,old in points]

image = Image.open(SPRITES / 'lantern.png').convert('RGBA')
points = {}
for point in json.loads((ROOT / 'work/lantern-edge-audit/boundary-candidates.json').read_text()):
    rgba = point['rgba']
    if 100 <= min(rgba[:3]) <= 160 and max(rgba[:3])-min(rgba[:3]) < 25:
        points[point['atlas_x'],point['atlas_y']] = rgba
for y in (31,32,33):
    points[359,492+y] = list(image.getpixel((359,492+y)))
patches['lantern'] = []
for (x,y),old in points.items():
    choices = []
    for dy in range(-4,5):
        for dx in range(-4,5):
            if 0 <= x+dx < image.width and 0 <= y+dy < image.height:
                color = image.getpixel((x+dx,y+dy))
                if color[3] == 255 and max(color[:3]) < 65:
                    choices.append((abs(dx)+abs(dy),abs(dy),color))
    if not choices:
        raise ValueError((x,y))
    patches['lantern'].append([x,y,old,list(min(choices)[2])])

patches['spider'] = [[x,y,None,[0,0,0,0]] for y in range(1064,1066) for x in range(17,19)]
patches['panther-lobby'] = [[frame*224+x,y,None,[0,0,0,0]] for frame in (4,5,6) for x,y in ((97,116),(98,116),(101,119))]
patches['panther'] = [[x,1458,None,[0,0,0,0]] for x in (553,554)]
assets = []
for name, changes in patches.items():
    source = Image.open(SPRITES / f'{name}.png').convert('RGBA')
    for change in changes:
        if change[2] is None:
            change[2] = list(source.getpixel(tuple(change[:2])))
    candidate = source.copy()
    for x,y,old,new in changes:
        assert list(source.getpixel((x,y))) == old
        candidate.putpixel((x,y),tuple(new))
    candidate.save(ROOT / f'work/{name}-cutout-candidate.png')
    assets.append(dict(file=f'{name}.png',size=list(source.size),sourcePixelsSha256=hashlib.sha256(source.tobytes()).hexdigest(),repairedPixelsSha256=hashlib.sha256(candidate.tobytes()).hexdigest(),changes=changes))
    print(name,len(changes))
(ROOT / 'apps/client/scripts/sprite-cutout-patches.json').write_text(json.dumps(dict(assets=assets),separators=(',',':'))+'\n')
