import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SB2_CONVEYOR_DEFAULT, sb2ConveyorControlEntry, sb2ConveyorOutgoingDirection, sb2NativeConveyorSpeed,
} from "../src/sb2-conveyor";

interface Sample {
  kind: string;
  sample: number;
  players: { raw_hex: string }[];
  oam_bomb_region_hex?: string;
}
interface Reference { label: string; phase: string; rea_sample: number; frame: number }
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const report = read("SB2-CONVEYOR-COMPARISON.json");
const evidence = read("SB2-REA-CONVEYOR.json").records.find((record: { evidence_id: string }) => record.evidence_id === report.evidence_id);
if (!evidence || evidence.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
const samples: Sample[] = evidence.normalized_result.messages
  .filter((message: { type: string; payload?: { kind: string } }) => message.type === "send"
    && ["conveyor-observation", "conveyor-oam-observation"].includes(message.payload?.kind ?? ""))
  .map((message: { payload: Sample }) => message.payload);
const references = report.samples as Reference[];

function observation(label: string) {
  const reference = references.find(value => value.label === label);
  if (!reference) throw new Error(`Referência ausente: ${label}`);
  const sample = samples.find(value => value.kind === reference.phase && value.sample === reference.rea_sample);
  if (!sample) throw new Error(`Amostra REA ausente: ${label}`);
  const raw = Buffer.from(sample.players[0]!.raw_hex, "hex");
  return { ...reference, sample, x: raw.readUInt16LE(0x10) + raw.readUInt16LE(0x12) / 65536,
    y: raw.readUInt16LE(0x18) + raw.readUInt16LE(0x1a) / 65536 };
}

describe("esteira SB2 conferida no REA", () => {
  it("reproduz a velocidade normal fracionária que transportou o jogador", () => {
    const a = observation("bomb-default-2"), b = observation("bomb-default-3");
    expect(sb2NativeConveyorSpeed(false)).toBe((b.x - a.x) / (b.frame - a.frame));
  });

  it("inverte a direção para um jogador que entrou depois do comando", () => {
    const state = sb2ConveyorControlEntry(SB2_CONVEYOR_DEFAULT, 0, 18);
    const a = observation("fresh-upper-idle-1"), b = observation("fresh-upper-idle-2");
    expect(sb2ConveyorOutgoingDirection(23, state.reversed)).toBe("left");
    expect(-sb2NativeConveyorSpeed(state.fast)).toBe((b.x - a.x) / (b.frame - a.frame));
  });

  it("alterna a velocidade nas cinco entradas medidas, sem repetir enquanto permanece no piso", () => {
    let state = SB2_CONVEYOR_DEFAULT;
    for (let count = 1; count <= 5; count++) {
      state = sb2ConveyorControlEntry(state, 0, 19);
      expect(sb2ConveyorControlEntry(state, 19, 19)).toBe(state);
      const prefix = count === 1 ? "fresh-lower" : `cycle-${count}`;
      const a = observation(`${prefix}-idle-1`), b = observation(`${prefix}-idle-2`);
      expect(sb2NativeConveyorSpeed(state.fast)).toBe((b.x - a.x) / (b.frame - a.frame));
    }
  });

  it("confere a reversão e aceleração da bomba pela posição OAM observada", () => {
    for (const [from, to, reversed, fast] of [
      ["confirmed-upper-9", "confirmed-upper-11", false, false],
      ["confirmed-upper-11", "confirmed-upper-13", true, false],
      ["confirmed-lower-12", "confirmed-lower-13", true, true],
    ] as const) {
      const a = observation(from), b = observation(to);
      const ax = Buffer.from(a.sample.oam_bomb_region_hex!, "hex")[0]!;
      const bx = Buffer.from(b.sample.oam_bomb_region_hex!, "hex")[0]!;
      const expected = (reversed ? -1 : 1) * sb2NativeConveyorSpeed(fast) * (b.frame - a.frame);
      expect(Math.abs((bx - ax) - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("confere os quatro segmentos retos nos dois sentidos após percorrer os cantos", () => {
    const visited = new Set<string>();
    const segment = (p: { x: number; y: number }) => {
      if (p.x > 80 && p.x < 176 && Math.abs(p.y - 80) <= 2) return 23;
      if (p.x > 80 && p.x < 176 && Math.abs(p.y - 176) <= 2) return 24;
      if (p.y > 96 && p.y < 160 && Math.abs(p.x - 64) <= 2) return 25;
      if (p.y > 96 && p.y < 160 && Math.abs(p.x - 192) <= 2) return 26;
      return null;
    };
    for (const reversed of [false, true]) {
      const mode = reversed ? "ccw" : "cw";
      for (let frame = 2; frame <= 48; frame++) {
        const a = observation(`loop-${mode}-${frame - 1}`), b = observation(`loop-${mode}-${frame}`);
        const code = segment(a);
        if (code === null || segment(b) !== code) continue;
        const direction = Math.abs(b.x - a.x) > Math.abs(b.y - a.y)
          ? b.x > a.x ? "right" : "left" : b.y > a.y ? "down" : "up";
        expect(sb2ConveyorOutgoingDirection(code, reversed)).toBe(direction);
        visited.add(`${mode}:${code}`);
      }
    }
    expect(visited.size).toBe(8);
  });
});
