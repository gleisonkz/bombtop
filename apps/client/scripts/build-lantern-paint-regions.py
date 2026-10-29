"""Rebuild the Lantern head silhouette without masking the uniform collar."""
import argparse
from collections import deque
import colorsys
import hashlib
import json
from pathlib import Path
from PIL import Image

CLIENT = Path(__file__).resolve().parents[1]
SOURCE = CLIENT / "public/sprites/lantern.png"
OUTPUT = CLIENT / "src/render/lantern-paint-regions.json"
SOURCE_SHA256 = "55f20f0034c57234dd898d745e5123c7b5ab3aab5b544e12b8d555a0a2294ddf"
FW, FH = 132, 164
HEAD_WINDOWS = [[[39, 12, 96, 87], [39, 12, 96, 87], [38, 12, 98, 88], [38, 12, 98, 88], None, None, None, None, None], [[50, 22, 106, 87], [48, 21, 103, 86], [46, 20, 101, 85], [48, 21, 103, 86], None, None, None, None, None], [[37, 20, 97, 85], [37, 19, 97, 84], [37, 19, 97, 84], [37, 20, 97, 85], None, None, None, None, None], [[36, 12, 99, 90], [36, 12, 103, 90], [35, 11, 98, 88], [36, 12, 99, 90], [36, 12, 99, 90], [36, 12, 99, 90], None, None, None], [[43, 19, 100, 85], [44, 20, 101, 85], [43, 19, 99, 84], [43, 20, 100, 86], [45, 19, 101, 84], [42, 19, 99, 84], None, None, None], [[36, 19, 96, 84], [37, 20, 97, 85], [37, 20, 97, 86], [36, 19, 96, 85], [35, 20, 95, 85], [35, 20, 95, 85], None, None, None], [[23, 21, 89, 94], [26, 19, 91, 91], [30, 8, 92, 80], [28, 8, 90, 80], [4, 15, 67, 87], [11, 22, 73, 93], None, None, None], [[27, 21, 89, 91], [28, 19, 92, 89], [33, 16, 93, 83], [29, 15, 90, 81], [34, 28, 90, 91], [29, 32, 85, 95], [6, 61, 72, 119], None, None], [[41, 23, 98, 90], [41, 28, 94, 96], [41, 30, 98, 105], [28, 31, 98, 98], [40, 30, 98, 97], [40, 30, 98, 97], [40, 30, 98, 97], [40, 30, 98, 97], [40, 30, 98, 97]], [[44, 21, 100, 86], [45, 27, 101, 92], [45, 30, 101, 96], [42, 28, 98, 88], [40, 28, 97, 88], [41, 28, 98, 88], [41, 28, 98, 88], [41, 28, 98, 88], [41, 28, 98, 88]], [[37, 23, 98, 89], [38, 27, 98, 92], [38, 22, 98, 87], [38, 19, 98, 85], [37, 15, 98, 81], [37, 15, 98, 81], [37, 15, 98, 81], [37, 15, 98, 81], [37, 15, 98, 81]], [[42, 20, 94, 88], [42, 20, 94, 88], [42, 21, 95, 88], [42, 21, 95, 88], None, None, None, None, None], [[43, 18, 98, 84], [43, 18, 98, 84], [42, 15, 98, 81], [42, 15, 98, 81], None, None, None, None, None], [[37, 10, 98, 83], [37, 10, 98, 83], [37, 12, 98, 84], [37, 12, 98, 84], None, None, None, None, None], [[42, 20, 94, 88], [42, 19, 94, 87], [42, 19, 94, 87], [42, 21, 95, 88], [42, 19, 94, 86], [42, 19, 94, 86], None, None, None], [[43, 18, 98, 84], [45, 16, 99, 81], [46, 16, 98, 81], [42, 15, 98, 81], [44, 15, 98, 80], [42, 12, 98, 77], None, None, None], [[37, 10, 98, 83], [38, 19, 99, 86], [38, 19, 99, 86], [37, 12, 98, 84], [38, 19, 99, 86], [38, 19, 98, 86], None, None, None], [[30, 16, 106, 91], [30, 14, 106, 88], [30, 11, 106, 86], [30, 11, 106, 86], [30, 11, 106, 86], [31, 13, 106, 87], [30, 16, 106, 91], [30, 18, 106, 95], None]]

def silhouette(frame, window):
    if window is None:
        return []
    left, top, right, bottom = window
    skin = set()
    for y in range(top, bottom):
        for x in range(left, right):
            r, g, b, a = frame.getpixel((x, y))
            if a and r > g + 6 and g > b + 3:
                skin.add((x, y))
    largest = set()
    while skin:
        start = skin.pop()
        component = {start}
        queue = deque([start])
        while queue:
            x, y = queue.popleft()
            for point in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if point in skin:
                    skin.remove(point)
                    component.add(point)
                    queue.append(point)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise ValueError(f"No head skin found in {window}")
    spans = {}
    for x, y in largest:
        if y not in spans:
            spans[y] = [x, x]
        else:
            spans[y][0] = min(spans[y][0], x)
            spans[y][1] = max(spans[y][1], x)
    padded = {}
    for y, (lo, hi) in spans.items():
        for yy in range(max(top,y-2), min(bottom,y+1)):
            bounds = [max(left,lo-1),min(right,hi+2)]
            if yy not in padded:
                padded[yy] = bounds
            else:
                padded[yy] = [min(padded[yy][0],bounds[0]),max(padded[yy][1],bounds[1])]
    regions = []
    collar_limit = top + (bottom - top) * .75
    for y, (lo, hi) in sorted(padded.items()):
        start = None
        for x in range(lo, hi + 1):
            selected = x < hi
            if selected and y >= collar_limit:
                r, g, b, a = frame.getpixel((x, y))
                hue, _, saturation = colorsys.rgb_to_hls(r/255, g/255, b/255)
                if a and max(r,g,b)>16 and saturation>=.2 and 145<=hue*360<=180:
                    selected = False
            if selected and start is None:
                start = x
            elif not selected and start is not None:
                if regions and regions[-1]['left']==start and regions[-1]['right']==x and regions[-1]['bottom']==y:
                    regions[-1]['bottom'] = y+1
                else:
                    regions.append(dict(left=start,top=y,right=x,bottom=y+1))
                start = None
    return regions

def generate():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Lantern source changed; review head and collar boundaries")
    with Image.open(SOURCE) as image:
        image = image.convert("RGBA")
        if image.size != (FW*9,FH*18):
            raise ValueError("Lantern geometry changed")
        rows=[]
        for row, windows in enumerate(HEAD_WINDOWS):
            cells=[]
            for column, window in enumerate(windows):
                frame=image.crop((column*FW,row*FH,(column+1)*FW,(row+1)*FH))
                cells.append(silhouette(frame,window))
            rows.append(cells)
    return dict(sourceSha256=SOURCE_SHA256,frameW=FW,frameH=FH,rows=rows)

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check",action="store_true")
    args=parser.parse_args()
    result=generate()
    if args.check:
        if json.loads(OUTPUT.read_text(encoding="utf-8")) != result:
            raise SystemExit("Lantern head protection is stale")
        print("Lantern head silhouette matches the production atlas")
    else:
        OUTPUT.write_text(json.dumps(result,separators=(",",":"))+"\n",encoding="utf-8")
        print(f"Wrote {OUTPUT}")


