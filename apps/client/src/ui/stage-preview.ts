import { createMatch, Floor, getFloor, getTile, SB4_STAGES, TILE, Tile, type MatchState, type StageId } from "@bombtop/shared";
import { TILES, tileCell } from "../render/sprites";
import { sb4TileLayout } from "../render/stage-art";
import { el } from "./dom";

const previews = new Map<StageId, Promise<string>>();
const assets = new Map<string, Promise<HTMLImageElement>>();
const beltRows = new Map([[Floor.ConveyorRight, 0], [Floor.ConveyorDown, 1], [Floor.ConveyorLeft, 2], [Floor.ConveyorUp, 3]]);
const floorProps = new Map([
  [Floor.Pit, "forest-pit"], [Floor.Surprise, "direction-panel"], [Floor.Foliage, "foliage"],
  [Floor.Slot, "slot-switch"], [Floor.Seesaw, "seesaw"], [Floor.Flag, "flag"],
]);

function runtimeProps(state: MatchState): { prop: string; x: number; y: number }[] {
  const dynamic = state.stageState;
  const props = [
    ...(dynamic?.balls ?? []).map(ball => ({ prop: "rolling-ball", x: ball.px / TILE - 0.5, y: ball.py / TILE - 0.5 })),
    ...(dynamic?.flags ?? []).filter(flag => !flag.destroyed && !flag.carriedBy).map(flag => ({ prop: "flag", x: flag.x, y: flag.y })),
    ...(dynamic?.seesaws ?? []).map(seesaw => ({ prop: "seesaw", x: seesaw.x, y: seesaw.y })),
    ...(dynamic?.honey ?? []).filter(honey => !honey.takenBy && getTile(state, honey.x, honey.y) === Tile.Empty)
      .map(honey => ({ prop: "costume-mask", x: honey.x, y: honey.y })),
  ];
  const trolley = dynamic?.trolley;
  if (trolley) props.push({ prop: "trolley", x: trolley.px / TILE - 0.5, y: trolley.py / TILE - 0.5 });
  return props;
}

function drawRail(context: CanvasRenderingContext2D, state: MatchState, x: number, y: number, size: number): void {
  const cx = (x + 0.5) * size;
  const cy = (y + 0.5) * size;
  context.beginPath();
  context.strokeStyle = "#bfc5ce";
  context.lineWidth = size / 16;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    if (getFloor(state, x + dx, y + dy) !== Floor.Rail) continue;
    for (const offset of [-3, 3]) {
      context.moveTo(cx + dy * offset * size / 16, cy + dx * offset * size / 16);
      context.lineTo(cx + dx * size / 2 + dy * offset * size / 16, cy + dy * size / 2 + dx * offset * size / 16);
    }
  }
  context.stroke();
}

function loadImage(path: string): Promise<HTMLImageElement> {
  let asset = assets.get(path);
  if (asset) return asset;
  asset = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Stage preview: ${path}`));
    image.src = `${import.meta.env.BASE_URL}${path}`;
  });
  assets.set(path, asset);
  return asset;
}

async function renderPreview(stage: StageId): Promise<string> {
  const number = SB4_STAGES.findIndex(id => id === stage) + 1;
  const layout = sb4TileLayout(number) ?? TILES;
  const state = createMatch({ seed: 14, stage, playerIds: ["preview1", "preview2"], blockDensity: 0.4 });
  const { grid } = state;
  const dynamicProps = runtimeProps(state);
  const dynamicArt = new Map<string, HTMLImageElement>();
  const props = new Map<Floor, HTMLImageElement>();
  const [tiles, belts, portals] = await Promise.all([
    loadImage(layout.url), loadImage("sprites/conveyors.png"), loadImage("sprites/ground-effects.png"),
    ...Array.from(floorProps, async ([floor, prop]) => {
      if (!grid.floor.includes(floor)) return;
      props.set(floor, await loadImage(`sprites/sb4-battle/prop-${prop}.png`));
    }),
    ...Array.from(new Set(dynamicProps.map(({ prop }) => prop)), async prop => {
      dynamicArt.set(prop, await loadImage(`sprites/sb4-battle/prop-${prop}.png`));
    }),
  ]);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = grid.width * size;
  canvas.height = grid.height * size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Stage preview: canvas unavailable");
  context.imageSmoothingEnabled = false;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = grid.tiles[y * grid.width + x]!;
      const cell = tileCell(tile, x, y, grid.width, grid.height);
      context.drawImage(tiles, cell * layout.size, 0, layout.size, layout.size, x * size, y * size, size, size);
      if (tile !== Tile.Empty) continue;
      const floor = getFloor(state, x, y);
      if (floor === Floor.Rail) drawRail(context, state, x, y, size);
      const row = beltRows.get(floor);
      if (row !== undefined) context.drawImage(belts, 0, row * 128, 128, 128, x * size, y * size, size, size);
      if (floor === Floor.Warp) context.drawImage(portals, 0, 0, 128, 128, x * size + 2, y * size + 2, size - 4, size - 4);
      const prop = props.get(floor);
      if (floor === Floor.Flag && state.stageState?.flags) continue;
      if (floor === Floor.Seesaw && state.stageState?.seesaws) continue;
      if (prop) context.drawImage(prop, x * size, y * size, size, size);
    }
  }
  for (const { prop, x, y } of dynamicProps) {
    const image = dynamicArt.get(prop);
    if (image) context.drawImage(image, x * size, y * size, size, size);
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
  let preview = previews.get(stage);
  if (!preview) {
    preview = renderPreview(stage);
    previews.set(stage, preview);
  }
  void preview.then(src => { image.src = src; }).catch(() => { image.hidden = true; });
  return image;
}
