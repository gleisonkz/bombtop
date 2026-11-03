import { describe, expect, it, vi } from "vitest";
import type { Replay } from "@bombtop/shared";
import { replayUploader } from "../src/net/replay-upload";

describe("replayUploader", () => {
  it("posts a browser round's replay to the server, with the room kind and this build", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const send = replayUploader("wss://bombtop.tech/colyseus/", "f8ff83a", "couch", fetch);
    send({ v: 1, round: 2 } as Replay);
    expect(fetch).toHaveBeenCalledWith("https://bombtop.tech/colyseus/replay", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ room: "couch", v: "f8ff83a", replay: { v: 1, round: 2 } });
  });

  it("never throws when offline", async () => {
    const send = replayUploader("/colyseus", "x", "offline", vi.fn(async () => { throw new Error("no net"); }));
    expect(() => send({ v: 1 } as Replay)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
