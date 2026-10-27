from pathlib import Path
from PIL import Image
import numpy as np,hashlib,json
HERE=Path(__file__).resolve().parent
PUBLIC=HERE.parents[1]/"apps/client/public/sprites"
CELL=64
records=[]
def cuts(pix,left,right,rows):
    h=len(pix);proj=(pix[:,left:right,3]>0).sum(1);bands=[0]
    for r in range(1,rows):
        middle=round(h*r/rows);start,end=max(0,middle-85),min(h,middle+85)
        empty=np.where(proj[start:end]==0)[0]+start
        gaps=[g for g in np.split(empty,np.where(np.diff(empty)>1)[0]+1) if len(g)]
        if not gaps: bands.append(middle);continue
        gap=min(gaps,key=lambda g:abs(float(g.mean())-middle));bands.append(round(float(gap.mean())))
    return bands+[h]
for name,rows,filename,body in [("pikachu",4,"pikachu-electric-game.png",[2,3]),("static",5,"static-electric-game.png",[3,4]),("flash",3,"flash-speed-force.png",[])]:
    original=Image.open(HERE/(name+".source.png")).convert("RGBA");a=np.array(original)
    a[:,:,3]=np.where(a[:,:,3]>=160,255,0);a[a[:,:,3]==0]=0
    source=Image.fromarray(a);h,w=a.shape[:2];out=Image.new("RGBA",(CELL*8,CELL*rows))
    for col in range(8):
        left,right=round(col*w/8),round((col+1)*w/8);bands=cuts(a,left,right,rows)
        for row in range(rows):
            top,bottom=bands[row:row+2];src=source.crop((left,top,right,bottom));box=src.getchannel("A").getbbox();assert box,(name,row,col)
            scale=(CELL-4)/(right-left)
            if row==0: scale=CELL/(right-left)
            art=src.crop(box);art=art.resize((max(1,round(art.width*scale)),max(1,round(art.height*scale))),Image.Resampling.NEAREST)
            x=(CELL-art.width)//2;y=(CELL-art.height)//2
            if row in body:
                x=round(CELL/2-((right-left)/2-box[0])*scale);y=59-art.height
            if row==0:
                pixels=np.array(src);white=(pixels[:,:,0]>225)&(pixels[:,:,1]>225)&(pixels[:,:,2]>150)&(pixels[:,:,3]>0)
                edge=white.copy();edge[:,3:-3]=False
                ys=np.where(edge)[0]
                origin=float(np.median(ys)) if len(ys) else (box[1]+box[3])/2
                x=round(box[0]*scale);y=round(CELL/2-(origin-box[1])*scale)
            frame=Image.new("RGBA",(CELL,CELL));frame.paste(art,(x,y));out.paste(frame,(col*CELL,row*CELL))
            records.append({"family":name,"row":row,"frame":col,"sourceBox":[left,top,right,bottom],"opaqueBox":list(box),"offset":[x,y]})
    # Small shared palette preserves referenceFX's native hard pixel contours without RGB transparency speckles.
    rgb=out.convert("RGB").quantize(colors=6,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert("RGB");rgb.putalpha(out.getchannel("A"));out=rgb
    for row in range(rows):
        hashes={hashlib.sha256(out.crop((c*CELL,row*CELL,(c+1)*CELL,(row+1)*CELL)).tobytes()).hexdigest() for c in range(8)}
        assert len(hashes)==8,(name,row,"Repeated phases")
    out.save(PUBLIC/filename)
    bg=Image.new("RGBA",out.size,(48,57,70,255));bg.alpha_composite(out);bg.convert("RGB").resize((1024,rows*128),Image.Resampling.NEAREST).save(HERE/(name+"-native-proof.png"))
(HERE/"packing.json").write_text(json.dumps({"cell":CELL,"phaseCount":8,"ticksPerFrame":2,"binaryAlpha":True,"paletteLimit":6,"records":records},indent=2),encoding="utf-8")
print("Native64px exports: Pikachu32/Static40/Flash24 distinctdrawings;8phase loops,6colors,binaryalpha")
