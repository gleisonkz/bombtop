from pathlib import Path
from PIL import Image
import numpy as np, hashlib, json
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[2]/"apps/client/public/sprites"
im=Image.open(HERE/"source.generated.png").convert("RGBA")
palette=np.array([[0,55,26],[0,109,43],[0,173,48],[54,232,65],[140,255,166],[234,255,239]],dtype=np.int32)
sheet=Image.new("RGBA",(2560,960));frames=[];hashes=set();records=[]
for n in range(16):
    c,r=n%4,n//4
    box=(round(c*im.width/4),round(r*im.height/4),round((c+1)*im.width/4),round((r+1)*im.height/4))
    frame=im.crop(box).resize((80,80),Image.Resampling.NEAREST)
    a=np.array(frame);rgb=a[:,:,:3].astype(np.int32)
    nearest=((rgb[:,:,None,:]-palette[None,None,:,:])**2).sum(3).argmin(2)
    a[:,:,:3]=palette[nearest];a[:,:,3]=np.where(a[:,:,3]>=128,255,0);a[a[:,:,3]==0]=0
    # Reserve1logicalpixel gutters to isolate the native atlas cells.
    a[0]=0;a[-1]=0;a[:,0]=0;a[:,-1]=0
    frame=Image.fromarray(a).resize((320,320),Image.Resampling.NEAREST)
    hashes.add(hashlib.sha256(frame.tobytes()).hexdigest());frames.append(frame)
    row=0 if n<4 else 1 if n<12 else 2;col=n if n<4 else n-4 if n<12 else n-12
    sheet.paste(frame,(col*320,row*320));records.append({"sourceBox":box,"row":row,"column":col})
assert len(hashes)==16
sheet.save(PUBLIC/"lantern-construct-shield.png")
(HERE/"packing.json").write_text(json.dumps({"sourceSha256":hashlib.sha256((HERE/"source.generated.png").read_bytes()).hexdigest(),"logicalCell":80,"exportCell":320,"palette":palette.tolist(),"binaryAlpha":True,"frames":records},indent=2),encoding="utf-8")
preview=[]
for n in list(range(4))+list(range(4,12))*3+list(range(12,16)):
    bg=Image.new("RGBA",(320,320),(40,50,60,255));bg.alpha_composite(frames[n]);preview.append(bg.convert("RGB"))
preview[0].save(HERE/"shield-preview.gif",save_all=True,append_images=preview[1:],duration=67,loop=0)
print("16distinctpixelartframes,6colors,binaryalpha,4px transparentgutters,2560x960")
