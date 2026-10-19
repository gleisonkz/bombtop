import {
  BLAST_TICKS,
  getTile,
  ItemKind,
  playerTile,
  TICK_RATE,
  Tile,
  useSpecial,
  type Blast,
  type MatchState,
  type Player,
  type PublicView,
} from "@bombtop/shared";
import type { Cue } from "../audio/cues";

const TICK_MS = 1000 / TICK_RATE;

/** The ice blast our special makes right now, worked out with the server's rules; null when it is not ready. */
export function predictBlast(view: PublicView, me: Player): Blast | null {
  const players = view.players.map((p) => (p.id === me.id ? structuredClone(me) : structuredClone(p)));
  const s = { ...structuredClone(view), players, rng: 0 } as MatchState;
  const caster = players.find((p) => p.id === me.id)!;
  return useSpecial(s, caster) ? s.blasts.at(-1)! : null;
}

/**
 * Our own ice blast, drawn (cast animation and beam) the moment the button is
 * pressed instead of a round trip later; the server's copy takes over once it arrives.
 */
export class GhostBlasts {
  private ghost: { blast: Blast; at: number } | null = null;

  constructor(private readonly me: string) {}

  add(blast: Blast, nowMs: number): void {
    this.ghost = { blast, at: nowMs };
  }

  /** A predicted blast is still on screen (so the button is not predicted twice). */
  active(nowMs: number): boolean {
    return !!this.ghost && this.ttl(nowMs) > 0;
  }

  apply<V extends Pick<PublicView, "blasts">>(view: V, nowMs: number): V {
    if (!this.ghost) return view;
    const ttl = this.ttl(nowMs);
    if (ttl <= 0 || view.blasts.some((b) => b.ownerId === this.me)) {
      this.ghost = null;
      return view;
    }
    return { ...view, blasts: [...view.blasts, { ...this.ghost.blast, ttl }] };
  }

  private ttl(nowMs: number): number {
    return this.ghost ? this.ghost.blast.ttl - Math.floor((nowMs - this.ghost.at) / TICK_MS) : 0;
  }
}

/** Longest the server may take to confirm a pickup before the item is shown again. */
const PICKUP_MS = 1000;

/**
 * Items our predicted player walks onto: gone from the screen, with their sound,
 * at once. Each is shown again by the server's view once it agrees (or if it never does).
 */
export class GhostPickups {
  private taken: { x: number; y: number; at: number }[] = [];

  /** Takes the item under our player, if any; returns the sound to play now. */
  check(view: PublicView, me: Player, nowMs: number): Cue[] {
    if (!me.alive) return [];
    const { x, y } = playerTile(me);
    if (getTile(view, x, y) !== Tile.Empty || this.taken.some((t) => t.x === x && t.y === y)) return [];
    const item = view.items.find((i) => i.x === x && i.y === y);
    if (!item) return [];
    this.taken.push({ x, y, at: nowMs });
    return item.kind === ItemKind.Skull ? [] : [{ name: "pickup", x: x + 0.5 }];
  }

  apply<V extends Pick<PublicView, "items">>(view: V, nowMs: number): V {
    const has = (t: { x: number; y: number }) => view.items.some((i) => i.x === t.x && i.y === t.y);
    // The server took it too (or it timed out): its view is the truth from here on.
    this.taken = this.taken.filter((t) => nowMs - t.at < PICKUP_MS && has(t));
    if (!this.taken.length) return view;
    return { ...view, items: view.items.filter((i) => !this.taken.some((t) => t.x === i.x && t.y === i.y)) };
  }
}
