import { TILE } from "./constants";
import { advanceSb2Stage11Flight, startSb2Stage11Flight } from "./sb2-stage11-flight";
import { DIR_VECTORS, getTile, playerTile, tileCenter, Tile, type Facing, type MatchState, type Player, type PlayerInput } from "./state";
import { sb2ConveyorBodyBlocks } from "./sb2-conveyor";

// C210A1: espera inicial de2 passadas, depois comandos1,2,2,3,4,8.
const PREPARATION_FRAMES = 2 + [1, 2, 2, 3, 4, 8].reduce((sum, value) => sum + value, 0);
const INWARD: Record<Facing, Facing> = { left: "right", right: "left", up: "down", down: "up" };

/** C05F97: carga na borda, preparacao e projecao de lancamento. */
export function advanceSb2Stage11Player(s: MatchState, player: Player, input?: PlayerInput): boolean {
  const state = ((s.stageState!.sb2!.stage11 ??= {})[player.id] ??= { counter: 0 });
  const scale = TILE / 16;
  const moveFlight = () => {
    const previous = state.flight!;
    state.flight = advanceSb2Stage11Flight(previous);
    const hit = s.bombs.find(bomb => !bomb.air && !bomb.heldBy && !bomb.sb2Motion
      && sb2ConveyorBodyBlocks(previous.direction, { x: state.flight!.x - 8, y: state.flight!.y - 24 },
        [{ x: tileCenter(bomb.x) / scale, y: tileCenter(bomb.y) / scale }]));
    if (hit) {
      state.flight.x = previous.x;
      state.flight.y = previous.y;
      state.flight.velocity = 0;
      const [dx, dy] = DIR_VECTORS[previous.direction];
      const target = { x: hit.x + dx, y: hit.y + dy };
      // C0B1F8 exige contador estatico>=3; antes do desconto desta passada,
      // isso corresponde a pelo menos6 frames no contador do modelo.
      if (player.canKick && hit.fuse >= 6 && getTile(s, target.x, target.y) === Tile.Empty
        && !s.bombs.some(other => other !== hit && other.x === target.x && other.y === target.y)
        && !s.players.some(other => other.alive && playerTile(other).x === target.x && playerTile(other).y === target.y)) {
        hit.slide = previous.direction;
        hit.kickedBy = player.id;
        hit.sb2Motion = { px: tileCenter(hit.x), py: tileCenter(hit.y), startedAt: s.tick,
          occupied: { x: hit.x, y: hit.y }, arrowLatch: 0x8000 };
      }
    }
    player.px = (state.flight.x - 8) * scale;
    player.py = (state.flight.y - 24) * scale;
    player.facing = state.flight.direction;
    state.previousFacing = state.flight.direction;
    if (state.flight.done) { delete state.flight; state.counter = 0; }
  };
  if (state.flight) { moveFlight(); return true; }
  if (state.preparation) {
    if (++state.preparation.frame <= PREPARATION_FRAMES) return true;
    state.flight = startSb2Stage11Flight(player.px / scale + 8, player.py / scale + 24,
      state.preparation.direction, player.speed / scale);
    state.counter = 0;
    delete state.preparation;
    moveFlight();
    return true;
  }
  const dir = input?.dir;
  const x = Math.floor(player.px / scale + 8), y = Math.floor(player.py / scale + 24);
  if (!dir) state.counter = 0;
  else if (state.previousFacing === dir) {
    const atEdge = dir === "left" ? x === 32 : dir === "right" ? x === 224 : dir === "up" ? y === 48 : y === 208;
    state.counter = atEdge ? state.counter + 1 : 0;
    if (state.counter === 4) {
      state.preparation = { frame: 0, direction: INWARD[dir] };
      return true;
    }
  }
  if (dir) state.previousFacing = dir;
  return false;
}
