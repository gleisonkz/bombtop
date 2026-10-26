import { Assets, Rectangle, Texture } from "pixi.js";

export async function loadPicanhaArt(): Promise<Texture[]> {
  const atlas = await Assets.load<Texture>(`${import.meta.env.BASE_URL}sprites/picanha-pixel.png`);
  atlas.source.scaleMode = "nearest";
  return Array.from({ length: 4 }, (_, frame) => new Texture({
    source: atlas.source,
    frame: new Rectangle(frame * 64, 0, 64, 64),
  }));
}
