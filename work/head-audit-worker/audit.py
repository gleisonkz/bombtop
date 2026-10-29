from PIL import Image,ImageDraw
from pathlib import Path
import re,json
root=Path.cwd(); out=root/'work/head-audit-worker'
s=(root/'apps/client/src/render/sprites.ts').read_text(encoding='utf-8')
s=s.split('export const SHEETS = {',1)[1].split('} satisfies Record<string, SheetLayout>',1)[0]
blocks=re.findall(r'^  (\w+): \{\n(.*?)^  \},',s,re.M|re.S)
report=[]
for name,b in blocks:
 if name in ('goku','lantern'):continue
 def val(k,t=b):return int(re.search(r'\b'+k+r': (\d+)',t)[1])
 url=re.search(r'url: "([^"]+)',b)[1].split('?')[0];fw=val('frameW');fh=val('frameH')
 if name=='bomber':url='sprites/bomber-menu-atlas.png';fw*=2;fh*=2
 strips=[('idle',0,4,url,fw,fh),('dizzy',6,6,url,fw,fh)]
 for pose in ('lobby','victory'):
  line=re.search(r'^    '+pose+r': (.*)',b,re.M)
  if not line:continue
  t=line[1]; u=re.search(r'url: "([^"]+)',t)
  strips.append((pose,val('row',t),val('frames',t),u[1].split('?')[0] if u else url,val('frameW',t) if u else fw,val('frameH',t) if u else fh))
 tiles=[]
 for pose,row,n,u,w,h in strips:
  im=Image.open(root/'apps/client/public'/u).convert('RGBA')
  for f in range(n):
   fr=im.crop((f*w,row*h,(f+1)*w,(row+1)*h)); a=fr.getchannel('A');pix=a.load();seen=set();comps=[]
   for y in range(h):
    for x in range(w):
     if not pix[x,y] or (x,y) in seen:continue
     stack=[(x,y)];seen.add((x,y));pts=[]
     while stack:
      xx,yy=stack.pop();pts.append((xx,yy))
      for dx,dy in ((-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)):
       nx,ny=xx+dx,yy+dy
       if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and pix[nx,ny]:seen.add((nx,ny));stack.append((nx,ny))
     xs,ys=zip(*pts);comps.append({'area':len(pts),'bbox':[min(xs),min(ys),max(xs)+1,max(ys)+1],'sample':list(fr.getpixel(pts[0]))})
   comps.sort(key=lambda c:-c['area'])
   report.append({'character':name,'pose':pose,'frame':f,'path':u,'row':row,'cell':[w,h],'bounds':a.getbbox(),'partialAlpha':sum(1 for z in a.getdata() if 0<z<255),'components':comps})
   # Full cell at native size, alternating checkerboard. Label zero-based frame.
   tile=Image.new('RGB',(340,325),'#17212d');d=ImageDraw.Draw(tile);d.text((5,4),f'{name} {pose} f{f} ({w}x{h})',fill='white')
   scale=min(1.25,290/w,290/h); sz=(round(w*scale),round(h*scale));bg=Image.new('RGBA',sz)
   bd=ImageDraw.Draw(bg)
   for yy in range(0,sz[1],8):
    for xx in range(0,sz[0],8):bd.rectangle((xx,yy,xx+7,yy+7),fill=('#354150' if (xx//8+yy//8)%2 else '#25303c'))
   bg.alpha_composite(fr.resize(sz,Image.Resampling.NEAREST));tile.paste(bg.convert('RGB'),((340-sz[0])//2,25));tiles.append(tile)
 for page,start in enumerate(range(0,len(tiles),16)):
  batch=tiles[start:start+16];sheet=Image.new('RGB',(340*4,325*((len(batch)+3)//4)),'#17212d')
  for j,tile in enumerate(batch):sheet.paste(tile,((j%4)*340,(j//4)*325))
  sheet.save(out/f'{name}-{page}.png')
(out/'alpha-report.json').write_text(json.dumps(report,indent=2))
print('Characters',len(blocks)-2,'frames',len(report))
for r in report:
 if len(r['components'])>1:print(r['character'],r['pose'],r['frame'],'extra',r['components'][1:8])
