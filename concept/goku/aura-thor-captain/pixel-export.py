from pathlib import Path
from PIL import Image
import hashlib,json,numpy as np
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[2]/"apps/client/public/sprites"
board=Image.new("RGBA",(640,640))
for n in range(16):
    f=Image.open(HERE/"frames"/f"{n:02d}.png").resize((160,160),Image.Resampling.NEAREST)
    board.paste(f,((n%4)*160,(n//4)*160))
colored=board.convert("RGB").quantize(colors=16,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert("RGB")
colored.putalpha(board.getchannel("A"));sheet=colored.resize((1280,1280),Image.Resampling.NEAREST)
sheet.save(PUBLIC/"goku-ssj-aura-detailed.png")
frames=[sheet.crop(((n%4)*320,(n//4)*320,(n%4+1)*320,(n//4+1)*320)) for n in range(16)]
assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})==16
contract=json.loads((PUBLIC/"goku-ssj-aura.json").read_text(encoding="utf-8"))
height=sum(f.getchannel("A").getbbox()[3]-f.getchannel("A").getbbox()[1] for f in frames[8:])/8
contract.update(image="sprites/goku-ssj-aura-detailed.png?v=thor-cap-20261026",style="detailed-pixel-art-thor-captain",logicalFrameW=160,logicalFrameH=160,binaryAlpha=True,paletteLimit=16,fullAuraHeight=height,nativeScaleForA1=104*1.45/height)
(PUBLIC/"goku-ssj-aura.json").write_text(json.dumps(contract,indent=2)+"\n",encoding="utf-8")
preview=[]
for n in list(range(8))+list(range(8,16))*3+list(range(7,-1,-1)):
    bg=Image.new("RGBA",(320,320),(48,57,70,255));bg.alpha_composite(frames[n]);preview.append(bg.convert("RGB"))
preview[0].save(HERE/"aura-preview.gif",save_all=True,append_images=preview[1:],duration=50,loop=0)
print("Goku finepixel aura:16distinctframes,160logicalpixels,16colors; existinganimation/anchorcontract")
