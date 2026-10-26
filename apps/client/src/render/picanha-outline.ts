import type { Texture } from "pixi.js";
import { textureFromCanvas } from "./texture-cells";

const outlines = new WeakMap<Texture, Map<number, Texture>>();

/** Paint only the expanded silhouette, then restore the untouched meat over it. */
export function picanhaOutline(texture: Texture, color: number | null): Texture {
  if (color === null) return texture;
  let cache = outlines.get(texture);
  const cached = cache?.get(color);
  if (cached) return cached;
  const { x, y, width, height } = texture.frame;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const source = texture.source.resource as CanvasImageSource;
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    context.drawImage(source, x, y, width, height, dx!, dy!, width, height);
  }
  context.globalCompositeOperation = "source-in";
  context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  const result = textureFromCanvas(canvas);
  result.source.scaleMode = "nearest";
  cache ??= new Map();
  cache.set(color, result);
  outlines.set(texture, cache);
  return result;
}
