import { TILE } from "./constants";
import { playerElevated } from "./player-carry";
import { sb2IceAxisVelocity } from "./sb2-ice";
import { moveSb2Player } from "./sb2-movement";
import { sb2ConveyorBodyBlocks } from "./sb2-conveyor";
import { SB2_STAGE_CAPTURES } from "./sb2-stage-captures";
import { sb2Stage2PreparationStep, sb2Stage2RouteStep, sb2Stage2ExitStep,
  type Sb2Stage2Preparation, type Sb2Stage2RouteMotion, type Sb2Stage2ExitMotion } from "./sb2-stage2-route";
import { DIR_VECTORS, playerTile, tileCenter, bombAt, getTile, hasFlame, Tile, type Direction, type MatchState, type Player } from "./state";

export interface Sb2Stage2Transport {
  preparation?: Sb2Stage2Preparation;
  route: Sb2Stage2RouteMotion;
  exit?: Sb2Stage2ExitMotion;
}

function transportPlayer(s: MatchState, player: Player): boolean {
  const runtime = s.stageState!.sb2!;
  const transports = runtime.stage2Transport ??= {};
  let transport = transports[player.id];
  const scale = TILE / 16;
  const position = { x: player.px / scale + 8, y: player.py / scale + 24 };
  const x = Math.floor((position.x - 8) / 16), y = Math.floor((position.y - 25) / 16);
  const background = SB2_STAGE_CAPTURES[1].background;
  const circle = ((background[y]?.[x] ?? 0) & 63) === 9 && getTile(s, x, y) === Tile.Empty
    && !hasFlame(s, x, y) && !bombAt(s, x, y) && !s.items.some(item => item.x === x && item.y === y);
  const center = () => {
    position.x = (x + 1) * 16 + position.x - Math.floor(position.x);
    position.y = (y + 2) * 16 + position.y - Math.floor(position.y);
  };
  if (!transport && circle && !((runtime.closure?.flags ?? 0) & 1)) {
    center();
    transport = transports[player.id] = { preparation: { elapsed: 0 }, route: { facing: player.facing, junction: false } };
  }
  if (!transport) return false;
  let velocity = { vx: 0, vy: 0 };
  if (transport.preparation) {
    const result = sb2Stage2PreparationStep(transport.preparation, (y + 3) * 128 + (x + 1) * 2);
    if (result.launched) {
      delete transport.preparation;
      transport.route.facing = result.velocityY > 0 ? "down" : "up";
      position.y += result.displacementY + result.velocityY;
      velocity.vy = result.velocityY;
    }
  } else {
    if (!transport.exit && circle) {
      center();
      const below = getTile(s, x, y + 1);
      transport.exit = { velocity: 8, ascending: true, slow: false,
        target: { x, y: below === Tile.Wall || below === Tile.Block ? y - 1 : y + 1 } };
    }
    if (transport.exit) {
      const result = sb2Stage2ExitStep(position, transport.exit);
      velocity.vy = result.vy;
      if (result.landed) delete transports[player.id];
    } else velocity = sb2Stage2RouteStep(position, transport.route, background, runtime.randomHistory?.[3] ?? 0);
  }
  (runtime.ice ??= {})[player.id] = velocity;
  player.px = (position.x - 8) * scale;
  player.py = (position.y - 24) * scale;
  player.facing = transport.route.facing;
  return true;
}

/** Gelo e transporte internos; outras entradas/interações ainda exigem ensaios. */
export function moveSb2Stage2Player(s: MatchState, player: Player, input: Direction): void {
  if (!player.alive || playerElevated(player)) return;
  if (transportPlayer(s, player)) return;
  const runtime = s.stageState!.sb2!;
  const velocity = (runtime.ice ??= {})[player.id] ??= { vx: 0, vy: 0 };
  const facings = runtime.iceFacing ??= {};
  const previousFacing = facings[player.id] ?? player.facing;
  if (input) facings[player.id] = input;
  // C0C139 conserva a velocidade X sem controle horizontal. Na deriva já
  // orientada verticalmente, a colisão usa o cruzamento inteiro de qualquer
  // eixo e a coluna transversal anterior ao avanço (captura delay-2).
  if ((input === "up" || input === "down") && input === previousFacing && velocity.vx) {
    const scale = TILE / 16;
    const across = player.px / scale, along = player.py / scale;
    const column = Math.floor(across / 16), row = Math.floor((along - 1) / 16);
    const center = column * 16 + 8;
    if (Math.floor(across) !== center) {
      const sign = input === "down" ? 1 : -1;
      velocity.vy = sb2IceAxisVelocity(velocity.vy, sign);
      const nextX = across + velocity.vx, nextY = along + velocity.vy;
      const crosses = Math.floor(nextX) !== Math.floor(across) || Math.floor(nextY) !== Math.floor(along);
      const side = Math.sign(Math.floor(across) - center);
      const passable = (x: number, y: number) => {
        const tile = getTile(s, x, y);
        return (tile === Tile.Empty || tile === Tile.Block && player.canBlockPass)
          && (player.canBombPass || !bombAt(s, x, y));
      };
      const blocked = crosses && (!passable(column, row + sign)
        || side !== 0 && !passable(column + side, row + sign));
      moveSb2Player(s, player, velocity.vx < 0 ? "left" : "right", Math.abs(velocity.vx), 0, true, 0, false);
      player.py = (blocked ? along : nextY) * scale;
      if (blocked) velocity.vy = 0;
      return;
    }
    velocity.vx = 0;
  }
  const verticalRestart = velocity.verticalRestart;
  delete velocity.verticalRestart;
  if (input) {
    const [dx, dy] = DIR_VECTORS[input];
    if (dx) { velocity.vx = sb2IceAxisVelocity(velocity.vx, dx as -1 | 1); velocity.vy = 0; }
    else {
      const previous = velocity.vy;
      velocity.vy = verticalRestart ? 0 : sb2IceAxisVelocity(previous, dy as -1 | 1);
      velocity.vx = 0;
      // A trava vertical C0C1E3/C0A2F3 mantém um segundo frame zero na reversão medida.
      if (previous && !velocity.vy && Math.sign(previous) !== dy && Math.abs(previous) < 1) velocity.verticalRestart = true;
    }
  }
  const horizontal = velocity.vx !== 0;
  const speed = horizontal ? velocity.vx : velocity.vy;
  if (!speed) return;
  const direction = horizontal ? speed < 0 ? "left" : "right" : speed < 0 ? "up" : "down";
  const scale = TILE / 16;
  const along = horizontal ? player.px : player.py;
  const across = horizontal ? player.py : player.px;
  const next = along + speed * scale;
  // A consulta de colisão e a correção transversal exigem cruzar um pixel inteiro.
  if (Math.floor(next / scale) === Math.floor(along / scale)) {
    if (horizontal) player.px = next;
    else player.py = next;
    return;
  }
  const at = playerTile(player);
  moveSb2Player(s, player, direction, Math.abs(speed), 1.25, true, 1.25, false);
  const bodies = player.canBombPass ? [] : s.bombs
    .filter(bomb => !bomb.air && !bomb.heldBy && (bomb.x !== at.x || bomb.y !== at.y))
    .map(bomb => ({ x: tileCenter(bomb.x) / scale, y: tileCenter(bomb.y) / scale }));
  const proposed = horizontal ? { x: next / scale, y: across / scale } : { x: across / scale, y: next / scale };
  if (sb2ConveyorBodyBlocks(direction, proposed, bodies)) {
    if (horizontal) { player.px = along; velocity.vx = 0; }
    else { player.py = along; velocity.vy = 0; }
    return;
  }
  const actualAlong = horizontal ? player.px : player.py;
  const actualAcross = horizontal ? player.py : player.px;
  if (actualAlong !== next && actualAcross === across) {
    if (horizontal) velocity.vx = 0;
    else velocity.vy = 0;
  }
}
