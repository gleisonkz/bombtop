from pathlib import Path
from PIL import Image
import numpy as np,hashlib,json
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[1]/"apps/client/public/sprites"
CELL=128
records=[]
def clean(im):
    a=np.array(im.convert("RGBA"));a[:,:,3]=np.where(a[:,:,3]>=128,255,0);a[a[:,:,3]==0]=0
    return Image.fromarray(a)
def quant(im,count):
    rgb=im.convert("RGB").quantize(colors=count,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(im.getchannel("A"));return rgb
def bandcuts(pix,left,right,rows):
    h=len(pix);projection=(pix[:,left:right,3]>0).sum(1);bands=[0]
    for r in range(1,rows):
        middle=round(h*r/rows);start,end=max(0,middle-100),min(h,middle+100)
        empty=np.where(projection[start:end]==0)[0]+start
        gaps=[g for g in np.split(empty,np.where(np.diff(empty)>1)[0]+1) if len(g)]
        assert gaps,"Effect cores overlap rows"
        gap=min(gaps,key=lambda g:abs(float(g.mean())-middle));bands.append(round(float(gap.mean())))
    bands.append(h);return bands
pika=clean(Image.open(HERE/"pikachu.source.png"));pix=np.array(pika);h,w=pix.shape[:2];board=Image.new("RGBA",(512,512))
for col in range(4):
    left,right=round(col*w/4),round((col+1)*w/4);bands=bandcuts(pix,left,right,4)
    for row in range(4):
        top,bottom=bands[row:row+2];src=pika.crop((left,top,right,bottom));box=src.getchannel("A").getbbox();assert box
        art=src.crop(box);scale=120/(right-left);art=art.resize((max(1,round(art.width*scale)),max(1,round(art.height*scale))),Image.Resampling.NEAREST)
        frame=Image.new("RGBA",(128,128));x=(128-art.width)//2;y=(128-art.height)//2
        if row==3:
            x=round(64-((right-left)/2-box[0])*scale);y=118-art.height
        assert x>=0 and y>=0 and x+art.width<=128
        frame.paste(art,(x,y));board.paste(frame,(col*128,row*128));records.append({"kind":"pikachu","row":row,"col":col,"sourceBox":[left,top,right,bottom],"offset":[x,y]})
board=quant(board,16);board.save(PUBLIC/"pikachu-special-detailed.png")
don=clean(Image.open(HERE/"donatello.source.png"));pix=np.array(don);h,w=pix.shape[:2];dboard=Image.new("RGBA",(1024,128))
for col in range(4):
    left,right=round(col*w/4),round((col+1)*w/4);bands=bandcuts(pix,left,right,2)
    for row in range(2):
        top,bottom=bands[row:row+2];src=don.crop((left,top,right,bottom));box=src.getchannel("A").getbbox();assert box
        art=src.crop(box);scale=120/(right-left);art=art.resize((max(1,round(art.width*scale)),max(1,round(art.height*scale))),Image.Resampling.NEAREST)
        frame=Image.new("RGBA",(128,128));x=(128-art.width)//2;y=(128-art.height)//2;frame.paste(art,(x,y));n=row*4+col
        dboard.paste(frame,(n*128,0));records.append({"kind":"donatello","frame":n,"sourceBox":[left,top,right,bottom],"offset":[x,y]})
dboard=quant(dboard,12);dboard.save(PUBLIC/"donatello-spin-detailed.png")
for label,atlas,cols,rows in [("pikachu",board,4,4),("donatello",dboard,8,1)]:
    frames=[]
    for row in range(rows):
        cells=[atlas.crop((col*128,row*128,(col+1)*128,(row+1)*128)) for col in range(cols)]
        assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in cells})==cols
        frames+=cells
    preview=[]
    for f in frames:
        bg=Image.new("RGBA",(128,128),(48,57,70,255));bg.alpha_composite(f);preview.append(bg.convert("RGB").resize((384,384),Image.Resampling.NEAREST))
    preview[0].save(HERE/(label+"-preview.gif"),save_all=True,append_images=preview[1:],duration=50,loop=0)
(HERE/"packing.json").write_text(json.dumps({"cell":128,"binaryAlpha":True,"records":records},indent=2),encoding="utf-8")
print("Packed Pikachu16distinctdrawings4x4 and Donatello8distinctdrawings8x1;128cells,binaryalpha,16/12palettecolors")
