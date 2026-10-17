import { launch } from "./air";
import { CART_TICKS, FUSE_TICKS, INVULN_TICKS } from "./constants";
import {
  DIR_VECTORS,
  playerTile,
  type Direction,
  type Facing,
  type MatchState,
  type Player,
} from "./state";

/** Border tiles clockwise from the top-left corner. */
export function perimeter(width: number, height: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let x = 0; x < width; x++) out.push({ x, y: 0 });
  for (let y = 1; y < height; y++) out.push({ x: width - 1, y });
  for (let x = width - 2; x >= 0; x--) out.push({ x, y: height - 1 });
  for (let y = height - 2; y > 0; y--) out.push({ x: 0, y });
  return out;
}

/** Direction pointing into the arena from a border tile (null on corners). */
function inward(s: MatchState, x: number, y: number): Facing | null {
  const { width, height } = s.grid;
  const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
  if (corner) return null;
  if (y === 0) return "down";
  if (y === height - 1) return "up";
  if (x === 0) return "right";
  return "left";
}

/** Puts a freshly killed player on the border tile closest to where they fell. */
export function giveCart(s: MatchState, p: Player): void {
  const { x, y } = playerTile(p);
  const ring = perimeter(s.grid.width, s.grid.height);
  let best = 0;
  ring.forEach((t, i) => {
    const b = ring[best]!;
    if (Math.abs(t.x - x) + Math.abs(t.y - y) < Math.abs(b.x - x) + Math.abs(b.y - y)) best = i;
  });
  p.cart = { pos: best, cooldown: 0 };
}

/** Moves the cart along the ring and throws its single bomb inward. */
export function driveCart(s: MatchState, p: Player, dir: Direction, bomb: boolean): void {
  const cart = p.cart;
  if (!cart) return;
  const ring = perimeter(s.grid.width, s.grid.height);
  if (cart.cooldown > 0) cart.cooldown--;

  if (dir && cart.cooldown === 0) {
    const [dx, dy] = DIR_VECTORS[dir];
    const cur = ring[cart.pos]!;
    for (const next of [cart.pos + 1, cart.pos - 1 + ring.length].map((i) => i % ring.length)) {
      const t = ring[next]!;
      if (t.x - cur.x === dx && t.y - cur.y === dy) {
        cart.pos = next;
        cart.cooldown = CART_TICKS;
        break;
      }
    }
  }

  if (!bomb || s.bombs.some((b) => b.ownerId === p.id)) return;
  const { x, y } = ring[cart.pos]!;
  const into = inward(s, x, y);
  if (!into) return;
  const b = {
    ownerId: p.id,
    x,
    y,
    fuse: FUSE_TICKS,
    range: p.fireRange,
    type: "normal" as const,
    slide: null,
    offset: 0,
    air: null,
    heldBy: null,
  };
  launch(b, into);
  s.bombs.push(b);
}

/** A cart rider whose bomb killed someone takes the victim's place. */
export function revengeSwap(s: MatchState, victim: Player, killerId: string | undefined): void {
  const killer = s.players.find((p) => p.id === killerId);
  if (!killer || killer.alive || !killer.cart) return;
  killer.alive = true;
  killer.cart = null;
  killer.px = victim.px;
  killer.py = victim.py;
  killer.invuln = INVULN_TICKS; // the flames that got the victim are still burning
}
