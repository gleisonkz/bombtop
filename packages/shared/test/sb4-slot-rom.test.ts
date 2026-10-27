import { describe, expect, it } from "vitest";
import { sb4SlotOutcome } from "../src/sb4-slot-rom";

describe("SB4 stage 08 ROM slot outcomes", () => {
  it.each([
    [[0, 0, 0], 0x15bf, [43, 36, 37], false],
    [[0, 0, 1], 0x1526, [43, 36, 37], false],
    [[0, 1, 1], 0x14f9, [43, 36, 37], false],
    [[0, 0, 3], 0x14f7, [], false],
    [[1, 2, 1], 0x14d6, [13], false],
    [[1, 2, 3], 0x1611, [14, 5, 5], false],
    [[1, 3, 3], 0x163a, [17, 17, 17], false],
    [[1, 1, 2], 0x1662, [5, 1, 3], false],
    [[3, 3, 3], 0x1682, [3, 4, 3], false],
    [[1, 1, 1], 0x16a2, [7, 17, 17], false],
    [[2, 2, 2], 0x17ad, [1], true],
  ] as const)("dispatches native reels %j through callback %i", (symbols, callback, itemIds, cascade) => {
    expect(sb4SlotOutcome(symbols)).toEqual({ callback, itemIds, cascade });
  });

  it("rejects invalid native reel values", () => {
    expect(sb4SlotOutcome([0, 0, 4])).toBeNull();
    expect(sb4SlotOutcome([-1, 1, 1])).toBeNull();
  });
});
