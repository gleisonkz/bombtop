import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C2S, createMatch, publicView, S2C, TILE, type Snapshot } from "@bombtop/shared";
import type { ModeContext } from "../src/game/mode";
import type { RoomLink } from "../src/net/room-link";
import type { LobbyPanel } from "../src/ui/lobby";

vi.mock("../src/ui/net-hud", () => ({ debugNet: () => false, NetHud: vi.fn() }));

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

  beforeEach(() => {
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("window", {});
    handlers = new Map();
    draw = vi.fn();
    send = vi.fn();
    const link: RoomLink = {
      sessionId: "me", roomId: "test", reconnectionToken: "",
      send, onMessage: (type, callback) => handlers.set(type, callback),
      onLeave: vi.fn(), ping: vi.fn(), leave: async () => undefined,
    };
    const ctx = {
      renderer: { draw, setCharacters: vi.fn(), showBanner: vi.fn() },
      sound: { play: vi.fn(), cues: vi.fn() },
      touch: { sample: () => ({ dir: null, bomb: false }) }, fit: vi.fn(), exit: vi.fn(),
    } as unknown as ModeContext;
    const panel = { update: vi.fn(), hide: vi.fn() } as unknown as LobbyPanel;
    game = OnlineGame.over(link, ctx, panel);
    handlers.get(S2C.lobby)!({ phase: "playing", members: [{ id: "me", character: "bomb" }, { id: "bot", character: "bomb" }] });
  });

  afterEach(() => {
    game.dispose();
    vi.restoreAllMocks();
  });

  function receive(tick: number, botX = 896): Snapshot {
    const state = createMatch({ seed: 1, playerIds: ["me", "bot"], blockDensity: 0 });
    state.tick = tick;
    state.players[1]!.px = botX;
    state.players[1]!.py = TILE + TILE / 2;
    const snap = { ...publicView(state), acks: {} };
    handlers.get(S2C.snapshot)!(snap);
    return snap;
  }

  it("does not invent bot movement while waiting for the next snapshot", () => {
    receive(60, 864);
    now += 1000 / 30;
    receive(62);
    now += 250;
    game.frame(0, now);
    const [view, prev, alpha] = draw.mock.calls.at(-1)!;
    const bot = view.players.find((p: { id: string }) => p.id === "bot");
    const from = prev.get("bot");
    expect(from.px + (bot.px - from.px) * alpha).toBe(896);
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
});
