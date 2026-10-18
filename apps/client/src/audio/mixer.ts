/** How far left/right a sound at the arena's edge sits (full pan feels detached on phones). */
const PAN_SPREAD = 0.6;

/** Stereo pan (-1..1) for a horizontal position in tiles. */
export function panFor(x: number, width: number): number {
  const t = Math.min(1, Math.max(0, x / width));
  return (t * 2 - 1) * PAN_SPREAD;
}

/** Volume for an explosion covering `size` new flame tiles: bigger blasts are louder, gently. */
export function explosionGain(size: number): number {
  return 0.75 + 0.25 * (1 - 1 / Math.sqrt(Math.max(1, size)));
}

/** Caps how many copies of one sound start within a time window (chain reactions, crowds). */
export class VoiceLimiter {
  private readonly started = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  allow(name: string, nowMs: number): boolean {
    const recent = (this.started.get(name) ?? []).filter((t) => nowMs - t < this.windowMs);
    const ok = recent.length < this.max;
    if (ok) recent.push(nowMs);
    this.started.set(name, recent);
    return ok;
  }
}
