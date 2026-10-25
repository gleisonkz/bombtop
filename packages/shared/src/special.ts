import { launch } from "./air";
import { addFlame } from "./bombs";
import { effectiveRange } from "./curse";
import { BLAST_TICKS, FUSE_TICKS, BOLT_RANGE, BUBBLE_COOLDOWN, BUBBLE_TICKS, FLASH_RANGE, KAME_CHARGE, KAME_COOLDOWN, KAME_RANGE, MAGNET_RANGE, MEGA_COOLDOWN, RASENGAN_PUSH, RASENGAN_TICKS, RASENGAN_TICKS_PER_TILE, SHIELD_TICKS, SPECIAL_COOLDOWN, SPECIAL_STUN_TICKS, THUNDER_RANGE, KISS_RANGE, SNEAK_TICKS, PATRONUS_COOLDOWN, PATRONUS_FADE, PATRONUS_TICKS_PER_TILE, BALL_RANGE, TILE, TRUCK_COOLDOWN, TRUCK_SHIFT, TRUCK_TICKS, TRUCK_TICKS_PER_TILE, TUNNEL_RANGE, WEB_RANGE, WEB_TICKS } from "./constants";
import { bombAt, DIR_VECTORS, getTile, hasFlame, ItemKind, playerTile, Tile, tileCenter, type Blast, type BlastKind, type Facing, type MatchState, type Player } from "./state";

const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

/**
 * The player's special, when ready.
 * Thor: a lightning bolt straight ahead that stuns the first player within BOLT_RANGE tiles; walls, blocks and bombs
 *   stop it.
 * Spider: a web shot the same way that wraps up the first player within WEB_RANGE tiles.
 * Captain: raises his shield for SHIELD_TICKS (see `shieldAt`).
 * Goku: charges for KAME_CHARGE ticks, then fires the Kamehameha (see `kamehameha`).
 * Naruto: dashes ahead with the Rasengan (see `updateRasengan`).
 * Bomb mascot: plants a mega bomb on his tile, piercing and twice his fire.
 * Pikachu: a thunder shock all around him (see `thunder`).
 * Flash: a dash at super speed straight ahead (see `superSpeed`).
 * Green lantern: a bubble around him for BUBBLE_TICKS that no fire gets into (he moves at half speed inside).
 * Bugs: digs a tunnel and comes out ahead (see `tunnel`).
 * Static: a magnet pull the same way that drags the first player within MAGNET_RANGE tiles next to him, stunned.
 * Donatello: spins his bo staff all around him (see `staffSpin`).
 * Penelope: blows a kiss the same way that charms the first player within KISS_RANGE tiles, stunned.
 * Pink panther: tiptoes out of the rivals' sight for SNEAK_TICKS.
 * Harry: expecto patronum, his stag gallops straight ahead (see `patronus`).
 * Pelé: kicks a ball the same way that knocks down the first player within BALL_RANGE tiles, stunned; a bomb in its way is
 *   kicked off sliding.
 * Lula: a promise of picanha, left on the tile in front of him (see `picanha`).
 * Optimus: roll out, turns into his truck and drives straight ahead (see `updateTruck`).
 */
export function useSpecial(s: MatchState, p: Player): boolean {
  if (p.specialCooldown > 0) return false;
  if (p.character === "captain") {
    p.shield = SHIELD_TICKS;
  } else if (p.character === "thor") {
    blast(s, "lightning", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "spider") {
    blast(s, "web", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "pele") {
    blast(s, "ball", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "penelope") {
    blast(s, "kiss", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "harry") {
    patronus(s, p);
    p.specialCooldown = PATRONUS_COOLDOWN;
    return true;
  } else if (p.character === "optimus") {
    const { x, y } = playerTile(p);
    p.px = tileCenter(x);
    p.py = tileCenter(y);
    p.truck = TRUCK_SHIFT + TRUCK_TICKS;
    p.specialCooldown = TRUCK_COOLDOWN;
    return true;
  } else if (p.character === "panther") {
    p.sneak = SNEAK_TICKS;
  } else if (p.character === "static") {
    blast(s, "magnet", p.id, playerTile(p), p.facing, true);
  } else if (p.character === "flash") {
    superSpeed(s, p);
  } else if (p.character === "lantern") {
    p.bubble = BUBBLE_TICKS;
    p.specialCooldown = BUBBLE_COOLDOWN;
    return true;
  } else if (p.character === "bugs") {
    if (!tunnel(s, p)) return false;
  } else if (p.character === "pikachu") {
    thunder(s, p);
  } else if (p.character === "donatello") {
    staffSpin(s, p);
  } else if (p.character === "goku") {
    p.charge = KAME_CHARGE;
    p.specialCooldown = KAME_COOLDOWN;
    return true;
  } else if (p.character === "naruto") {
    const { x, y } = playerTile(p);
    p.px = tileCenter(x);
    p.py = tileCenter(y);
    p.rasengan = RASENGAN_TICKS;
  } else if (p.character === "lula") {
    if (!picanha(s, p)) return false;
  } else if (p.character === "bomb") {
    const { x, y } = playerTile(p);
    if (bombAt(s, x, y)) return false;
    s.bombs.push({ ownerId: p.id, x, y, fuse: FUSE_TICKS, range: effectiveRange(p) * 2, type: "pierce", slide: null, offset: 0, air: null, heldBy: null, mega: true });
    p.specialCooldown = MEGA_COOLDOWN;
    return true;
  } else {
    return false;
  }
  p.specialCooldown = SPECIAL_COOLDOWN;
  return true;
}

/**
 * The shielded captain on (x,y) facing something that travels (dx,dy) toward him,
 * which then hits the shield instead of him.
 */
export function shieldAt(s: MatchState, x: number, y: number, dx: number, dy: number): Player | undefined {
  return s.players.find((o) => {
    if (!o.alive || o.shield <= 0) return false;
    const t = playerTile(o);
    const [fx, fy] = DIR_VECTORS[o.facing];
    return t.x === x && t.y === y && fx === -dx && fy === -dy;
  });
}

/** What each blast does: how far it reaches and what it does to the first player it hits. */
const BLASTS: Record<Exclude<BlastKind, "kamehameha" | "rasengan" | "thunder" | "flash" | "tunnel" | "spin" | "patronus" | "truck">, { range: number; strike: (p: Player, from: { x: number; y: number }, dx: number, dy: number) => void }> = {
  lightning: { range: BOLT_RANGE, strike: (p) => (p.stun = SPECIAL_STUN_TICKS) },
  web: { range: WEB_RANGE, strike: (p) => (p.webbed = WEB_TICKS) },
  kiss: { range: KISS_RANGE, strike: (p) => (p.stun = p.charmed = SPECIAL_STUN_TICKS) },
  ball: { range: BALL_RANGE, strike: (p) => ((p.stun = SPECIAL_STUN_TICKS), (p.charge = p.rasengan = p.truck = 0)) },
  magnet: {
    range: MAGNET_RANGE,
    // The tiles between are clear (the blast stopped at the first thing in its way), so the pull always lands.
    strike: (p, from, dx, dy) => {
      p.px = tileCenter(from.x + dx);
      p.py = tileCenter(from.y + dy);
      p.stun = SPECIAL_STUN_TICKS;
      p.charge = p.rasengan = 0;
    },
  },
};

/** A blast from (x,y) toward `dir`; a shield it meets sends it back once. */
function blast(s: MatchState, kind: keyof typeof BLASTS, ownerId: string, from: { x: number; y: number }, dir: Facing, canReflect: boolean): void {
  const { range, strike } = BLASTS[kind];
  const [dx, dy] = DIR_VECTORS[dir];
  let length = 0;
  let reflector: Player | undefined;
  for (let i = 1; i <= range; i++) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    const bomb = bombAt(s, tx, ty);
    // pelé's ball kicks a bomb in its way off sliding (and stops there)
    if (bomb && kind === "ball" && getTile(s, tx, ty) === Tile.Empty && !bomb.air && !bomb.heldBy) bomb.slide = dir;
    if (getTile(s, tx, ty) !== Tile.Empty || bomb) break;
    length = i;
    const shield = shieldAt(s, tx, ty, dx, dy);
    if (shield) {
      if (canReflect) reflector = shield;
      break;
    }
    const hit = s.players.find((o) => o.id !== ownerId && o.alive && playerTile(o).x === tx && playerTile(o).y === ty);
    if (hit) {
      strike(hit, from, dx, dy);
      break;
    }
  }
  s.blasts.push({ ownerId, x: from.x, y: from.y, dir, length, ttl: BLAST_TICKS, kind });
  if (reflector) blast(s, kind, reflector.id, playerTile(reflector), OPPOSITE[dir], false);
}

/**
 * Pikachu's thunder shock: stuns every other player on his tile and up to THUNDER_RANGE tiles away in
 * each of the four directions; walls, blocks and bombs stop an arm. A shield facing him stops its arm
 * and the shock goes back into him.
 */
function thunder(s: MatchState, p: Player): void {
  const from = playerTile(p);
  const stun = (x: number, y: number) => {
    for (const o of s.players) {
      if (o === p || !o.alive) continue;
      const t = playerTile(o);
      if (t.x === x && t.y === y) o.stun = SPECIAL_STUN_TICKS;
    }
  };
  stun(from.x, from.y);
  for (const dir of ["up", "down", "left", "right"] as const) {
    const [dx, dy] = DIR_VECTORS[dir];
    let length = 0;
    for (let i = 1; i <= THUNDER_RANGE; i++) {
      const tx = from.x + dx * i;
      const ty = from.y + dy * i;
      if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty)) break;
      length = i;
      if (shieldAt(s, tx, ty, dx, dy)) {
        p.stun = SPECIAL_STUN_TICKS;
        break;
      }
      stun(tx, ty);
    }
    s.blasts.push({ ownerId: p.id, x: from.x, y: from.y, dir, length, ttl: BLAST_TICKS, kind: "thunder" });
  }
}

/**
 * Donatello's bo staff spin: stuns every other player on his tile and the four tiles next to him, and bats
 * each bomb next to him away the way it was hit, as a punch would. A shield facing him stops its side and
 * the staff stuns him instead.
 */
function staffSpin(s: MatchState, p: Player): void {
  const from = playerTile(p);
  const stun = (x: number, y: number) => {
    for (const o of s.players) {
      if (o === p || !o.alive) continue;
      const t = playerTile(o);
      if (t.x === x && t.y === y) o.stun = SPECIAL_STUN_TICKS;
    }
  };
  stun(from.x, from.y);
  for (const dir of ["up", "down", "left", "right"] as const) {
    const [dx, dy] = DIR_VECTORS[dir];
    const x = from.x + dx;
    const y = from.y + dy;
    if (shieldAt(s, x, y, dx, dy)) {
      p.stun = SPECIAL_STUN_TICKS;
      continue;
    }
    stun(x, y);
    const bomb = bombAt(s, x, y);
    if (bomb) launch(bomb, dir);
  }
  s.blasts.push({ ownerId: p.id, x: from.x, y: from.y, dir: p.facing, length: 1, ttl: BLAST_TICKS, kind: "spin" });
}

/**
 * The flash's super speed: in a blink he runs up to FLASH_RANGE tiles straight ahead, through every player in his way
 * (each left dizzy), stopping short of a wall, block or bomb, and on the last tile with nobody on it. A raised shield
 * facing him stops him in front of it, dizzy himself.
 */
function superSpeed(s: MatchState, p: Player): void {
  const from = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  let land = 0;
  for (let i = 1; i <= FLASH_RANGE; i++) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty)) break;
    if (shieldAt(s, tx, ty, dx, dy)) {
      p.stun = SPECIAL_STUN_TICKS;
      break;
    }
    let free = true;
    for (const o of s.players) {
      if (o === p || !o.alive || playerTile(o).x !== tx || playerTile(o).y !== ty) continue;
      o.stun = SPECIAL_STUN_TICKS;
      o.charge = o.rasengan = 0;
      free = false;
    }
    if (free) land = i;
  }
  p.px = tileCenter(from.x + dx * land);
  p.py = tileCenter(from.y + dy * land);
  s.blasts.push({ ownerId: p.id, x: from.x, y: from.y, dir: p.facing, length: land, ttl: BLAST_TICKS, kind: "flash" });
}

/**
 * Harry's patronus: a silver stag gallops straight ahead until a wall or block, leaping over bombs, PATRONUS_TICKS_PER_TILE
 * ticks a tile, and stuns every player it reaches on the way (not only the first: see `updateBlasts`). A shield facing it
 * stops it there (the captain holds, nobody behind him is touched).
 */
function patronus(s: MatchState, p: Player): void {
  const from = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  let length = 0;
  for (let i = 1; ; i++) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    if (getTile(s, tx, ty) !== Tile.Empty) break; // out of the arena counts as wall
    length = i;
    if (shieldAt(s, tx, ty, dx, dy)) break;
  }
  const blast = { ownerId: p.id, x: from.x, y: from.y, dir: p.facing, length, ttl: 0, kind: "patronus" as const };
  blast.ttl = blastLife(blast);
  s.blasts.push(blast);
}

/** How many ticks a blast stays: harry's stag as long as its run and its fading, every other one BLAST_TICKS. */
export function blastLife(b: Pick<Blast, "kind" | "length">): number {
  return b.kind === "patronus" ? b.length * PATRONUS_TICKS_PER_TILE + PATRONUS_FADE : BLAST_TICKS;
}

/** The stag reaching a new tile stuns whoever stands there (the captain's shield stopped it short already). */
function gallop(s: MatchState, b: Blast): void {
  const age = blastLife(b) - b.ttl;
  if (age % PATRONUS_TICKS_PER_TILE !== 0) return;
  const i = age / PATRONUS_TICKS_PER_TILE;
  if (i < 1 || i > b.length) return;
  const [dx, dy] = DIR_VECTORS[b.dir];
  const tx = b.x + dx * i;
  const ty = b.y + dy * i;
  if (shieldAt(s, tx, ty, dx, dy)) return;
  for (const o of s.players) {
    if (o.id === b.ownerId || !o.alive || playerTile(o).x !== tx || playerTile(o).y !== ty) continue;
    o.stun = SPECIAL_STUN_TICKS;
    o.charge = o.rasengan = 0;
  }
}

/**
 * Bugs' tunnel: he digs in and comes out on the farthest open tile up to TUNNEL_RANGE tiles straight ahead, going
 * under walls, blocks, bombs and players, never out of the arena nor into a flame. With nowhere to come out he stays.
 */
function tunnel(s: MatchState, p: Player): boolean {
  const from = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  for (let i = TUNNEL_RANGE; i > 0; i--) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    if (getTile(s, tx, ty) !== Tile.Empty || bombAt(s, tx, ty) || hasFlame(s, tx, ty) || others(s, p, tx, ty)) continue;
    p.px = tileCenter(tx);
    p.py = tileCenter(ty);
    s.blasts.push({ ownerId: p.id, x: from.x, y: from.y, dir: p.facing, length: i, ttl: BLAST_TICKS, kind: "tunnel" });
    return true;
  }
  return false;
}

/**
 * Goku's Kamehameha from (x,y) toward `dir`: reaches up to KAME_RANGE, breaking blocks in its path,
 * up to the first player in its way, who is stunned. Walls stop it, and a shield sends it back once.
 */
export function kamehameha(s: MatchState, ownerId: string, from: { x: number; y: number }, dir: Facing, canReflect: boolean): void {
  const [dx, dy] = DIR_VECTORS[dir];
  let length = 0;
  let reflector: Player | undefined;
  for (let i = 1; i <= KAME_RANGE; i++) {
    const tx = from.x + dx * i;
    const ty = from.y + dy * i;
    const tile = getTile(s, tx, ty);
    if (tile === Tile.Wall) break;
    const shield = shieldAt(s, tx, ty, dx, dy);
    if (shield) {
      if (canReflect) reflector = shield;
      break;
    }
    length = i;
    if (tile === Tile.Block) addFlame(s, tx, ty, ownerId, true); // burns away like a blown-up block
    const hit = s.players.find((o) => o.id !== ownerId && o.alive && playerTile(o).x === tx && playerTile(o).y === ty);
    if (hit) {
      hit.stun = SPECIAL_STUN_TICKS;
      hit.charge = hit.rasengan = 0;
      break;
    }
  }
  s.blasts.push({ ownerId, x: from.x, y: from.y, dir, length, ttl: BLAST_TICKS, kind: "kamehameha" });
  if (reflector) kamehameha(s, reflector.id, playerTile(reflector), OPPOSITE[dir], false);
}

const others = (s: MatchState, p: Player, x: number, y: number) =>
  s.players.find((o) => o !== p && o.alive && playerTile(o).x === x && playerTile(o).y === y);

/**
 * One tick of Naruto's Rasengan dash. On each tile center he looks at the tile ahead: a wall or bomb
 * stops him, a block breaks and stops him, a player in it is knocked back up to RASENGAN_PUSH tiles
 * (until something is in the way) and stunned, and a shield facing him stuns him instead.
 */
export function updateRasengan(s: MatchState, p: Player): void {
  const [dx, dy] = DIR_VECTORS[p.facing];
  if (p.rasengan % RASENGAN_TICKS_PER_TILE === 0) {
    const { x, y } = playerTile(p);
    const tx = x + dx;
    const ty = y + dy;
    const tile = getTile(s, tx, ty);
    const shield = shieldAt(s, tx, ty, dx, dy);
    const hit = others(s, p, tx, ty);
    if (shield) {
      p.stun = SPECIAL_STUN_TICKS;
    } else if (tile === Tile.Block) {
      addFlame(s, tx, ty, p.id, true); // burns away like a blown-up block
    } else if (hit) {
      let to = 0;
      while (to < RASENGAN_PUSH) {
        const nx = tx + dx * (to + 1);
        const ny = ty + dy * (to + 1);
        if (getTile(s, nx, ny) !== Tile.Empty || bombAt(s, nx, ny) || others(s, hit, nx, ny)) break;
        to++;
      }
      hit.px = tileCenter(tx + dx * to);
      hit.py = tileCenter(ty + dy * to);
      hit.stun = SPECIAL_STUN_TICKS;
      hit.charge = hit.rasengan = 0;
    }
    if (shield || tile !== Tile.Empty || bombAt(s, tx, ty) || hit) {
      p.rasengan = 0;
      s.blasts.push({ ownerId: p.id, x, y, dir: p.facing, length: 1, ttl: BLAST_TICKS, kind: "rasengan" });
      return;
    }
  }
  p.px += (dx * TILE) / RASENGAN_TICKS_PER_TILE;
  p.py += (dy * TILE) / RASENGAN_TICKS_PER_TILE;
  if (--p.rasengan === 0) {
    const { x, y } = playerTile(p);
    s.blasts.push({ ownerId: p.id, x, y, dir: p.facing, length: 0, ttl: BLAST_TICKS, kind: "rasengan" });
  }
}

/**
 * One tick of Optimus's truck. First he turns into it where he stands, then he drives. On each tile center he looks at
 * the tile ahead: a wall stops him, a block is crushed (burns away like a blown-up block) and stops him, a bomb is
 * rammed off sliding and stops him, a shield facing him stops him, stunned. A player there is shoved one tile on,
 * stunned, while the tile beyond is free; pinned (a wall, block, bomb or player behind them), they stop him.
 */
export function updateTruck(s: MatchState, p: Player): void {
  if (p.truck > TRUCK_TICKS) {
    p.truck--;
    return;
  }
  const [dx, dy] = DIR_VECTORS[p.facing];
  if (p.truck % TRUCK_TICKS_PER_TILE === 0) {
    const { x, y } = playerTile(p);
    const tx = x + dx;
    const ty = y + dy;
    const tile = getTile(s, tx, ty);
    const bomb = bombAt(s, tx, ty);
    const shield = shieldAt(s, tx, ty, dx, dy);
    const hit = others(s, p, tx, ty);
    let stop = !!shield || tile !== Tile.Empty || !!bomb;
    if (shield) p.stun = SPECIAL_STUN_TICKS;
    else if (tile === Tile.Block) addFlame(s, tx, ty, p.id, true);
    else if (bomb && tile === Tile.Empty && !bomb.air && !bomb.heldBy) bomb.slide = p.facing;
    else if (hit) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (getTile(s, nx, ny) !== Tile.Empty || bombAt(s, nx, ny) || others(s, hit, nx, ny)) stop = true;
      else {
        hit.px = tileCenter(nx);
        hit.py = tileCenter(ny);
      }
      hit.stun = SPECIAL_STUN_TICKS;
      hit.charge = hit.rasengan = hit.truck = 0;
    }
    if (stop) {
      p.truck = 0;
      s.blasts.push({ ownerId: p.id, x, y, dir: p.facing, length: 1, ttl: BLAST_TICKS, kind: "truck" });
      return;
    }
  }
  p.px += (dx * TILE) / TRUCK_TICKS_PER_TILE;
  p.py += (dy * TILE) / TRUCK_TICKS_PER_TILE;
  if (--p.truck === 0) {
    const { x, y } = playerTile(p);
    s.blasts.push({ ownerId: p.id, x, y, dir: p.facing, length: 0, ttl: BLAST_TICKS, kind: "truck" });
  }
}

/** Blasts fade after BLAST_TICKS. */
export function updateBlasts(s: MatchState): void {
  for (const b of s.blasts) {
    b.ttl--;
    if (b.kind === "patronus") gallop(s, b);
  }
  s.blasts = s.blasts.filter((b) => b.ttl > 0);
}

/**
 * Lula's promise of picanha, left on the open tile in front of him: it looks like a power-up, and whoever but him picks it
 * up is let down, stunned (`collectItems`). Not on a wall, block, bomb, item, flame or player: then nothing is used.
 */
function picanha(s: MatchState, p: Player): boolean {
  const { x, y } = playerTile(p);
  const [dx, dy] = DIR_VECTORS[p.facing];
  const tx = x + dx;
  const ty = y + dy;
  const taken =
    getTile(s, tx, ty) !== Tile.Empty ||
    bombAt(s, tx, ty) ||
    hasFlame(s, tx, ty) ||
    s.items.some((i) => i.x === tx && i.y === ty) ||
    s.players.some((o) => o.alive && playerTile(o).x === tx && playerTile(o).y === ty);
  if (taken) return false;
  s.items.push({ x: tx, y: ty, kind: ItemKind.Picanha, owner: p.id });
  return true;
}
