import { expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { ROUND_TICKS } from "../src/constants";
import { step } from "../src/step";
import { matchResult } from "../src/pressure";

it("tempo infinito SB2 nao fecha a arena nem termina no prazo generico do Bombtop", () => {
  const state = createMatch({ stage: "sb2-12", seed: 1, playerIds: ["p1", "p2"], timeLimitMinutes: null });
  const grid = [...state.grid.tiles];
  for (let tick = 0; tick <= ROUND_TICKS; tick++) step(state);
  expect(state.grid.tiles).toEqual(grid);
  expect(state.stageState!.sb2!.battleClock).toBeNull();
  expect(matchResult(state)).toEqual({ over: false });
});
