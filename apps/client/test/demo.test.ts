import { describe, expect, it } from "vitest";
import { STAGES, TICK_RATE } from "@bombtop/shared";
import { DEMO_PAUSE, DemoMatch } from "../src/game/demo";

describe("demo match", () => {
  it("bots play on their own: they move and drop bombs", () => {
    const demo = new DemoMatch(() => 7);
    const start = demo.state.players.map((p) => `${p.px},${p.py}`);
    let bombs = 0;
    for (let i = 0; i < 10 * TICK_RATE; i++) {
      demo.advance();
      bombs = Math.max(bombs, demo.state.bombs.length);
    }
    expect(demo.state.players.map((p) => `${p.px},${p.py}`)).not.toEqual(start);
    expect(bombs).toBeGreaterThan(0);
  });

  it("mixes the characters", () => {
    const demo = new DemoMatch(() => 7);
    expect(new Set(demo.state.players.map((p) => p.character)).size).toBeGreaterThan(1);
  });

  it("shows the winner for a moment, then starts a new match on the next stage", () => {
    const demo = new DemoMatch(() => 7);
    const first = demo.state;
    for (const p of first.players.slice(1)) p.alive = false;
    demo.advance();
    expect(demo.winner).toBe(first.players[0]!.id);
    for (let i = 0; i < DEMO_PAUSE - 1; i++) demo.advance();
    expect(demo.state).toBe(first);
    demo.advance();
    expect(demo.state).not.toBe(first);
    expect(demo.winner).toBeUndefined();
    expect(demo.stage).toBe(STAGES[1]);
  });
});
