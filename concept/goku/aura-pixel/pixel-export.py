from pathlib import Path
from PIL import Image
import numpy as np, json, hashlib
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[2]/"apps/client/public/sprites"
palette=np.array([[168,63,0],[230,116,0],[255,185,0],[255,229,64],[255,255,210]],dtype=np.int32)
sheet=Image.new("RGBA",(1280,1280)); hashes=set(); frames=[]
for index in range(16):
    frame=Image.open(HERE/"frames"/f"{index:02d}.png").resize((80,80),Image.Resampling.NEAREST)
    a=np.array(frame); rgb=a[:,:,:3].astype(np.int32)
    nearest=((rgb[:,:,None,:]-palette[None,None,:,:])**2).sum(3).argmin(2)
    a[:,:,:3]=palette[nearest];a[:,:,3]=np.where(a[:,:,3]>=128,255,0);a[a[:,:,3]==0]=0
    frame=Image.fromarray(a).resize((320,320),Image.Resampling.NEAREST)
    hashes.add(hashlib.sha256(frame.tobytes()).hexdigest());frames.append(frame)
    sheet.paste(frame,((index%4)*320,(index//4)*320))
assert len(hashes)==16
sheet.save(PUBLIC/"goku-ssj-aura-pixel.png")
contract=json.loads((PUBLIC/"goku-ssj-aura.json").read_text(encoding="utf-8"))
contract.update(image="sprites/goku-ssj-aura-pixel.png?v=20261026-1",style="pixel-art",logicalFrameW=80,logicalFrameH=80,palette=palette.tolist(),binaryAlpha=True)
(PUBLIC/"goku-ssj-aura.json").write_text(json.dumps(contract,indent=2)+"\n",encoding="utf-8")
preview=[]
for index in list(range(8))+list(range(8,16))*3+list(range(7,-1,-1)):
    bg=Image.new("RGBA",(320,320),(48,57,70,255));bg.alpha_composite(frames[index]);preview.append(bg.convert("RGB"))
preview[0].save(HERE/"pixel-preview.gif",save_all=True,append_images=preview[1:],duration=50,loop=0)
print("16 distinct frames; exact5-color palette, binaryalpha, nearest-neighbor80pixel logicalcells")
