import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { setTile, Tile } from "../src/state";

// C04468: a entrada no círculo da arena 2 consulta 7E5D0E bit0001, que é a mesma palavra das
// flags do fechamento (C0D83E liga o bit0001 em 0:33; extract_warp_bombs.py lê 0x5d0e como
// transport_phase). Com o fechamento em curso, o círculo não inicia o transporte.
function onCircle(closureFlags: number) {
  const s = createMatch({ stage: "sb2-02", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
  const runtime = s.stageState!.sb2!;
  runtime.closure = { flags: closureFlags, timer: 3, index: 0, animation: 0, cell: 0, extended: false };
  setTile(s, 3, 3, Tile.Empty);
  const p = s.players[0]!;
  p.px = 3 * TILE + TILE / 2;
  p.py = 3 * TILE + TILE / 2;
  for (let i = 0; i < 4; i++) step(s, {});
  return runtime.stage2Transport?.p1;
}

describe("SB2 arena 2: transporte e fechamento", () => {
  it("o círculo inicia o transporte antes do fechamento", () => {
    expect(onCircle(0)).toBeDefined();
  });
  it("com o fechamento ligado (5D0E bit0001) o círculo não transporta", () => {
    expect(onCircle(1 | 2)).toBeUndefined();
  });
});
