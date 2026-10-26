import { conveyorDirection, DIR_VECTORS, getFloor, TICK_RATE, TILE, updateSlides, type Bomb, type MatchState, type PublicView } from "@bombtop/shared";

const MAX_LEAD_MS = 150;

function position(bomb: Bomb): [number, number] {
  const [dx, dy] = bomb.slide ? DIR_VECTORS[bomb.slide] : [0, 0];
  return [bomb.x * TILE + dx * bomb.offset, bomb.y * TILE + dy * bomb.offset];
}

function interpolate(current: Bomb, future: Bomb, fraction: number): Bomb {
  if (fraction === 0) return current;
  const [cx, cy] = position(current);
  const [fx, fy] = position(future);
  const slide = current.offset > 0 ? current.slide : future.slide;
  if (!slide) return future;
  const [dx, dy] = DIR_VECTORS[slide];
  const x = cx + (fx - cx) * fraction;
  const y = cy + (fy - cy) * fraction;
  const offset = (x - current.x * TILE) * dx + (y - current.y * TILE) * dy;
  const result = { ...current, slide, offset };
  if (current.offset > 0 ? current.conveyor : future.conveyor) result.conveyor = true;
  else delete result.conveyor;
  return result;
}

export function smoothBombSlides(authoritative: PublicView, predicted: PublicView, elapsedMs: number): PublicView {
  const ticks = Math.min(MAX_LEAD_MS, Math.max(0, elapsedMs)) * TICK_RATE / 1000;
  const canMove = (b: Bomb) => !b.air && !b.heldBy && (b.slide || conveyorDirection(getFloor(authoritative, b.x, b.y)));
  if (ticks <= 0 || !authoritative.bombs.some(canMove)) return predicted;

  const state = { ...authoritative, bombs: authoritative.bombs.map((b) => ({ ...b })) } as MatchState;
  for (let t = 0; t < Math.floor(ticks); t++) updateSlides(state);
  const whole = state.bombs;
  const fraction = ticks - Math.floor(ticks);
  const next = whole.map((b) => ({ ...b }));
  if (fraction > 0) updateSlides({ ...state, bombs: next });

  let result: Bomb[] | null = null;
  predicted.bombs.forEach((bomb, index) => {
    const source = authoritative.bombs[index];
    if (!source || !canMove(source) || bomb.x !== source.x || bomb.y !== source.y || bomb.offset !== source.offset || bomb.slide !== source.slide || bomb.conveyor !== source.conveyor) return;
    const current = whole[index]!;
    const future = next[index]!;
    const { x, y, offset, slide, conveyor } = interpolate(current, future, fraction);
    if (x === bomb.x && y === bomb.y && offset === bomb.offset && slide === bomb.slide && conveyor === bomb.conveyor) return;
    result ??= [...predicted.bombs];
    const rendered = { ...bomb, x, y, offset, slide };
    if (conveyor) rendered.conveyor = true;
    else delete rendered.conveyor;
    result[index] = rendered;
  });
  return result ? { ...predicted, bombs: result } : predicted;
}
