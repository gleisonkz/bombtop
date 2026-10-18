import { FUSE_TICKS, type PublicView } from "@bombtop/shared";

/** Longest the server may take to show a bomb we placed (past this it was refused). */
const GHOST_MS = 1000;

/**
 * Bombs we just placed, drawn at once instead of a round trip later. Each one
 * is dropped as soon as the server's view has a bomb of ours on that tile.
 */
export class GhostBombs {
  private ghosts: { x: number; y: number; at: number }[] = [];

  constructor(private readonly me: string) {}

  add(x: number, y: number, nowMs: number): void {
    this.ghosts.push({ x, y, at: nowMs });
  }

  clear(): void {
    this.ghosts = [];
  }

  /** `view` plus the bombs the server has not shown yet. */
  apply<V extends Pick<PublicView, "bombs">>(view: V, nowMs: number): V {
    const ours = (x: number, y: number) => view.bombs.some((b) => b.ownerId === this.me && b.x === x && b.y === y);
    this.ghosts = this.ghosts.filter((g) => nowMs - g.at < GHOST_MS && !ours(g.x, g.y));
    if (!this.ghosts.length) return view;
    const extra = this.ghosts.map((g) => ({
      ownerId: this.me, x: g.x, y: g.y, fuse: FUSE_TICKS, range: 1, type: "normal" as const,
      slide: null, offset: 0, air: null, heldBy: null,
    }));
    return { ...view, bombs: [...view.bombs, ...extra] };
  }
}
