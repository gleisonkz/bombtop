import { describe, expect, it } from "vitest";
import { mascotSvg, PLAYER_COLORS } from "../src/ui/art";
import { lobbySlots, seatClass } from "../src/ui/lobby-slots";

describe("mascotSvg", () => {
  it("draws the mascot in the given body color", () => {
    const svg = mascotSvg({ color: "#e84a4a" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="#e84a4a"');
  });

  it("changes the face with the mood", () => {
    expect(mascotSvg({ mood: "sad" })).not.toBe(mascotSvg({ mood: "happy" }));
    expect(mascotSvg({ mood: "wow" })).not.toBe(mascotSvg({ mood: "wink" }));
  });

  it("only accepts hex colors, so nothing else reaches the markup", () => {
    expect(() => mascotSvg({ color: '"><script>' })).toThrow();
  });

  it("groups the parts the lobby animates: body, eyes, each foot and the spark", () => {
    for (const mood of ["happy", "wow", "sad", "wink"] as const) {
      const svg = mascotSvg({ mood });
      for (const part of ['class="body"', 'class="eyes"', 'class="foot left"', 'class="foot right"', 'class="spark"']) {
        expect(svg, `${mood} ${part}`).toContain(part);
      }
    }
  });

  it("has legs to walk on and pupils that look around", () => {
    for (const mood of ["happy", "wow", "sad", "wink"] as const) {
      const svg = mascotSvg({ mood });
      for (const part of ['class="leg left"', 'class="leg right"', 'class="pupil"']) {
        expect(svg, `${mood} ${part}`).toContain(part);
      }
    }
  });

  it("matches the in-game player colors", () => {
    expect(PLAYER_COLORS).toHaveLength(5);
  });
});

describe("lobbySlots", () => {
  const m = (id: string) => ({ id, name: id, wins: 0, connected: true, character: "bomb" as const });

  it("seats members in join order with their color, then empty seats up to the max", () => {
    const slots = lobbySlots([m("a"), m("b")], 5);
    expect(slots.map((s) => s.member?.id ?? null)).toEqual(["a", "b", null, null, null]);
    expect(slots[1]!.color).toBe(PLAYER_COLORS[1]);
  });

  it("never shows more seats than members when the room is full", () => {
    expect(lobbySlots([m("a"), m("b"), m("c"), m("d"), m("e")], 5).every((s) => s.member)).toBe(true);
  });
});

describe("seatClass", () => {
  const m = { id: "a", name: "a", wins: 0, connected: true, character: "bomb" as const };

  it("marks your own seat and players who dropped", () => {
    expect(seatClass(m, "a")).toBe("seat me");
    expect(seatClass({ ...m, connected: false }, "b")).toBe("seat away");
  });

  it("tags bots with their level so each one moves its own way", () => {
    expect(seatClass({ ...m, bot: "easy" }, "b")).toBe("seat bot easy");
    expect(seatClass({ ...m, bot: "hard" }, "b")).toBe("seat bot hard");
  });
});
