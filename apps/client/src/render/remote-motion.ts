import { getTile, TILE, Tile, type Player, type PublicView } from "@bombtop/shared";
import { carryOn } from "../net/carry-on";
import type { Sample } from "../net/snapshot-buffer";
import { between } from "./sprites";

interface DrawnPlayer {
  px: number;
  py: number;
  dx: number;
  dy: number;
}

const CORRECTION_MS = 80;

/** Render-only recovery; authoritative snapshots and the local predictor stay untouched. */
export class RemoteMotion {
  private drawn = new Map<string, DrawnPlayer>();
  private tick = -1;
  private at = 0;
  private late = false;

  constructor(private readonly me: string) {}

  reset(): void {
    this.drawn.clear();
    this.tick = -1;
    this.late = false;
  }

  sample(sample: Sample, nowMs: number): PublicView {
    if (sample.to.tick < this.tick) this.reset();
    const view = carryOn(sample.from, sample.to, sample.pastMs);
    const decay = Math.exp(-Math.max(0, nowMs - this.at) / CORRECTION_MS);
    const recovering = this.late && sample.to.tick !== this.tick;
    const drawn = new Map<string, DrawnPlayer>();
    const players = view.players.map((p) => {
      if (p.id === this.me) return p;
      const from = sample.from.players.find((q) => q.id === p.id) ?? p;
      const target = sample.pastMs > 0 ? p : between(from, p, sample.alpha);
      const previous = this.drawn.get(p.id);
      let dx = (previous?.dx ?? 0) * decay;
      let dy = (previous?.dy ?? 0) * decay;
      if (previous && recovering) {
        dx = (previous.px - target.px) * decay;
        dy = (previous.py - target.py) * decay;
      }
      if (!this.canCorrect(view, p, target, { px: target.px + dx, py: target.py + dy })) dx = dy = 0;
      const position = { px: target.px + dx, py: target.py + dy };
      drawn.set(p.id, { ...position, dx, dy });
      return { ...p, ...position };
    });
    this.drawn = drawn;
    this.tick = sample.to.tick;
    this.at = nowMs;
    this.late = sample.pastMs > 0;
    return { ...view, players };
  }

  private canCorrect(view: PublicView, p: Player, target: Pick<Player, "px" | "py">, drawn: Pick<Player, "px" | "py">): boolean {
    if (!p.alive || p.stun || p.webbed || p.shield || p.charge || p.rasengan || p.truck || p.mount || p.jumpTicks || p.dashTicks) return false;
    if (Math.abs(drawn.px - target.px) + Math.abs(drawn.py - target.py) > TILE / 2) return false;
    const x = Math.floor(target.px / TILE);
    const y = Math.floor(target.py / TILE);
    return Math.floor(drawn.px / TILE) === x && Math.floor(drawn.py / TILE) === y && getTile(view, x, y) === Tile.Empty;
  }
}
