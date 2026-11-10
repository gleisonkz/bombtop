import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sb2NativeJumpHeight, sb2NativeJumpFlightY } from "../src/sb2-native-motion";

interface Sample {
  index: number;
  players: { x: number; y: number; mode_word: number }[];
  grid: number[][];
}
const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE10-JUMP-CONTROLS-FULL-REPLAY.json", import.meta.url), "utf8"));
const directionalReplay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE10-JUMP-DIRECTIONS-FULL-REPLAY.json", import.meta.url), "utf8"));

describe("controles do salto10 nas capturas REA/MCP", () => {
  for (const [name, samples] of Object.entries(directionalReplay.cases)) {
    it(`confronta voo livre até a aterrissagem nativa: ${name}`, () => {
      let checked = 0;
      for (const sample of samples.slice(1)) {
        const player = sample.players[0]!;
        if (!(player.mode_word & 1)) continue;
        const elapsed = name === "double-right" && sample.index >= 35 ? sample.index - 34 : sample.index;
        expect(player.y, `frame ${sample.index}`).toBe(sb2NativeJumpFlightY(48, elapsed));
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    });
  }

  it("um novo pulso após soltura inicia segundo salto na direção escolhida", () => {
    const samples = directionalReplay.cases["double-right"]!;
    for (let elapsed = 1; elapsed <= 32; elapsed++) {
      expect(samples[34 + elapsed]!.players[0]).toMatchObject({
        x: 48 + elapsed * 0.5, y: sb2NativeJumpFlightY(48, elapsed),
      });
    }
    expect(samples[67]!.players[0]).toMatchObject({ x: 64, y: 48, mode_word: 0 });
  });

  it("a travessia esquerda continua sem entrada após o salto e retorna pela borda oposta", () => {
    const samples = directionalReplay.cases["pulse-left"]!;
    for (let frame = 34; frame <= 73; frame++) {
      expect(samples[frame]!.players[0]).toMatchObject({ x: (49 - frame + 256) % 256, y: 48 });
    }
    // No74 a rotina de reentrada recentra232->224 em vez de seguir231.
    for (let frame = 74; frame <= 160; frame++) {
      expect(samples[frame]!.players[0]).toMatchObject({ x: 224, y: 48, mode_word: 0 });
    }
  });

  for (const [name, samples] of Object.entries(replay.cases)) {
    it(`confere frame0, arco e aterrissagem sem usar outro estágio como origem: ${name}`, () => {
      const start = samples[0]!.players[0]!;
      expect(start).toMatchObject({ x: 32, y: 48, mode_word: 0 });
      for (let frame = 1; frame <= 32; frame++) {
        const player = samples[frame]!.players[0]!;
        expect({ x: player.x, y: player.y }, `frame ${frame}`).toEqual({
          x: start.x + (name === "pulse-neutral" ? 0 : frame * 0.5),
          y: start.y - sb2NativeJumpHeight(frame),
        });
      }
      expect(samples[33]!.players[0]).toMatchObject({
        x: name === "pulse-neutral" ? 32 : 48, y: 48, mode_word: 0,
      });
    });
  }

  it("manter Y não repete o salto nessa sequência de160 frames", () => {
    const held = replay.cases["hold-right"]!, pulse = replay.cases["pulse-right"]!;
    expect(held).toHaveLength(161);
    for (let frame = 0; frame <= 160; frame++) {
      expect(held[frame]!.players, `jogadores ${frame}`).toEqual(pulse[frame]!.players);
      expect(held[frame]!.grid, `grade ${frame}`).toEqual(pulse[frame]!.grid);
    }
  });

  it("reversão só muda deslocamento depois do frame de aterrissagem", () => {
    const samples = replay.cases["pulse-reverse"]!;
    for (let frame = 34; frame <= 40; frame++) {
      expect(samples[frame]!.players[0]!.x).toBe(48 - (frame - 33) * 1.25);
    }
    for (let frame = 41; frame <= 160; frame++) {
      expect(samples[frame]!.players[0]).toMatchObject({ x: 39.25, y: 48 });
    }
  });
});
