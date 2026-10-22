import { Room } from "@colyseus/core";
import { C2S, RoomCore, TickClock, TICK_RATE } from "@bombtop/shared";

const step = 1000 / TICK_RATE;
const duration = 2000;

function coreWithBots(bots: number) {
  const core = new RoomCore("bench", { send() {}, broadcast() {} });
  core.join("human", "Human", "bomb");
  for (let i = 0; i < bots; i++) core.message("human", C2S.addBot, "hard");
  core.message("human", C2S.start);
  return core;
}

async function measure(kind: "timer" | "colyseus" | "elapsed" | "elapsed-half", bots: number) {
  const core = bots ? coreWithBots(bots) : undefined;
  const costs: number[] = [];
  const gaps: number[] = [];
  const deltas: number[] = [];
  const room = new Room();
  const start = performance.now();
  const clock = new TickClock(step, start);
  let ticks = 0;
  let last = start;
  const callback = (delta?: number) => {
    const now = performance.now();
    gaps.push(now - last);
    last = now;
    if (delta !== undefined) deltas.push(delta);
    const due = kind.startsWith("elapsed") ? clock.due(now) : 1;
    for (let i = 0; i < due; i++) {
      const before = performance.now();
      core?.update();
      costs.push(performance.now() - before);
      ticks++;
    }
  };
  const timer = kind === "timer" ? setInterval(callback, step) : undefined;
  if (kind !== "timer") room.setSimulationInterval(callback, kind === "elapsed-half" ? step / 2 : step);
  await new Promise((resolve) => setTimeout(resolve, duration));
  if (timer) clearInterval(timer);
  room.setSimulationInterval();
  const elapsed = performance.now() - start;
  costs.sort((a, b) => a - b);
  console.log(JSON.stringify({ kind, bots, callbacks: gaps.length, hz: gaps.length * 1000 / elapsed,
    simulationHz: ticks * 1000 / elapsed, behindMs: clock.behind,
    gapMean: gaps.reduce((a, b) => a + b, 0) / gaps.length, gapMax: Math.max(...gaps),
    costMean: costs.reduce((a, b) => a + b, 0) / costs.length,
    costP99: costs[Math.floor(costs.length * 0.99)], costMax: costs.at(-1),
    deltaSum: deltas.reduce((a, b) => a + b, 0), wallMs: elapsed }));
}

const kinds = process.argv.includes("--fixed") ? ["elapsed", "elapsed-half"] as const : ["timer", "colyseus"] as const;
for (const kind of kinds) {
  for (let bots = 0; bots <= 4; bots++) await measure(kind, bots);
}
