import { Assets, Texture } from "pixi.js";
import { FLAMES } from "./sprites";

export interface FlameArt {
  center: Texture[][];
  mid: Texture[][];
  end: Texture[];
}

export async function loadFlameArt(url = `${import.meta.env.BASE_URL}${FLAMES.url}`): Promise<FlameArt> {
  const sheet: Texture = await Assets.load(url);
  const image = sheet.source.resource as CanvasImageSource;
  const textureFromCanvas = (canvas: HTMLCanvasElement) => {
    const texture = Texture.from(canvas);
    texture.source.scaleMode = "linear";
    texture.source.addressMode = "clamp-to-edge";
    return texture;
  };
  const row = (r: number) => Array.from({ length: FLAMES.frames }, (_, frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = FLAMES.size;
    canvas.height = FLAMES.size;
    canvas.getContext("2d")!.drawImage(image, frame * FLAMES.size, r * FLAMES.size, FLAMES.size, FLAMES.size, 0, 0, FLAMES.size, FLAMES.size);
    return textureFromCanvas(canvas);
  });
  const centers = row(FLAMES.rows.center);
  const mid = Array.from({ length: FLAMES.variants }, (_, variant) => row(FLAMES.rows.mid + variant));
  const joins = Array.from({ length: FLAMES.frames }, (_, frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = FLAMES.size;
    canvas.height = FLAMES.size;
    const height = Math.round(FLAMES.size * FLAMES.scale / FLAMES.centerScale);
    canvas.getContext("2d")!.drawImage(mid[0]![frame]!.source.resource as CanvasImageSource, 0, 0, 1, FLAMES.size, FLAMES.size / 2, (FLAMES.size - height) / 2, FLAMES.size / 2, height);
    return canvas;
  });
  const center = Array.from({ length: 16 }, (_, connections) => centers.map((base, frame) => {
    if (connections === 0) return base;
    const canvas = document.createElement("canvas");
    canvas.width = FLAMES.size;
    canvas.height = FLAMES.size;
    const ctx = canvas.getContext("2d")!;
    for (let direction = 0; direction < 4; direction++) {
      if (!(connections & (1 << direction))) continue;
      ctx.save();
      ctx.translate(FLAMES.size / 2, FLAMES.size / 2);
      ctx.rotate(direction * Math.PI / 2);
      ctx.drawImage(joins[frame]!, -FLAMES.size / 2, -FLAMES.size / 2);
      ctx.restore();
    }
    ctx.drawImage(base.source.resource as CanvasImageSource, 0, 0);
    return textureFromCanvas(canvas);
  }));
  return {
    center,
    mid,
    end: row(FLAMES.rows.end),
  };
}
