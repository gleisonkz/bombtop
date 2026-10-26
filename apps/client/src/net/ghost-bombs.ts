import { bombAt, effectiveFuse, FUSE_TICKS, TICK_RATE, type BombType, type PublicView, type Snapshot } from "@bombtop/shared";

/** Longest the server may take to show a bomb we placed (past this it was refused). */
const GHOST_MS = 1800;

/**
 * Predicted placements drawn before the round trip completes. Authoritative
 * occupancy or acknowledgement retires them; timeout covers legacy callers.
 */
export class GhostBombs {
  private ghosts: { x: number; y: number; at: number; type: BombType; seq: number | undefined }[] = [];

  constructor(private readonly me: string) {}

  add(x: number, y: number, nowMs: number, type: BombType = "normal", seq?: number): void {
    this.ghosts = this.ghosts.filter((g) => nowMs - g.at < GHOST_MS);
    if (this.ghosts.some((g) => (g.x === x && g.y === y) || (seq !== undefined && g.seq === seq))) return;
    this.ghosts.push({ x, y, at: nowMs, type, seq });
  }

  /** Call with each authoritative snapshot before ghost overlays. */
  reconcile(snapshot: Snapshot): void {
    const ack = snapshot.acks[this.me];
    this.ghosts = this.ghosts.filter((g) =>
      !(ack && g.seq !== undefined && g.seq <= ack.seq) && !bombAt(snapshot, g.x, g.y));
  }

  clear(): void {
    this.ghosts = [];
  }

  /** `view` plus pending bombs, for rendering and actionCues placement/capacity checks. */
  apply<V extends Pick<PublicView, "bombs" | "players">>(view: V, nowMs: number): V {
    this.ghosts = this.ghosts.filter((g) => nowMs - g.at < GHOST_MS && !bombAt(view, g.x, g.y));
    if (!this.ghosts.length) return view;
    const owner = view.players.find((p) => p.id === this.me);
    const fuse = owner ? effectiveFuse(owner) : FUSE_TICKS;
    const extra = this.ghosts.map((g) => ({
      ownerId: this.me, x: g.x, y: g.y, fuse: Math.max(1, fuse - Math.floor((nowMs - g.at) * TICK_RATE / 1000)), range: 1, type: g.type,
      slide: null, offset: 0, air: null, heldBy: null,
    }));
    return { ...view, bombs: [...view.bombs, ...extra] };
  }
}
