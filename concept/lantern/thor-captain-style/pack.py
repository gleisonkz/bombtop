from pathlib import Path
from PIL import Image
import numpy as np,hashlib,json
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[2]/"apps/client/public/sprites"
im=Image.open(HERE/"source.generated.png").convert("RGBA")
frames=[];records=[];sheet=Image.new("RGBA",(2560,960))
for n in range(16):
    c,r=n%4,n//4
    box=(round(c*im.width/4),round(r*im.height/4),round((c+1)*im.width/4),round((r+1)*im.height/4))
    frame=im.crop(box).resize((160,160),Image.Resampling.NEAREST)
    a=np.array(frame);a[:,:,3]=np.where(a[:,:,3]>=128,255,0);a[a[:,:,3]==0]=0
    a[0]=0;a[-1]=0;a[:,0]=0;a[:,-1]=0
    frames.append(Image.fromarray(a));records.append(box)
board=Image.new("RGBA",(640,640))
for n,f in enumerate(frames):board.paste(f,((n%4)*160,(n//4)*160))
# Shared palette keeps all16generateddrawings in the same fine sprite shading family.
colorboard=board.convert("RGB").quantize(colors=16,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert("RGB")
colorboard.putalpha(board.getchannel("A"));hashes=set();preview=[]
for n in range(16):
    c,r=n%4,n//4
    f=colorboard.crop((c*160,r*160,(c+1)*160,(r+1)*160)).resize((320,320),Image.Resampling.NEAREST)
    hashes.add(hashlib.sha256(f.tobytes()).hexdigest());frames[n]=f
    row=0 if n<4 else 1 if n<12 else 2;col=n if n<4 else n-4 if n<12 else n-12
    sheet.paste(f,(col*320,row*320))
assert len(hashes)==16
sheet.save(PUBLIC/"lantern-construct-shield.png")
for n in list(range(4))+list(range(4,12))*3+list(range(12,16)):
    bg=Image.new("RGBA",(320,320),(48,57,70,255));bg.alpha_composite(frames[n]);preview.append(bg.convert("RGB"))
preview[0].save(HERE/"shield-preview.gif",save_all=True,append_images=preview[1:],duration=67,loop=0)
(HERE/"packing.json").write_text(json.dumps({"sourceSha256":hashlib.sha256((HERE/"source.generated.png").read_bytes()).hexdigest(),"logicalCell":160,"exportCell":320,"paletteLimit":16,"binaryAlpha":True,"sourceBoxes":records},indent=2),encoding="utf-8")
print("16distinctdrawings, fine160pixelgrid, shared16colorpalette, binaryalpha, transparent2pxgutters")
