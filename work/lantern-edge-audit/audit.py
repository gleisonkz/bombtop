from PIL import Image,ImageDraw
from pathlib import Path
import json,hashlib,runpy,csv
p=Path('work/lantern-edge-audit'); src=Path('apps/client/public/sprites/lantern.png'); im=Image.open(src).convert('RGBA')
windows=runpy.run_path('apps/client/scripts/build-lantern-paint-regions.py')['HEAD_WINDOWS']
records=[]
for row,ws in enumerate(windows):
 for col,w in enumerate(ws):
  if not w: continue
  l,t,r,b=w
  for y in range(max(0,t-4),b):
   for x in range(max(0,l-4),min(132,r+4)):
    rgba=im.getpixel((col*132+x,row*164+y)); R,G,B,A=rgba
    if A and min(R,G,B)>=170 and max(R,G,B)-min(R,G,B)<=60:
     edge=any(im.getpixel((col*132+x+dx,row*164+y+dy))[3]==0 for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)])
     records.append(dict(row=row,frame=col,x=x,y=y,atlas_x=col*132+x,atlas_y=row*164+y,rgba=rgba,edge=edge))
with (p/'light-pixels.json').open('w') as f: json.dump(records,f,indent=2)
for row in [0,3,17]:
 cols=[i for i,w in enumerate(windows[row]) if w]; out=Image.new('RGB',(len(cols)*264,348),(38,31,52)); d=ImageDraw.Draw(out)
 for col in cols:
  crop=im.crop((col*132,row*164,col*132+132,row*164+100)).resize((264,200),Image.Resampling.NEAREST)
  out.paste(crop,(col*264,22),crop); d.text((col*264+4,4),f'r{row} c{col} head 2x',fill='white')
  for q in records:
   if q['row']==row and q['frame']==col and q['edge']:
    x=col*264+q['x']*2;y=22+q['y']*2;d.rectangle((x-2,y-2,x+3,y+3),outline=(255,0,255))
 out.save(p/f'row-{row}-heads.png')
print('hash',hashlib.sha256(src.read_bytes()).hexdigest());print('candidates',len(records));print('edge',sum(q['edge'] for q in records))
