import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomCore, TICK_RATE } from "@bombtop/shared";
import { BattleRoom } from "../src/room";

afterEach(() => vi.restoreAllMocks());

async function timingHarness() {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const room = new BattleRoom();
  vi.spyOn(room, "setPatchRate").mockImplementation(() => {});
  const interval = vi.spyOn(room, "setSimulationInterval").mockImplementation(() => {});
  const update = vi.spyOn(RoomCore.prototype, "update").mockImplementation(() => {});
  await room.onCreate({});
  const callback = interval.mock.calls[0]![0]!;
  return {
    update,
    delay: interval.mock.calls[0]![1],
    advance(elapsed: number) {
      now += elapsed;
      // A framework clock can have been ticked by another consumer.
      callback(0);
    },
  };
}

describe("BattleRoom wall-clock simulation", () => {
  it("runs 60 ticks in a second even when callbacks arrive at 39 Hz", async () => {
    const h = await timingHarness();
    for (let i = 0; i < 39; i++) h.advance(1000 / 39);
    expect(h.update).toHaveBeenCalledTimes(TICK_RATE);
  });

  it("does not run the simulation early on frequent wakeups", async () => {
    const h = await timingHarness();
    h.advance(8);
    expect(h.update).not.toHaveBeenCalled();
    h.advance(9);
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it("bounds each catch-up batch and preserves reasonable elapsed debt", async () => {
    const h = await timingHarness();
    h.advance(200);
    expect(h.update).toHaveBeenCalledTimes(4);
    h.advance(0);
    expect(h.update).toHaveBeenCalledTimes(8);
    h.advance(0);
    expect(h.update).toHaveBeenCalledTimes(12);
    h.advance(0);
    expect(h.update).toHaveBeenCalledTimes(12);
  });

  it("caps a long suspension at 500 ms instead of fast-forwarding seconds", async () => {
    const h = await timingHarness();
    h.advance(5000);
    expect(h.update).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 8; i++) h.advance(0);
    expect(h.update).toHaveBeenCalledTimes(30);
  });

  it("wakes at half a simulation step without changing the simulation rate", async () => {
    const h = await timingHarness();
    expect(h.delay).toBe(1000 / TICK_RATE / 2);
  });
});
