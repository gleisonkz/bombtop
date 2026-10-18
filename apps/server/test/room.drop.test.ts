import { describe, expect, it } from "vitest";
import type { Client } from "@colyseus/core";
import { BattleRoom } from "../src/room";

describe("BattleRoom.onDrop", () => {
  it("survives a client that drops before it finished joining (no unhandled rejection)", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    try {
      const room = new BattleRoom();
      Object.assign(room, {
        broadcast: () => {},
        allowReconnection: () => Promise.reject(new Error("not joined")),
      });
      room.onDrop({ sessionId: "x" } as Client);
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
