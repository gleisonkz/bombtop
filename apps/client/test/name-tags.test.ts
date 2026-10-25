import { describe, expect, it } from "vitest";
import type { LobbyMember } from "@bombtop/shared";
import { nameTags } from "../src/render/name-tags";

const member = (id: string, name: string, bot?: "easy"): LobbyMember => ({ id, name, wins: 0, connected: true, character: "bomb", ...(bot ? { bot } : {}) });

describe("nameTags", () => {
  it("tags the human players over their heads, ours marked; bots go untagged", () => {
    const tags = nameTags([member("a", "Gleison"), member("b", "Mokass"), member("c", "Estopim", "easy")], "a");
    expect(tags).toEqual(
      new Map([
        ["a", { text: "Gleison", me: true }],
        ["b", { text: "Mokass", me: false }],
      ]),
    );
  });

  it("cuts long names short, and a nameless player gets none", () => {
    const tags = nameTags([member("a", "Abcdefghijklmnopq"), member("b", "   ")], null);
    expect(tags.get("a")!.text).toBe("Abcdefghij…");
    expect(tags.has("b")).toBe(false);
  });
});
