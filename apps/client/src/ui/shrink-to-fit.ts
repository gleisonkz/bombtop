/** The zoom that fits something `natural` px wide into `room` px: never above 1, and 1 until both are laid out. */
export function shrinkToFit(natural: number, room: number): number {
  if (natural <= 0 || room <= 0) return 1;
  return Math.min(1, room / natural);
}
