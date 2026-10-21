import { BLAST_TICKS, FUSE_TICKS, ItemKind, Tile, TILE, type Bomb, type PublicView } from "@bombtop/shared";

export type CueName =
  | "place"
  | "explode"
  | "break"
  | "wall"
  | "kick"
  | "throw"
  | "pickup"
  | "curse"
  | "stun"
  | "death"
  | "mount"
  | "dismount"
  | "jump"
  | "dash"
  | "warp"
  | "ice"
  | "thunder"
  | "freeze"
  | "hurry";

export interface Cue {
  name: CueName;
  /** Horizontal position in tiles (for stereo panning). */
  x: number;
  /** Explosions: how many flame tiles appeared. */
  size?: number;
}

type View = Pick<PublicView, "tick" | "grid" | "players" | "bombs" | "flames" | "items" | "blasts" | "pressure">;

const key = (x: number, y: number) => `${x},${y}`;
const bombKey = (b: Bomb) => `${b.ownerId}@${key(b.x, b.y)}`;
const grounded = (b: Bomb) => !b.slide && !b.air && !b.heldBy;

/**
 * What a player should hear between two views of the match. The views carry
 * no events, so sounds are read from what changed.
 */
export function soundCues(prev: View, next: View): Cue[] {
  const cues: Cue[] = [];
  const mid = (x: number) => x + 0.5;

  const oldFlames = new Set(prev.flames.map((f) => key(f.x, f.y)));
  const fresh = next.flames.filter((f) => !oldFlames.has(key(f.x, f.y)));
  if (fresh.length) {
    const x = fresh.reduce((sum, f) => sum + f.x, 0) / fresh.length;
    cues.push({ name: "explode", x: mid(x), size: fresh.length });
  }

  const { width, tiles } = next.grid;
  const changed = (from: (t: Tile) => boolean, to: Tile) =>
    tiles.findIndex((t, i) => t === to && from(prev.grid.tiles[i]!));
  const broken = changed((t) => t === Tile.Block, Tile.Empty);
  if (broken >= 0) cues.push({ name: "break", x: mid(broken % width) });
  const wall = changed((t) => t !== Tile.Wall, Tile.Wall);
  if (wall >= 0) cues.push({ name: "wall", x: mid(wall % width) });

  const elapsed = next.tick - prev.tick;
  const oldBombs = new Set(prev.bombs.map(bombKey));
  for (const b of next.bombs) {
    if (grounded(b) && !oldBombs.has(bombKey(b)) && b.fuse >= FUSE_TICKS - elapsed) cues.push({ name: "place", x: mid(b.x) });
  }
  const count = (v: View, f: (b: Bomb) => unknown) => v.bombs.filter(f).length;
  const moving = (f: (b: Bomb) => unknown, name: CueName) => {
    const b = next.bombs.find(f);
    if (b && count(next, f) > count(prev, f)) cues.push({ name, x: mid(b.x) });
  };
  moving((b) => b.slide, "kick");
  moving((b) => b.air, "throw");

  const flames = new Set(next.flames.map((f) => key(f.x, f.y)));
  const items = new Set(next.items.map((i) => key(i.x, i.y)));
  for (const i of prev.items) {
    const k = key(i.x, i.y);
    if (!items.has(k) && !flames.has(k) && i.kind !== ItemKind.Skull) cues.push({ name: "pickup", x: mid(i.x) });
  }

  for (const b of next.blasts) {
    if (b.ttl >= BLAST_TICKS - elapsed) cues.push({ name: b.kind === "lightning" ? "thunder" : "ice", x: mid(b.x) });
  }

  for (const p of next.players) {
    const was = prev.players.find((q) => q.id === p.id);
    if (!was) continue;
    const x = p.px / TILE;
    const hear = (name: CueName, when: unknown) => when && cues.push({ name, x });
    if (was.alive && !p.alive) {
      cues.push({ name: "death", x });
      continue;
    }
    if (!p.alive) continue;
    hear("stun", !was.stun && p.stun);
    hear("curse", !was.curse && p.curse);
    hear("mount", !was.mount && p.mount);
    hear("dismount", was.mount && !p.mount);
    hear("jump", !was.jumpTicks && p.jumpTicks);
    hear("warp", !was.warpLock && p.warpLock);
    hear("dash", !was.dashTicks && p.dashTicks);
    hear("freeze", !was.frozen && p.frozen);
  }

  if (!prev.pressure && next.pressure) cues.push({ name: "hurry", x: width / 2 });
  return cues;
}

/** Feeds soundCues with the views as they are drawn, so each change is heard once. */
export class Listener {
  private last: View | null = null;

  hear(view: View): Cue[] {
    const last = this.last;
    if (!last || view.tick < last.tick) {
      this.last = view; // first view, or a new match: nothing to compare with
      return [];
    }
    if (view.tick === last.tick) return [];
    this.last = view;
    return soundCues(last, view);
  }
}
