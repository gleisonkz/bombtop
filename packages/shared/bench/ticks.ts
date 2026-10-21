/**
 * Server tick benchmark: plays seeded matches (one idle human plus bots) and
 * times every tick, and the bots' share of it, so a change to the AI or the
 * simulation can be compared before and after on the same scenarios.
 *
 *   pnpm -C packages/shared bench            # every scenario
 *   pnpm -C packages/shared bench hard4      # only scenarios whose name contains "hard4"
 *
 * A tick has 16.67 ms (60 Hz); the budget line flags scenarios whose p99 uses
 * more than a quarter of it, leaving room for the rest of the server and slower machines.
 */
import { performance } from "node:perf_hooks";
import { BattleSession, Bot, getTile, playerTile, setTile, Tile, TICK_RATE, type BotLevel } from "../src";

interface Scenario {
  name: string;
  bots: number;
  level: BotLevel;
  /** Every player starts maxed out: many bombs, long blasts, chains everywhere. */
  loaded?: boolean;
}

const TICKS = 6000;
const WARMUP = 600;
const BUDGET_MS = 1000 / TICK_RATE / 4;

const SCENARIOS: Scenario[] = [
  ...(["easy", "medium", "hard"] as const).flatMap((level) => [1, 2, 4].map((bots) => ({ name: `${level}${bots}`, bots, level }))),
  { name: "hard4-loaded", bots: 4, level: "hard", loaded: true },
];

/** Bot time is summed here by wrapping Bot.input. */
let botMs = 0;
const input = Bot.prototype.input;
Bot.prototype.input = function (this: Bot, ...args: Parameters<typeof input>) {
  const t = performance.now();
  try {
    return input.apply(this, args);
  } finally {
    botMs += performance.now() - t;
  }
};

function start(sc: Scenario, round: number): BattleSession {
  let n = 0;
  const s = new BattleSession({ seed: () => 1234 + round, random: () => (n++ % 7) / 7 });
  s.join("human", "Human");
  for (let i = 0; i < sc.bots; i++) s.addBot("human", sc.level);
  s.start("human");
  if (sc.loaded) {
    for (const p of s.match!.players) {
      p.bombCapacity = 8;
      p.fireRange = 8;
    }
  }
  return s;
}

function stats(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, p95: at(0.95), p99: at(0.99), max: sorted.at(-1)! };
}

function run(sc: Scenario) {
  const total: number[] = [];
  const bots: number[] = [];
  let round = 0;
  let s = start(sc, round);
  let bombs = 0;
  for (let i = 0; i < WARMUP + TICKS; i++) {
    if (s.phase !== "playing") s = start(sc, ++round);
    botMs = 0;
    const t = performance.now();
    s.tick();
    const dt = performance.now() - t;
    if (i < WARMUP) continue;
    total.push(dt);
    bots.push(botMs);
    bombs += s.match?.bombs.length ?? 0;
  }
  return { total: stats(total), bots: stats(bots), rounds: round + 1, bombs: bombs / TICKS };
}

/**
 * Worst case for the bots' danger map: a field full of bombs (every other open tile, mixed fuses,
 * piercing and remote ones too) so blasts chain into each other. Times one bot's thought on it.
 */
function dense(level: BotLevel) {
  const s = start({ name: "dense", bots: 4, level, loaded: true }, 0);
  const m = s.match!;
  const types = ["normal", "normal", "pierce", "remote"] as const;
  let i = 0;
  const taken = new Set(m.players.map((p) => `${playerTile(p).x},${playerTile(p).y}`));
  for (let y = 0; y < m.grid.height; y++) for (let x = 0; x < m.grid.width; x++) if (getTile(m, x, y) === Tile.Block) setTile(m, x, y, Tile.Empty);
  for (let y = 0; y < m.grid.height; y++) {
    for (let x = 0; x < m.grid.width; x++) {
      if (getTile(m, x, y) !== Tile.Empty || (x + y) % 2 || taken.has(`${x},${y}`)) continue;
      const owner = m.players[i % m.players.length]!.id;
      m.bombs.push({ ownerId: owner, x, y, fuse: 30 + ((i * 37) % 150), range: 8, type: types[i++ % 4]!, slide: null, offset: 0, air: null, heldBy: null });
    }
  }
  const bot = new Bot(m.players[1]!.id, level);
  const times: number[] = [];
  for (let k = 0; k < 2000; k++) {
    m.tick++; // fresh thinking ticks, same field
    botMs = 0;
    bot.input(m);
    times.push(botMs);
  }
  return { bombs: m.bombs.length, bot: stats(times) };
}

const filter = process.argv[2];
const ms = (x: number) => x.toFixed(3).padStart(7);
console.log(`ticks per scenario: ${TICKS} (after ${WARMUP} warm-up), budget p99 < ${BUDGET_MS.toFixed(2)} ms`);
console.log("scenario        |   mean     p95     p99     max | bots: mean     p99 | bombs rounds");
let over = 0;
for (const sc of SCENARIOS.filter((x) => !filter || x.name.includes(filter))) {
  const r = run(sc);
  const flag = r.total.p99 > BUDGET_MS ? "  << over budget" : "";
  if (flag) over++;
  console.log(
    `${sc.name.padEnd(15)} | ${ms(r.total.mean)} ${ms(r.total.p95)} ${ms(r.total.p99)} ${ms(r.total.max)} |  ${ms(r.bots.mean)} ${ms(r.bots.p99)} | ${r.bombs.toFixed(1).padStart(5)} ${String(r.rounds).padStart(6)}${flag}`,
  );
}
for (const level of ["medium", "hard"] as const) {
  const name = `dense-${level}`;
  if (filter && !name.includes(filter)) continue;
  const r = dense(level);
  const flag = r.bot.p99 > BUDGET_MS / 4 ? "  << over budget" : "";
  if (flag) over++;
  console.log(`${name.padEnd(15)} | one bot, ${r.bombs} bombs: mean ${ms(r.bot.mean)}  p99 ${ms(r.bot.p99)}  max ${ms(r.bot.max)}${flag}`);
}
process.exitCode = over ? 1 : 0;
