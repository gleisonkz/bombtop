import { describe, expect, it } from "vitest";
import { createMatch, publicView, TILE, type PlayerInput, type Snapshot } from "@bombtop/shared";
import { Predictor } from "../src/net/prediction";

const input = (dir: PlayerInput["dir"], extra: Partial<PlayerInput> = {}): PlayerInput => ({ dir, bomb: false, ...extra });

function snapshot(acks: Snapshot["acks"] = {}): Snapshot {
  const match = createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 });
  return { ...publicView(match), acks };
}

describe("Predictor", () => {
  it("only asks to send when the input changes or a button is pressed", () => {
    const p = new Predictor("me");
    expect(p.step(input("right"))).toBe(1);
    expect(p.step(input("right"))).toBeNull();
    expect(p.step(input("right", { bomb: true }))).toBe(2);
    expect(p.step(input("right", { alt: "down" }))).toBe(3);
    expect(p.step(input(null))).toBe(4);
  });

  it("counts its ticks, so each sent input can carry the tick it was made on", () => {
    const pr = new Predictor("p1");
    expect(pr.clock).toBe(0);
    pr.step({ dir: "right", bomb: false });
    pr.step({ dir: "right", bomb: false });
    expect(pr.clock).toBe(2);
  });

  it("replays inputs the server has not applied yet on top of the snapshot", () => {
    const p = new Predictor("me");
    const snap = snapshot(); // server has seen nothing yet
    const start = snap.players[0]!;
    p.step(input("right"));
    p.step(input("right"));
    p.step(input("right"));
    const me = p.predict(snap)!;
    expect(me.px).toBe(start.px + 3 * start.speed);
    expect(me.py).toBe(start.py);
  });

  it("skips the ticks the server already ran", () => {
    const p = new Predictor("me");
    const snap = snapshot({ me: { seq: 1, ticks: 2 } });
    const start = snap.players[0]!;
    for (let i = 0; i < 5; i++) p.step(input("right"));
    expect(p.predict(snap)!.px).toBe(start.px + 3 * start.speed);
  });

  it("follows later inputs in order, through the diagonal fallback", () => {
    const p = new Predictor("me");
    const snap = snapshot({ me: { seq: 1, ticks: 1 } });
    const start = snap.players[0]!;
    p.step(input("down")); // seq 1, already applied once on the server
    p.step(input("down"));
    p.step(input("left", { alt: "down" })); // seq 2: wall on the left, so it keeps walking down
    const me = p.predict(snap)!;
    expect(me.px).toBe(start.px);
    expect(me.py).toBe(start.py + 2 * start.speed);
    expect(me.facing).toBe("down");
  });

  it("reset (new match) forgets old inputs and resends the held one", () => {
    const p = new Predictor("me");
    for (let i = 0; i < 50; i++) p.step(input("right"));
    p.step(input("down"));
    p.reset();
    const snap = snapshot(); // fresh match: no ack for us yet
    expect(p.step(input("down"))).toBe(3); // still held: sent again, numbering goes on
    expect(p.predict(snap)!.py).toBe(snap.players[0]!.py + snap.players[0]!.speed);
  });

  it("does not predict a player the server is moving on its own", () => {
    const p = new Predictor("me");
    const snap = snapshot();
    snap.players[0]!.stun = 10;
    p.step(input("right"));
    expect(p.predict(snap)!.px).toBe(snap.players[0]!.px);
  });

  it("returns null when the player is not in the match", () => {
    expect(new Predictor("ghost").predict(snapshot())).toBeNull();
  });

  it("keeps positions on the grid", () => {
    const p = new Predictor("me");
    const snap = snapshot();
    for (let i = 0; i < 100; i++) p.step(input("left"));
    expect(p.predict(snap)!.px).toBe(TILE + TILE / 2); // stopped by the border wall
  });
});
