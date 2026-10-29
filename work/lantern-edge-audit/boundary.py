from PIL import Image,ImageDraw
from pathlib import Path
import runpy,json
p=Path('work/lantern-edge-audit');im=Image.open('apps/client/public/sprites/lantern.png').convert('RGBA'); ws=runpy.run_path('apps/client/scripts/build-lantern-paint-regions.py')['HEAD_WINDOWS']; rec=[]
for row,ww in enumerate(ws):
 for col,w in enumerate(ww):
  if not w:continue
  l,t,r,b=w
  for y in range(max(1,t-3),int(t+(b-t)*.7)):
   for x in range(max(1,l-3),min(131,r+3)):
    R,G,B,A=im.getpixel((col*132+x,row*164+y))
    edge=A and any(im.getpixel((col*132+x+dx,row*164+y+dy))[3]==0 for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)])
    if edge and max(R,G,B)>70 and (min(R,G,B)>65 and max(R,G,B)-min(R,G,B)<65 or G>R+10 and G>B):
     rec.append(dict(row=row,frame=col,x=x,y=y,atlas_x=col*132+x,atlas_y=row*164+y,rgba=[R,G,B,A]))
(p/'boundary-candidates.json').write_text(json.dumps(rec,indent=2)); print(json.dumps(rec))
out=Image.new('RGB',(800, max(1,(len(rec)+3)//4)*150),(30,25,40));d=ImageDraw.Draw(out)
for i,q in enumerate(rec):
 x=q['atlas_x'];y=q['atlas_y'];crop=im.crop((x-5,y-5,x+6,y+6)).resize((110,110),Image.Resampling.NEAREST);xx=i%4*200;yy=i//4*150;out.paste(crop,(xx,yy+30),crop);d.text((xx,yy),f"r{q['row']} c{q['frame']} ({q['x']},{q['y']})",fill='white');d.rectangle((xx+50,yy+80,xx+59,yy+89),outline='magenta')
out.save(p/'boundary-detail.png')
