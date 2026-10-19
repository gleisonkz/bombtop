/** A short-lived bit of visual flair, in stage pixels. */
export interface Particle {
  kind: "spark" | "smoke" | "debris";
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ticks lived and ticks to live. */
  age: number;
  life: number;
  size: number;
  color: number;
}

const SPARK_COLORS = [0xfff6c8, 0xffd23f, 0xff7a1a];
const DEBRIS_COLORS = [0xa86b3c, 0x7a4a26, 0xc98a52];
/** Most ticks a frame may advance the effects (a hidden tab catching up). */
const MAX_STEP = 120;

/**
 * Explosion effects driven by snapshots: sparks and a screen shake where a bomb
 * goes off, debris where a block is blown up, and smoke where flames die out.
 * Client-only and cosmetic, so it uses its own random numbers.
 */
export class Fx {
  particles: Particle[] = [];
  /** Screen shake strength, in stage pixels. */
  shake = 0;
  private burning = new Set<string>();
  private lastTick: number | null = null;
  private seed = 1;

  constructor(private readonly tilePx = 16) {}

  /** Feeds this frame's flames; `wasBlock` tells whether a tile held a block before it burst. */
  observe(flames: readonly { x: number; y: number }[], wasBlock: (x: number, y: number) => boolean, tick: number): void {
    if (this.lastTick !== null && tick < this.lastTick) this.reset();
    this.advance(this.lastTick === null ? 0 : Math.min(MAX_STEP, tick - this.lastTick));
    this.lastTick = tick;

    const now = new Set(flames.map((f) => `${f.x},${f.y}`));
    const lit = (x: number, y: number) => now.has(`${x},${y}`);
    for (const f of flames) {
      if (this.burning.has(`${f.x},${f.y}`)) continue;
      if (wasBlock(f.x, f.y)) this.debris(f.x, f.y);
      // Where arms meet (or a lone flame): the bomb itself.
      const across = lit(f.x - 1, f.y) || lit(f.x + 1, f.y);
      const along = lit(f.x, f.y - 1) || lit(f.x, f.y + 1);
      if (across === along) this.blast(f.x, f.y);
    }
    for (const key of this.burning) {
      if (now.has(key)) continue;
      const [x, y] = key.split(",").map(Number) as [number, number];
      this.smoke(x, y);
    }
    this.burning = now;
  }

  reset(): void {
    this.particles = [];
    this.shake = 0;
    this.burning.clear();
    this.lastTick = null;
  }

  private advance(ticks: number): void {
    for (const p of this.particles) {
      p.age += ticks;
      p.x += p.vx * ticks;
      p.y += p.vy * ticks;
      if (p.kind === "debris") p.vy += 0.06 * ticks; // falls
      if (p.kind === "smoke") p.vx *= 0.97;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    this.shake = this.shake * Math.pow(0.85, ticks);
    if (this.shake < 0.1) this.shake = 0;
  }

  private blast(tx: number, ty: number): void {
    const [cx, cy] = this.center(tx, ty);
    for (let i = 0; i < 14; i++) {
      const a = this.random() * Math.PI * 2;
      const v = 0.6 + this.random() * 1.2;
      this.add("spark", cx, cy, Math.cos(a) * v, Math.sin(a) * v, 14 + this.random() * 14, 1 + this.random(), SPARK_COLORS);
    }
    this.shake = Math.min(3, this.shake + 1.6);
  }

  private debris(tx: number, ty: number): void {
    const [cx, cy] = this.center(tx, ty);
    for (let i = 0; i < 6; i++) {
      const vx = (this.random() - 0.5) * 1.4;
      this.add("debris", cx + vx * 3, cy, vx, -0.8 - this.random() * 0.9, 24 + this.random() * 12, 1.5 + this.random() * 1.5, DEBRIS_COLORS);
    }
  }

  private smoke(tx: number, ty: number): void {
    const [cx, cy] = this.center(tx, ty);
    this.add("smoke", cx + (this.random() - 0.5) * 6, cy, (this.random() - 0.5) * 0.3, -0.25 - this.random() * 0.2, 30 + this.random() * 20, 3 + this.random() * 2, [0x5a5a66]);
  }

  private add(kind: Particle["kind"], x: number, y: number, vx: number, vy: number, life: number, size: number, colors: number[]): void {
    const color = colors[Math.floor(this.random() * colors.length)]!;
    this.particles.push({ kind, x, y, vx, vy, age: 0, life, size, color });
  }

  private center(tx: number, ty: number): [number, number] {
    return [(tx + 0.5) * this.tilePx, (ty + 0.5) * this.tilePx];
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }
}
