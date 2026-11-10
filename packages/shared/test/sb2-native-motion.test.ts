import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SB2_JUMP_NATIVE_FRAMES, SB2_SPAWN_POINTS, sb2NativeJumpHeight } from "../src/sb2-native-motion";
import type { Sb2ArenaNumber } from "../src/sb2-stage-captures";

interface PlayerObservation { seat: number; x: number; y: number; raw_hex: string }
interface MotionObservation { sample: number; selection_byte_1ccd: number; players: PlayerObservation[] }

const bundle = JSON.parse(readFileSync(new URL("../../../docs/sb2/SB2-REA-PLAYER-OBSERVATIONS.json", import.meta.url), "utf8"));
const evidence = bundle.records.find((record: { evidence_id: string }) => record.evidence_id === "ev_67648619c804019bae10fe8d6ecec3e581c261249431469bc4b603fba8d70329");
if (!evidence || evidence.normalized_result.messages_truncated) throw new Error("Evidência REA incompleta");
const samples: MotionObservation[] = evidence.normalized_result.messages
  .filter((message: { type: string; payload?: { kind: string } }) => message.type === "send" && message.payload?.kind === "native-players")
  .map((message: { payload: MotionObservation }) => message.payload);

describe("movimento nativo SB2 observado pelo REA", () => {
  for (let number = 1; number <= 12; number++) {
    it(`preserva as quatro posições iniciais da arena ${number}`, () => {
      const observation = samples[number - 1]!;
      expect(observation.selection_byte_1ccd).toBe(number - 1);
      const positions = observation.players.map(player => ({ x: (player.x - 16) / 16, y: (player.y - 32) / 16 }));
      expect(SB2_SPAWN_POINTS[number as Sb2ArenaNumber]).toEqual(positions);
    });
  }

  it("reproduz as 32 alturas fracionárias registradas no salto da arena 10", () => {
    for (let frame = 1; frame <= SB2_JUMP_NATIVE_FRAMES; frame++) {
      const observation = samples.find(value => value.sample === 97 + frame)!;
      expect(observation.selection_byte_1ccd).toBe(9);
      const entity = Buffer.from(observation.players[0]!.raw_hex, "hex");
      const y = entity.readUInt16LE(0x18) + entity.readUInt16LE(0x1a) / 65536;
      expect(sb2NativeJumpHeight(frame)).toBe(48 - y);
    }
  });
});
