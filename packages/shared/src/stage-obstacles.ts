import { TILE } from "./constants";
import type { MatchState } from "./state";

export function stageSolid(s: Pick<MatchState, "stageState">, x: number, y: number): boolean {
  return !!s.stageState?.balls?.some(ball => Math.floor(ball.px / TILE) === x && Math.floor(ball.py / TILE) === y);
}
