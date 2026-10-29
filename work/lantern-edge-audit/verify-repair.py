from PIL import Image,ImageDraw
import numpy as np,json,hashlib
from pathlib import Path
p=Path('work/lantern-edge-audit');m=next(a for a in json.loads(Path('apps/client/scripts/sprite-cutout-patches.json').read_text())['assets'] if a['file']=='lantern.png'); cur=Image.open('apps/client/public/sprites/lantern.png').convert('RGBA');old=cur.copy()
assert list(cur.size)==m['size']
for x,y,before,after in m['changes']:
 assert list(cur.getpixel((x,y)))==after
 old.putpixel((x,y),tuple(before))
a=np.array(old);b=np.array(cur);diff=np.any(a!=b,axis=2);actual=set(zip(*np.nonzero(diff)[::-1]));expected={(x,y) for x,y,_,_ in m['changes']}
result=dict(changes=int(diff.sum()),unique_patch_coords=len(expected),only_manifest=actual==expected,source_hash_matches=hashlib.sha256(old.tobytes()).hexdigest()==m['sourcePixelsSha256'],repaired_hash_matches=hashlib.sha256(cur.tobytes()).hexdigest()==m['repairedPixelsSha256'],alpha_identical=bool(np.array_equal(a[:,:,3],b[:,:,3])),geometry=list(cur.size),bright_whites_unchanged=not bool(np.any(diff & (a[:,:,:3].min(axis=2)>=170))),all_patches_boundary=all(any(old.getpixel((x+dx,y+dy))[3]==0 for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]) for x,y in expected))
frames=sorted({(y//164,x//132) for x,y in expected});out=Image.new('RGB',(len(frames)*264,440),(35,28,45));d=ImageDraw.Draw(out)
for i,(r,c) in enumerate(frames):
 for j,im in enumerate([old,cur]):
  crop=im.crop((c*132,r*164,c*132+132,r*164+100)).resize((264,200),Image.Resampling.NEAREST);out.paste(crop,(i*264,j*220+20),crop);d.text((i*264+4,j*220+3),f'r{r} c{c} '+['before','after'][j],fill='white')
out.save(p/'repair-before-after.png');(p/'repair-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));print('frames',frames)
