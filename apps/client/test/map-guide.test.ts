import { describe, expect, it } from "vitest";
import { SELECTABLE_STAGES } from "@bombtop/shared";
import { MAP_GUIDE, stepMap } from "../src/ui/map-guide";
import { STAGE_NAMES } from "../src/ui/stage-names";

describe("map guide", () => {
  it("has every map a room can pick, in the lobby's order, with its name, what it does and tips", () => {
    expect(MAP_GUIDE.map((m) => m.id)).toEqual([...SELECTABLE_STAGES]);
    for (const m of MAP_GUIDE) {
      expect(m.name, m.id).toBe(STAGE_NAMES[m.id]);
      expect(m.text.length, m.id).toBeGreaterThan(40);
      expect(m.tips.length, m.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("steps through the maps with the arrows, round from the last to the first and back", () => {
    const last = MAP_GUIDE.length - 1;
    expect(stepMap(0, 1)).toBe(1);
    expect(stepMap(last, 1)).toBe(0);
    expect(stepMap(0, -1)).toBe(last);
  });
});
