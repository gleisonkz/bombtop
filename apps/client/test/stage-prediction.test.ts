import { describe, expect, it } from "vitest";
import { createMatch, Floor, publicView, tileCenter, type Snapshot } from "@bombtop/shared";
import { Predictor } from "../src/net/prediction";

function snapshot(): Snapshot {
  return { ...publicView(createMatch({ seed: 1, stage: "sb4-06", playerIds: ["me", "other"], blockDensity: 0 })), acks: {} };
}

describe("stage movement prediction", () => {
  it("uses sticky movement for every replayed tick without mutating the snapshot", () => {
    const snap = snapshot();
    const player = snap.players[0]!;
    player.px = tileCenter(3);
    player.py = tileCenter(3);
    snap.grid.floor[3 * snap.grid.width + 3] = Floor.Surprise;
    snap.stageState = { surprise: { [3 * snap.grid.width + 3]: { kind: "sticky", hits: 1 } } };
    const before = structuredClone(snap);
    const predictor = new Predictor("me");
    for (let i = 0; i < 3; i++) predictor.step({ dir: "right", bomb: false });
    expect(predictor.predict(snap)!.px).toBe(player.px + 3 * player.speed / 2);
    expect(snap).toEqual(before);
  });

  it.each(["flight", "trolley"])("keeps authoritative %s movement", kind => {
    const snap = snapshot();
    snap.stageState = kind === "flight"
      ? { flights: { me: { dir: "right", ticks: 12, remaining: 256 } } }
      : { trolley: { px: snap.players[0]!.px, py: snap.players[0]!.py, dir: "right", riderId: "me" } };
    const predictor = new Predictor("me");
    predictor.step({ dir: "right", bomb: false });
    expect(predictor.predict(snap)).toEqual(snap.players[0]);
  });
});
