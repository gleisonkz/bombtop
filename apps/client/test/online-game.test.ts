import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C2S, createMatch, publicView, S2C, TILE, type Snapshot } from "@bombtop/shared";
import type { ModeContext } from "../src/game/mode";
import type { RoomLink } from "../src/net/room-link";
import type { LobbyPanel } from "../src/ui/lobby";

vi.mock("../src/ui/net-hud", async (original) => ({ ...(await original<typeof import("../src/ui/net-hud")>()), debugNet: () => false, NetHud: vi.fn() }));

let OnlineGame: typeof import("../src/game/online-game").OnlineGame;

beforeAll(async () => {
  vi.stubGlobal("location", { href: "http://localhost:5173", search: "" });
  ({ OnlineGame } = await import("../src/game/online-game"));
});

describe("online snapshot rendering", () => {
  let now: number;
  let handlers: Map<string, (message: unknown) => void>;
  let game: import("../src/game/online-game").OnlineGame;
  let draw: ReturnType<typeof vi.fn>;
  let send: ReturnType<typeof vi.fn>;
  let specialCooldown: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("window", {});
    handlers = new Map();
    draw = vi.fn();
    send = vi.fn();
    specialCooldown = vi.fn();
    const link: RoomLink = {
      sessionId: "me", roomId: "test", reconnectionToken: "",
      send, onMessage: (type, callback) => handlers.set(type, callback),
      onLeave: vi.fn(), ping: vi.fn(), leave: async () => undefined,
    };
    const ctx = {
      renderer: { draw, setCharacters: vi.fn(), setViewer: vi.fn(), setNames: vi.fn(), setScore: vi.fn(), showBanner: vi.fn() },
      sound: { play: vi.fn(), cues: vi.fn() },
      touch: { sample: () => ({ dir: null, bomb: false }) }, fit: vi.fn(), exit: vi.fn(), specialCooldown,
    } as unknown as ModeContext;
    const panel = { update: vi.fn(), hide: vi.fn(), setWatching: vi.fn() } as unknown as LobbyPanel;
    game = OnlineGame.over(link, ctx, panel);
    handlers.get(S2C.lobby)!({ phase: "playing", members: [{ id: "me", name: "Eu", character: "bomb" }, { id: "bot", name: "Robô", bot: "easy", character: "bomb" }] });
  });

  afterEach(() => {
    game.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function receive(tick: number, botX = 896, cooldown = 0): Snapshot {
    const state = createMatch({ seed: 1, playerIds: ["me", "bot"], blockDensity: 0 });
    state.tick = tick;
    state.players[0]!.specialCooldown = cooldown;
    state.players[1]!.px = botX;
    state.players[1]!.py = TILE + TILE / 2;
    const snap = { ...publicView(state), acks: {} };
    handlers.get(S2C.snapshot)!(snap);
    return snap;
  }

  it("continues recent walking while waiting for the next snapshot", () => {
    receive(60, 864);
    now += 1000 / 30;
    receive(62);
    now += 250;
    game.frame(0, now);
    const [view, prev, alpha] = draw.mock.calls.at(-1)!;
    const bot = view.players.find((p: { id: string }) => p.id === "bot");
    const from = prev.get("bot");
    expect(from.px + (bot.px - from.px) * alpha).toBeGreaterThan(896);
    expect(bot.px).toBeLessThanOrEqual(896 + 15 * 16);
  });

  it("keeps confirmed bombs and lethal flames until the server removes them", () => {
    const snap = receive(60);
    snap.bombs.push({ ownerId: "bot", x: 5, y: 1, fuse: 5, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    snap.flames.push({ x: 3, y: 1, ttl: 8, ownerId: "bot" });
    handlers.get(S2C.snapshot)!(snap);
    for (let i = 0; i < 20; i++) {
      now += 1000 / 60;
      game.frame(1000 / 60, now);
    }
    const [view] = draw.mock.calls.at(-1)!;
    expect(view.bombs).toEqual(snap.bombs);
    expect(view.flames).toEqual(snap.flames);
    now += 1000 / 30;
    receive(80);
    game.frame(0, now);
    const [cleared] = draw.mock.calls.at(-1)!;
    expect(cleared.bombs).toEqual([]);
    expect(cleared.flames).toEqual([]);
  });

  it("softens a small correction after extrapolating without changing the snapshot", () => {
    receive(60, 864);
    now += 1000 / 30;
    receive(62, 896);
    now += 150;
    game.frame(0, now);
    const [before, positions, alpha] = draw.mock.calls.at(-1)!;
    const bot = before.players[1];
    const drawnX = positions.get("bot").px + (bot.px - positions.get("bot").px) * alpha;
    now += 1000 / 30;
    const recovered = receive(72, 928);
    const original = structuredClone(recovered);
    game.frame(0, now);
    const [view, prev, mix] = draw.mock.calls.at(-1)!;
    const afterX = prev.get("bot").px + (view.players[1].px - prev.get("bot").px) * mix;
    expect(Math.abs(afterX - drawnX)).toBeLessThan(16);
    expect(recovered).toEqual(original);
  });

  it("retires a rejected placement as soon as its input is acknowledged", () => {
    const snap = receive(60);
    game.keyDown("Space");
    now += 1000 / 60;
    game.frame(1000 / 60, now);
    game.keyUp("Space");
    expect(draw.mock.calls.at(-1)![0].bombs).toHaveLength(1);
    const sent = send.mock.calls.find(([type]) => type === C2S.input)![1];
    snap.tick = 62;
    snap.acks.me = { seq: sent.seq, ticks: 1 };
    now += 1000 / 30;
    handlers.get(S2C.snapshot)!(snap);
    game.frame(0, now);
    expect(draw.mock.calls.at(-1)![0].bombs).toEqual([]);
  });

  it("reports the connection to the server's log every 5 s of a match, without ?debug (gaps on players' phones)", () => {
    receive(60);
    now += 1000 / 30;
    receive(62);
    vi.advanceTimersByTime(5000);
    const reports = send.mock.calls.filter(([type]) => type === C2S.stats).map(([, m]) => m);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ gap: Math.round(1000 / 30) });
  });

  it("tells the special button how long our special still recharges, and that it is ready once the match is left", () => {
    receive(60, 896, 600);
    now += 1000 / 30;
    receive(62, 896, 598);
    game.frame(0, now);
    expect(specialCooldown.mock.calls.at(-1)![0]).toBeGreaterThan(500);
    now += 1000 / 30;
    receive(64, 896, 0);
    game.frame(0, now);
    expect(specialCooldown).toHaveBeenLastCalledWith(0);
    receive(66, 896, 300);
    game.frame(0, now);
    game.dispose();
    expect(specialCooldown).toHaveBeenLastCalledWith(0);
  });
});
