/**
 * Reads a recorded round (a replay file from the server's LOG_DIR/replays, see `Replay`):
 *   pnpm -C packages/shared replay <file.json>             who played, how it ended, and a timeline of what happened
 *   pnpm -C packages/shared replay <file.json> --tick 1234  also writes the match as it was at that tick (JSON)
 * A replay plays back exactly only on the game version that recorded it (its `commit`): check that out first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { publicView, replayEvents, replayMatch, TICK_RATE, type Replay } from "../src";

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error("uso: replay <arquivo.json> [--tick N]");
  process.exit(1);
}
const replay = JSON.parse(readFileSync(file, "utf8")) as Replay & { commit?: string; room?: string; t?: string };
const seconds = (tick: number) => `${(tick / TICK_RATE).toFixed(2).padStart(7)}s`;
const name = new Map(replay.players.map((p) => [p.id, `${p.name}${p.bot ? ` (bot ${p.bot})` : ""} [${p.character}]`]));

console.log(`sala ${replay.room ?? "?"} • round ${replay.round} • ${replay.t ?? ""} • commit ${replay.commit ?? "?"}`);
console.log(`fase ${replay.options.stage ?? "classic"} • seed ${replay.options.seed} • ${replay.ticks} ticks (${seconds(replay.ticks).trim()})`);
for (const p of replay.players) console.log(`  ${p.id}: ${name.get(p.id)}`);
console.log(`resultado: ${replay.result ? `venceu ${replay.result.winnerId ? name.get(replay.result.winnerId) : "ninguém (empate)"}` : "não terminou"}`);
console.log("");
for (const e of replayEvents(replay)) {
  console.log(`${seconds(e.tick)}  t${String(e.tick).padStart(5)}  ${(name.get(e.who) ?? e.who).padEnd(36)} ${e.what}${e.detail ? ` ${name.get(e.detail) ?? e.detail}` : ""} (${e.x},${e.y})`);
}

const at = rest.indexOf("--tick");
if (at >= 0) {
  const tick = Number(rest[at + 1]);
  const out = file.replace(/\.json$/, `.t${tick}.json`);
  writeFileSync(out, JSON.stringify(publicView(replayMatch(replay, tick)), null, 2));
  console.log(`\nestado no tick ${tick}: ${out}`);
}
