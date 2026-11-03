import { mkdtempSync, readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { BattleSession, type Replay } from "@bombtop/shared";
import { ReplayLog, replayRoute } from "../src/replay-log";

function aReplay(): Replay {
  const s = new BattleSession({ seed: () => 5 });
  s.join("c1", "Ana");
  s.join("c2", "Bia");
  s.setReady("c2", true);
  s.start("c1");
  for (let i = 0; i < 30; i++) s.tick();
  return s.replay()!;
}

const at = (iso: string) => () => new Date(iso);

describe("ReplayLog", () => {
  it("keeps each round in its own file, a folder per day, with the room and the game's commit", () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    const log = new ReplayLog(dir, at("2026-11-03T18:04:05Z"), "abc1234");
    const file = log.write("ROOM1", aReplay());
    expect(file).toBe(join(dir, "replays", "2026-11-03", "180405-ROOM1-r1.json"));
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved).toMatchObject({ t: "2026-11-03T18:04:05.000Z", room: "ROOM1", commit: "abc1234", v: 1, round: 1, ticks: 30 });
  });

  it("forgets days older than it keeps", () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    mkdirSync(join(dir, "replays", "2026-09-01"), { recursive: true });
    mkdirSync(join(dir, "replays", "2026-10-20"), { recursive: true });
    new ReplayLog(dir, at("2026-11-03T00:00:00Z"), "x", 30).write("R", aReplay());
    expect(readdirSync(join(dir, "replays")).sort()).toEqual(["2026-10-20", "2026-11-03"]);
  });
});

function post(body: string, ip = "1.2.3.4") {
  const req = Object.assign(Readable.from([Buffer.from(body)]), { headers: { "x-forwarded-for": ip }, socket: { remoteAddress: ip } });
  const res = { status: 0, writeHead(s: number) { this.status = s; }, end() {} };
  return { req, res };
}

describe("POST /replay (offline rounds, played in a browser)", () => {
  it("keeps a sane replay, under the client's build", async () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    const route = replayRoute(new ReplayLog(dir, at("2026-11-03T18:04:05Z"), "server"));
    const { req, res } = post(JSON.stringify({ room: "offline", v: "f8ff83a", replay: aReplay() }));
    await route(req as never, res as never);
    expect(res.status).toBe(204);
    const saved = JSON.parse(readFileSync(join(dir, "replays", "2026-11-03", "180405-offline-r1.json"), "utf8"));
    expect(saved.commit).toBe("f8ff83a");
  });

  it("drops anything that is not one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "replays-"));
    const route = replayRoute(new ReplayLog(dir, at("2026-11-03T18:04:05Z"), "server"));
    for (const body of ["nope", JSON.stringify({ replay: { v: 2 } }), JSON.stringify({ room: "../../etc", replay: { ...aReplay(), inputs: "x" } })]) {
      const { req, res } = post(body);
      await route(req as never, res as never);
    }
    expect(existsSync(join(dir, "replays"))).toBe(false);
  });
});
