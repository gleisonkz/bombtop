/** Cinemática medida no gelo da arena 2, em pixels por frame PAL. */
export function sb2IceAxisVelocity(velocity: number, input: -1 | 0 | 1): number {
  if (!input) return velocity;
  if (velocity && Math.sign(velocity) !== input && Math.abs(velocity) < 1) return 0;
  return Math.max(-2, Math.min(2, velocity + input * 0.25));
}
