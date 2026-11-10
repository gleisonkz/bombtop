import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SB2_CHANNEL_CELLS, sb2ChannelActive } from "../src/sb2-channel";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { step } from "../src/step";
import { Tile, type Direction } from "../src/state";
import { sb2NativeWarpLanding, sb2Stage6WarpDestination, stepSb2Stage6Warp, type Sb2WarpState } from "../src/sb2-warp";

interface NativeSample {
  sample: number;
  grids: { current: number[][]; background: number[][] };
}
interface ComparisonSample {
  label: string;
  frame: number;
  rea_sample: number;
  players: { x: number; y: number }[];
}

const bundle = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-REA-ARENA-EFFECTS.json", import.meta.url), "utf8"));
const comparison = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-EFFECTS-COMPARISON.json", import.meta.url), "utf8"));
const evidence = bundle.records.find((record: { evidence_id: string }) => record.evidence_id === comparison.evidence_id);
if (!evidence || evidence.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
const native: NativeSample[] = evidence.normalized_result.messages
  .filter((message: { type: string; payload?: { kind: string } }) => message.type === "send" && message.payload?.kind === "arena-effects")
  .map((message: { payload: NativeSample }) => message.payload);
const observations = comparison.samples as ComparisonSample[];

function observed(label: string) {
  const sample = observations.find(value => value.label === label);
  if (!sample) throw new Error(`Amostra não encontrada: ${label}`);
  return sample;
}

function cellAt(label: string) {
  const player = observed(label).players[0]!;
  return { x: Math.floor((player.x - 8) / 16), y: Math.floor((player.y - 24) / 16) };
}

describe("efeitos de SB2 medidos no REA/Snes9x", () => {
  it("preserva o par vermelho e o retorno observado", () => {
    expect(sb2Stage6WarpDestination({ x: 3, y: 3 })).toEqual(cellAt("warp-enter-6"));
    expect(sb2Stage6WarpDestination({ x: 11, y: 9 })).toEqual(cellAt("warp-return-6"));
  });

  it("preserva o par azul sem misturá-lo com o vermelho", () => {
    const source = { x: 3, y: 9 };
    const destination = cellAt("blue-enter-6");
    expect(sb2Stage6WarpDestination(source)).toEqual(destination);
    expect(sb2Stage6WarpDestination(destination)).toEqual(source);
    const returning = observed("blue-return-1").players[0]!;
    expect(Math.abs(returning.x - (source.x + 1) * 16)).toBeLessThanOrEqual(16);
    expect(Math.abs(returning.y - (source.y + 2) * 16)).toBeLessThan(1);
    expect(sb2Stage6WarpDestination({ x: 1, y: 1 })).toBeNull();
  });

  it("conserva as frações na chegada antes do deslocamento daquele frame", () => {
    const entry = observed("warp-detail-0").players[0]!;
    const arrival = observed("warp-detail-1").players[0]!;
    const landing = sb2NativeWarpLanding(entry, { x: 11, y: 9 });
    expect({ x: landing.x, y: landing.y + 1.25 }).toEqual({ x: arrival.x, y: arrival.y });
    const reverseEntry = observed("warp-return-5").players[0]!;
    const reverseArrival = observed("warp-return-6").players[0]!;
    const reverseLanding = sb2NativeWarpLanding(reverseEntry, { x: 3, y: 3 });
    expect({ x: reverseLanding.x, y: reverseLanding.y - 1.25 }).toEqual({ x: reverseArrival.x, y: reverseArrival.y });
  });

  it("mantém a posição observada ao permanecer no portal de chegada", () => {
    expect(observed("warp-lock-idle").players[0]).toEqual(observed("warp-lock-arrival").players[0]);
  });

  it.each([
    ["warp-detail-", 0, 8, 0, 1.25],
    ["warp-return-", 1, 24, 0, -1.25],
    ["blue-enter-", 1, 8, 1.25, 0],
    ["blue-return-", 1, 2, -1.25, 0],
  ] as const)("reproduz a sequência nativa %s com trava e reentrada", (prefix, first, last, dx, dy) => {
    const initial = observed(`${prefix}${first}`);
    let position = { x: initial.players[0]!.x, y: initial.players[0]!.y };
    let frame = initial.frame;
    // Cada trecho começa fora do portal ou já na chegada de um teleporte.
    let state: Sb2WarpState = {};
    for (let index = first + 1; index <= last; index++) {
      const target = observed(`${prefix}${index}`);
      while (frame < target.frame) {
        const landed = stepSb2Stage6Warp(position, state);
        position = { x: landed.x + dx, y: landed.y + dy };
        frame++;
        state = JSON.parse(JSON.stringify(state));
      }
      expect(position, target.label).toEqual({ x: target.players[0]!.x, y: target.players[0]!.y });
    }
  });

  it("mantém a trava por 300 frames após serialização", () => {
    const entry = observed("warp-detail-0").players[0]!;
    let state: Sb2WarpState = {};
    const landing = stepSb2Stage6Warp(entry, state);
    const position = { x: landing.x, y: landing.y + 1.25 };
    expect(position).toEqual({ x: observed("warp-lock-arrival").players[0]!.x,
      y: observed("warp-lock-arrival").players[0]!.y });
    for (let frame = 0; frame < 300; frame++) {
      state = JSON.parse(JSON.stringify(state));
      expect(stepSb2Stage6Warp(position, state)).toEqual(position);
    }
  });

  it.each([
    ["warp-detail-", 0, 8, "down"],
    ["warp-return-", 1, 24, "up"],
    ["blue-enter-", 1, 8, "right"],
    ["blue-return-", 1, 2, "left"],
  ] as const)("executa %s no step real com colisões e relógio PAL", (prefix, first, last, dir: Direction) => {
    const initial = observed(`${prefix}${first}`);
    const captured = native.find(sample => sample.sample === initial.rea_sample)!;
    let s = createMatch({ stage: "sb2-06", seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
    s.grid.tiles = captured.grids.current.flatMap(row => row.map(code => {
      const base = code & 63;
      return base === 2 ? Tile.Block : base === 5 || base === 6 ? Tile.Wall : Tile.Empty;
    }));
    for (let index = 0; index < s.players.length; index++) {
      const source = initial.players[index]!;
      s.players[index]!.px = (source.x - 8) * TILE / 16;
      s.players[index]!.py = (source.y - 24) * TILE / 16;
    }
    s.stageState!.sb2!.counterOffset = initial.frame;
    let frame = initial.frame;
    for (let index = first + 1; index <= last; index++) {
      const target = observed(`${prefix}${index}`);
      while (frame < target.frame) {
        const before = sb2NativeFramesAfterTicks(s.tick);
        do { step(s, { p1: { dir, bomb: false } }); } while (sb2NativeFramesAfterTicks(s.tick) === before);
        frame++;
        s = JSON.parse(JSON.stringify(s));
      }
      const player = s.players[0]!;
      expect({ x: player.px / (TILE / 16) + 8, y: player.py / (TILE / 16) + 24 }, target.label)
        .toEqual({ x: target.players[0]!.x, y: target.players[0]!.y });
      expect(player.alive).toBe(true);
    }
  });

  it("preserva as 28 células da canaleta no fundo original", () => {
    const reference = native.find(value => value.sample === observed("trench-duration-0").rea_sample)!;
    const cells = reference.grids.background.flatMap((row, y) => row.flatMap((code, x) => code === 14 ? [{ x, y }] : []));
    expect(SB2_CHANNEL_CELLS).toHaveLength(28);
    expect(SB2_CHANNEL_CELLS).toEqual(cells);
  });

  it("reproduz atraso e duração da ignição isolada, frame a frame", () => {
    const triggerFrame = observed("trench-duration-4").frame;
    for (const observation of observations.filter(value => value.label.startsWith("trench-duration-"))) {
      const sample = native.find(value => value.sample === observation.rea_sample)!;
      for (const cell of SB2_CHANNEL_CELLS) {
        // A célula atingida pela explosão comum tem sobreposição própria.
        if (cell.x === 3 && cell.y === 5) continue;
        expect(sb2ChannelActive(observation.frame - triggerFrame))
          .toBe(sample.grids.current[cell.y]![cell.x] === 1);
      }
    }
  });
});
