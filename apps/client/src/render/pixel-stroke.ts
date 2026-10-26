import type { Graphics } from "pixi.js";

export function pixelStroke(g: Graphics, line: { x0: number; y0: number; x1: number; y1: number; width: number; color: number; alpha: number }): void {
  const grid = 0.5;
  const dx = line.x1 - line.x0;
  const dy = line.y1 - line.y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / grid));
  const size = Math.max(grid, Math.round(line.width / grid) * grid);
  let previous = "";
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const x = Math.round((line.x0 + dx * t - size / 2) / grid) * grid;
    const y = Math.round((line.y0 + dy * t - size / 2) / grid) * grid;
    const key = `${x},${y}`;
    if (key === previous) continue;
    previous = key;
    g.rect(x, y, size, size).fill({ color: line.color, alpha: line.alpha });
  }
}
