interface ProtectedRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ColorProtection {
  frameW: number;
  frameH: number;
  rows: readonly (readonly (readonly ProtectedRegion[] | null)[])[];
}

export function sheetProtection({ width, frameW, frameH, colorProtection }: {
  width: number; frameW: number; frameH: number; colorProtection?: ColorProtection;
}, firstRow: number): ((index: number) => boolean) | undefined {
  if (!colorProtection) return undefined;
  const sx = colorProtection.frameW / frameW;
  const sy = colorProtection.frameH / frameH;
  return (index) => {
    const pixel = index / 4;
    const px = pixel % width;
    const py = Math.floor(pixel / width);
    const row = firstRow + Math.floor(py / frameH);
    const column = Math.floor(px / frameW);
    const x = (px % frameW + 0.5) * sx;
    const y = (py % frameH + 0.5) * sy;
    const regions = colorProtection.rows[row]?.[column];
    return regions?.some((region) => x >= region.left && x < region.right && y >= region.top && y < region.bottom) ?? false;
  };
}
