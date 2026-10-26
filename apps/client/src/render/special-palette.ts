import { Texture, type TextureSource } from "pixi.js";
import { paintTo, skinColor } from "./per-color";
import { textureFromCanvas } from "./texture-cells";

const sources = new WeakMap<TextureSource, Map<number, TextureSource>>();
const textures = new WeakMap<Texture, Map<number, Texture>>();

export function specialEffectColor(player: { ownColors?: true } | undefined, seat: number, colors: readonly number[]): number | null {
  if (!player) return null;
  const rgb = paintTo(skinColor(player, seat), colors);
  if (!rgb || rgb.every(channel => channel === 245)) return null;
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

export function specialInk(original: number, color: number | null | undefined): number {
  if (color == null) return original;
  const red = (original >> 16) & 255;
  const green = (original >> 8) & 255;
  const blue = original & 255;
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  if (high <= 32 || (low >= 208 && high - low <= 32) || (high >= 232 && low >= 176)) return original;
  const shade = high / 255;
  return (Math.round(((color >> 16) & 255) * shade) << 16)
    | (Math.round(((color >> 8) & 255) * shade) << 8)
    | Math.round((color & 255) * shade);
}

function coloredSource(source: TextureSource, color: number): TextureSource {
  let cache = sources.get(source);
  const existing = cache?.get(color);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = source.pixelWidth;
  canvas.height = source.pixelHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(source.resource as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] === 0) continue;
    const original = (image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!;
    const ink = specialInk(original, color);
    image.data[i] = (ink >> 16) & 255;
    image.data[i + 1] = (ink >> 8) & 255;
    image.data[i + 2] = ink & 255;
  }
  context.putImageData(image, 0, 0);
  const result = textureFromCanvas(canvas).source;
  result.resolution = source.resolution;
  result.scaleMode = source.scaleMode;
  result.addressMode = source.addressMode;
  cache ??= new Map();
  cache.set(color, result);
  sources.set(source, cache);
  return result;
}

export function specialTexture(texture: Texture, color: number | null | undefined): Texture {
  if (color == null) return texture;
  let cache = textures.get(texture);
  const existing = cache?.get(color);
  if (existing) return existing;
  const result = new Texture({
    source: coloredSource(texture.source, color), frame: texture.frame, orig: texture.orig,
    trim: texture.trim, rotate: texture.rotate,
    ...(texture.defaultAnchor ? { defaultAnchor: texture.defaultAnchor } : {}),
    ...(texture.defaultBorders ? { defaultBorders: texture.defaultBorders } : {}),
  });
  cache ??= new Map();
  cache.set(color, result);
  textures.set(texture, cache);
  return result;
}
