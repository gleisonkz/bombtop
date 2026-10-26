import { describe, expect, it } from "vitest";
import { KAME_COOLDOWN, SPECIAL_COOLDOWN, TICK_RATE } from "@bombtop/shared";
import { CONTROL_ROWS, SIDE_HUD_MIN, sideHudFits, specialMeter } from "../src/ui/side-hud";

describe("side HUD (computers: keys and the special beside the arena)", () => {
  it("fills the special's bar as it recharges and says when it is ready", () => {
    expect(specialMeter(0, "goku")).toEqual({ fill: 1, ready: true, label: "PRONTO!" });
    expect(specialMeter(KAME_COOLDOWN, "goku")).toEqual({ fill: 0, ready: false, label: "30 s" });
    expect(specialMeter(KAME_COOLDOWN / 2, "goku")).toEqual({ fill: 0.5, ready: false, label: "15 s" });
    expect(specialMeter(TICK_RATE / 2, "thor")).toEqual({ fill: 1 - TICK_RATE / 2 / SPECIAL_COOLDOWN, ready: false, label: "1 s" });
  });

  it("only shows beside the arena on a screen with no touch and room to spare at the sides", () => {
    expect(sideHudFits(SIDE_HUD_MIN, false)).toBe(true);
    expect(sideHudFits(SIDE_HUD_MIN - 1, false)).toBe(false);
    expect(sideHudFits(600, true)).toBe(false); // phones and tablets keep their touch buttons
  });

  it("lists every button with both keyboard layouts", () => {
    expect(CONTROL_ROWS.map((r) => r.what)).toEqual(["Andar", "Bomba", "Ação", "Especial", "Firmar", "Parar chute", "Sair"]);
    expect(CONTROL_ROWS.find((r) => r.what === "Especial")!.keys).toEqual(["E", "Ctrl dir."]);
  });
});
