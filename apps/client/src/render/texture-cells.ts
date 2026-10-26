import { Texture } from "pixi.js";

export function textureFromCanvas(canvas: HTMLCanvasElement): Texture {
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "linear";
  texture.source.addressMode = "clamp-to-edge";
  return texture;
}

export function isolatedTextureRow(image: CanvasImageSource, row: number, size: number, frames: number): Texture[] {
  return Array.from({ length: frames }, (_, frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d")!.drawImage(image, frame * size, row * size, size, size, 0, 0, size, size);
    return textureFromCanvas(canvas);
  });
}
