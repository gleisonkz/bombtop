from pathlib import Path
from PIL import Image
import numpy as np, hashlib,json
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[2]/"apps/client/public/sprites"
CELL=128

def clean(im):
    a=np.array(im.convert("RGBA"));a[:,:,3]=np.where(a[:,:,3]>=128,255,0);a[a[:,:,3]==0]=0
    return Image.fromarray(a)

def quantize(sheet):
    rgb=sheet.convert("RGB").quantize(colors=16,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(sheet.getchannel("A"));return rgb

special=clean(Image.open(HERE/"special.source.png"));out=Image.new("RGBA",(CELL*4,CELL*3));records=[]
for row in range(3):
    for col in range(4):
        box=(round(col*special.width/4),round(row*special.height/3),round((col+1)*special.width/4),round((row+1)*special.height/3))
        src=special.crop(box);bbox=src.getchannel("A").getbbox();assert bbox
        art=src.crop(bbox);scale=(CELL-4)/max(box[2]-box[0],box[3]-box[1])
        art=art.resize((max(1,round(art.width*scale)),max(1,round(art.height*scale))),Image.Resampling.NEAREST)
        frame=Image.new("RGBA",(CELL,CELL));frame.paste(art,((CELL-art.width)//2,(CELL-art.height)//2))
        out.paste(frame,(col*CELL,row*CELL));records.append({"kind":"special","row":row,"col":col,"sourceBox":box,"opaqueBox":bbox})
out=quantize(out);out.save(PUBLIC/"static-special-detailed.png")
charge=clean(Image.open(HERE/"charge.source.png"));pix=np.array(charge);h,w=pix.shape[:2];outcharge=Image.new("RGBA",(CELL*8,CELL*2))
for col in range(4):
    left,right=round(col*w/4),round((col+1)*w/4);projection=(pix[:,left:right,3]>0).sum(1);bands=[0]
    for row in range(1,4):
        middle=round(h*row/4);start,end=max(0,middle-100),min(h,middle+100)
        empty=np.where(projection[start:end]==0)[0]+start
        gaps=[g for g in np.split(empty,np.where(np.diff(empty)>1)[0]+1) if len(g)]
        assert gaps,"Charge rows touch"
        gap=min(gaps,key=lambda g:abs(float(g.mean())-middle));bands.append(round(float(gap.mean())))
    bands.append(h)
    for row in range(4):
        top,bottom=bands[row:row+2];src=charge.crop((left,top,right,bottom));bbox=src.getchannel("A").getbbox();assert bbox
        art=src.crop(bbox);scale=(CELL-8)/(right-left)
        art=art.resize((max(1,round(art.width*scale)),max(1,round(art.height*scale))),Image.Resampling.NEAREST)
        frame=Image.new("RGBA",(CELL,CELL));x=round(CELL/2-((right-left)/2-bbox[0])*scale);y=120-art.height
        assert x>=0 and y>=0 and x+art.width<=CELL
        frame.paste(art,(x,y));n=row*4+col;destrow=n//8;destcol=n%8
        outcharge.paste(frame,(destcol*CELL,destrow*CELL));records.append({"kind":"charge","phase":n,"sourceBox":[left,top,right,bottom],"offset":[x,y]})
outcharge=quantize(outcharge);outcharge.save(PUBLIC/"static-charge-detailed.png")
for label,sheet,cols,rows in [("special",out,4,3),("charge",outcharge,8,2)]:
    for row in range(rows):
        hashes={hashlib.sha256(sheet.crop((col*CELL,row*CELL,(col+1)*CELL,(row+1)*CELL)).tobytes()).hexdigest() for col in range(cols)}
        assert len(hashes)==cols,(label,row,"Repeateddrawings")
(HERE/"packing.json").write_text(json.dumps({"cell":CELL,"paletteLimit":16,"binaryAlpha":True,"records":records},indent=2),encoding="utf-8")
print("Static:12special+16pairedbodydrawings;128pxcells,16colors,binaryalpha; rowgapsmeasured")
