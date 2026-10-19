import { describe, expect, it } from "vitest";
import { SeatMemory } from "../src/net/seat";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    get: (k: string) => data.get(k) ?? null,
    set: (k: string, v: string) => void data.set(k, v),
    remove: (k: string) => void data.delete(k),
  };
}

describe("SeatMemory", () => {
  it("remembers this tab's seat so a reload takes it back", () => {
    const store = memoryStore();
    new SeatMemory(store).remember("abc123", "tok-1");
    expect(new SeatMemory(store).tokenFor("abc123")).toBe("tok-1");
  });

  it("has no seat in other rooms", () => {
    const seats = new SeatMemory(memoryStore());
    seats.remember("abc123", "tok-1");
    expect(seats.tokenFor("zzz999")).toBeNull();
  });

  it("forgets the seat on leaving", () => {
    const seats = new SeatMemory(memoryStore());
    seats.remember("abc123", "tok-1");
    seats.forget();
    expect(seats.tokenFor("abc123")).toBeNull();
  });

  it("ignores a broken record", () => {
    const store = memoryStore();
    store.set("bombtop.seat", "{nope");
    expect(new SeatMemory(store).tokenFor("abc123")).toBeNull();
  });
});
