import { createMatch, Floor, Tile, type StageId } from "@bombtop/shared";
import { TILES, tileCell } from "../render/sprites";
import { el } from "./dom";

const previews = new Map<StageId, Promise<string>>();
let art: Promise<HTMLImageElement[]> | undefined;
const beltRows = new Map([[Floor.ConveyorRight, 0], [Floor.ConveyorDown, 1], [Floor.ConveyorLeft, 2], [Floor.ConveyorUp, 3]]);

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Stage preview: ${path}`));
    image.src = `${import.meta.env.BASE_URL}${path}`;
  });
}

async function renderPreview(stage: StageId): Promise<string> {
  art ??= Promise.all([loadImage(TILES.url), loadImage("sprites/conveyors.png"), loadImage("sprites/ground-effects.png")]);
  const [tiles, belts, portals] = await art;
  const { grid } = createMatch({ seed: 14, stage, playerIds: ["preview1", "preview2"], blockDensity: 0.4 });
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = grid.width * size;
  canvas.height = grid.height * size;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = grid.tiles[y * grid.width + x]!;
      const cell = tileCell(tile, x, y, grid.width, grid.height);
      context.drawImage(tiles!, cell * TILES.size, 0, TILES.size, TILES.size, x * size, y * size, size, size);
      if (tile !== Tile.Empty) continue;
      const floor = grid.floor[y * grid.width + x];
      const row = floor === undefined ? undefined : beltRows.get(floor);
      if (row !== undefined) context.drawImage(belts!, 0, row * 128, 128, 128, x * size, y * size, size, size);
      if (floor === Floor.Warp) context.drawImage(portals!, 0, 0, 128, 128, x * size + 2, y * size + 2, size - 4, size - 4);
    }
  }
  return canvas.toDataURL("image/png");
}

export function stagePreview(stage: StageId): HTMLImageElement {
  const image = el("img", { class: "stage-preview" });
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.setAttribute("data-stage", stage);
  image.width = 150;
  image.height = 130;
  if (stage === "sb4-01" || stage === "sb4-02") {
    image.src = `${import.meta.env.BASE_URL}sprites/sb4-battle/stage-${stage.slice(-2)}.png`;
    return image;
  }
  let preview = previews.get(stage);
  if (!preview) {
    preview = renderPreview(stage);
    previews.set(stage, preview);
  }
  void preview.then(src => { image.src = src; }).catch(() => { image.hidden = true; });
  return image;
}
