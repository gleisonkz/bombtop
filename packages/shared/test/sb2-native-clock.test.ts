import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TICK_RATE } from "../src/constants";
import { SB2_NATIVE_CLOCK, sb2NativeFramesAfterTicks, sb2NativeFramesOnTick } from "../src/sb2-native-clock";
import { sb2NativeConveyorStep } from "../src/sb2-conveyor";
import { sb2NativePauseInput } from "../src/sb2-pause-panel";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${name}`, import.meta.url), "utf8"));
const timing = read("SB2-NATIVE-CLOCK-COMPARISON.json");
const native = read("SB2-REA-NATIVE-CLOCK.json").records
  .find((record: { evidence_id: string }) => record.evidence_id === timing.evidence_id);
if (!native || native.normalized_result.messages_truncated) throw new Error("Relógio REA incompleto");
const fps: number = native.normalized_result.messages.find((message: { payload?: { kind: string } }) =>
  message.payload?.kind === "native-av-info").payload.frames_per_second;

describe("relógio PAL de SB2 na simulação de 60 Hz", () => {
  it("preserva a razão observada na ABI libretro", () => {
    expect(timing.status).toBe("matched");
    expect(timing.region).toBe("PAL");
    expect(SB2_NATIVE_CLOCK.cyclesPerSecond / SB2_NATIVE_CLOCK.cyclesPerFrame).toBe(fps);
    expect(timing.frames_per_second).toBe(fps);
  });

  it("distribui os passos nativos pelos ticks sem acelerar a simulação", () => {
    let frames = 0;
    expect(sb2NativeFramesAfterTicks(0)).toBe(0);
    expect(sb2NativeFramesOnTick(0)).toBe(0);
    for (let tick = 1; tick <= TICK_RATE; tick++) {
      const count = sb2NativeFramesOnTick(tick);
      expect(count === 0 || count === 1).toBe(true);
      frames += count;
      expect(frames).toBe(Math.floor(tick / TICK_RATE * fps));
    }
    expect(frames).toBe(50);
  });

  it("mantém a contagem de uma partida longa e a fase após uma retomada", () => {
    for (const seconds of [120, 180, 600, 3600, 86400]) {
      expect(sb2NativeFramesAfterTicks(seconds * TICK_RATE)).toBe(Math.floor(seconds * fps));
    }
    const start = 180 * TICK_RATE;
    let frames = sb2NativeFramesAfterTicks(start);
    for (let tick = start + 1; tick <= start + TICK_RATE; tick++) frames += sb2NativeFramesOnTick(tick);
    expect(frames).toBe(sb2NativeFramesAfterTicks(start + TICK_RATE));
    expect(sb2NativeFramesAfterTicks(start)).toBe(9001);
  });

  it("libera a pausa no passo PAL correto, preservando o comando guardado", () => {
    const report = read("SB2-PAUSE-PANEL-COMPARISON.json");
    const position = (label: string): number => report.samples.find((value: { label: string }) => value.label === label).players[0].y;
    let y = position("entered");
    const releaseTick = Math.ceil(127 / fps * TICK_RATE);
    for (let tick = 1; tick <= releaseTick + 1; tick++) {
      if (sb2NativeFramesOnTick(tick)) {
        const command = sb2NativePauseInput(sb2NativeFramesAfterTicks(tick),
          { dir: "up", bomb: false }, { dir: "down", bomb: false });
        y += command?.dir === "up" ? -1.25 : command?.dir === "down" ? 1.25 : 0;
      }
      if (tick === releaseTick - 1) expect(y).toBe(position("opposite-126"));
      if (tick === releaseTick) expect(y).toBe(position("opposite-127"));
      if (tick === releaseTick + 1) expect(y).toBe(position("opposite-128"));
    }
  });

  it.each(["fast-cw", "fast-ccw"])("preserva o percurso nativo %s sob ticks de 60 Hz", prefix => {
    const report = read("SB2-CONVEYOR-ALIGNMENT-COMPARISON.json");
    const observations: { label: string; frame: number; players: { x: number; y: number }[] }[] =
      report.samples.filter((value: { label: string }) => value.label.startsWith(`${prefix}-`));
    const start = observations[0]!, last = observations.at(-1)!;
    const byFrame = new Map(observations.map(value => [value.frame - start.frame, value.players[0]!]));
    let predicted = { x: start.players[0]!.x, y: start.players[0]!.y };
    const end = Math.ceil((last.frame - start.frame) / fps * TICK_RATE);
    for (let tick = 1; tick <= end; tick++) {
      if (sb2NativeFramesOnTick(tick)) predicted = sb2NativeConveyorStep(predicted,
        { fast: true, reversed: prefix === "fast-ccw" });
      const reference = byFrame.get(sb2NativeFramesAfterTicks(tick));
      if (reference) expect(predicted).toEqual({ x: reference.x, y: reference.y });
    }
    expect(predicted).toEqual({ x: last.players[0]!.x, y: last.players[0]!.y });
  });
});
