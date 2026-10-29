from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib,collections
p=Path('work/head-audit-worker');m=json.loads(Path('apps/client/scripts/sprite-cutout-patches.json').read_text());checks=[]
for a in m['assets']:
 if a['file']=='lantern.png':continue
 im=Image.open(Path('apps/client/public/sprites')/a['file']).convert('RGBA');old=im.copy()
 for x,y,before,after in a['changes']:
  assert list(im.getpixel((x,y)))==after,(a['file'],x,y)
  old.putpixel((x,y),tuple(before))
 checks.append([a['file'],len(a['changes']),hashlib.sha256(im.tobytes()).hexdigest()==a['repairedPixelsSha256'],hashlib.sha256(old.tobytes()).hexdigest()==a['sourcePixelsSha256'],im.getchannel('A').tobytes()==old.getchannel('A').tobytes()])
 if not a['file'].startswith('goku'):continue
 groups=collections.defaultdict(list)
 for x,y,bef,aft in a['changes']:groups[(y//164,x//132)].append((x%132,y%164))
 tiles=[]
 for (row,col),points in sorted(groups.items()):
  tile=Image.new('RGB',(540,365),'#526274');d=ImageDraw.Draw(tile);d.text((5,3),f"{a['file']} row{row} f{col}: {len(points)} pixels BEFORE | AFTER",fill='white')
  box=(col*132,row*164,(col+1)*132,(row+1)*164)
  for i,src in enumerate((old,im)):
   fr=src.crop(box).resize((264,328),Image.Resampling.NEAREST);bg=Image.new('RGBA',fr.size,'#9aabba');bg.alpha_composite(fr);tile.paste(bg.convert('RGB'),(i*270,24))
  tiles.append(tile)
 for start in range(0,len(tiles),8):
  batch=tiles[start:start+8];o=Image.new('RGB',(1080,365*((len(batch)+1)//2)),'#526274')
  for j,t in enumerate(batch):o.paste(t,((j%2)*540,(j//2)*365))
  o.save(p/f"qa-{a['file'][:-4]}-{start//8}.png")
 print(a['file'],'changed frames',len(groups),'pages',(len(tiles)+7)//8)
print(checks)
(p/'repair-verification.json').write_text(json.dumps(checks,indent=2))
