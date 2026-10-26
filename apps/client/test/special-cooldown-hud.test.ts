import { describe, expect, it, vi } from "vitest";
import { createMatch } from "@bombtop/shared";

vi.mock("pixi.js", () => {
  class Container { children: unknown[] = []; visible = true; addChild(child: unknown) { this.children.push(child); } }
  class Text {
    text = ""; style = { fill: 0 }; destroyed = false;
    anchor = { set: vi.fn() }; position = { set: vi.fn() };
    destroy() { this.destroyed = true; }
  }
  return { Container, Text };
});
import { SpecialCooldownHud } from "../src/render/special-cooldown-hud";

describe("special cooldown HUD", () => {
  it("shows each seat's actual timer, ready state and frozen dead state independently", () => {
    const { players } = createMatch({ seed: 1, playerIds: ["a", "b", "c", "d", "e"] });
    players[0]!.specialCooldown = 1500;
    players[1]!.specialCooldown = 1800;
    players[2]!.specialCooldown = 1;
    players[4]!.alive = false;
    const hud = new SpecialCooldownHud();
    hud.update(players, 240, 208);
    const labels = hud.root.children as unknown as { text: string; position: { set: ReturnType<typeof vi.fn> } }[];
    expect(labels.map(label => label.text)).toEqual([
      "J1 · ESPECIAL\n25s", "J2 · ESPECIAL\n30s", "J3 · ESPECIAL\n1s", "J4 · ESPECIAL\nPronto", "J5 · ESPECIAL\nFora",
    ]);
    expect(labels[0]!.position.set).toHaveBeenLastCalledWith(24, 200);
    expect(labels[4]!.position.set).toHaveBeenLastCalledWith(216, 200);
    players[2]!.specialCooldown = 0;
    hud.update(players, 240, 208);
    expect(hud.root.children).toHaveLength(5);
    expect(labels[2]!.text).toContain("Pronto");
  });

  it("preserves seat order for missing players and releases labels when leaving the match", () => {
    const { players } = createMatch({ seed: 1, playerIds: ["a", "b"] });
    const hud = new SpecialCooldownHud(true);
    hud.update([undefined, players[1]], 208, 176);
    const label = hud.root.children[0] as unknown as { text: string; destroyed: boolean };
    expect(label.text).toContain("J2");
    hud.update([], 208, 176);
    expect(hud.root.visible).toBe(false);
    expect(label.destroyed).toBe(true);
  });
});
