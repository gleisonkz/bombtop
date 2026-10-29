import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import auraSheet from "../public/sprites/goku-ssj-aura.json";
import { characterArt, characterMoves, CHARACTER_SHEETS } from "../src/ui/sheet-art";

class PreviewElement extends EventTarget {
  className = "";
  style: Record<string, unknown> & { setProperty: (key: string, value: string) => void; getPropertyValue: (key: string) => string } = {
    setProperty: (key, value) => { this.style[key] = value; },
    getPropertyValue: key => String(this.style[key] ?? ""),
  };
  children: PreviewElement[] = [];
  animation = { startTime: null as number | null, pause: vi.fn(), currentTime: 0 };
  cssAnimation = { animationName: "sheet-play", startTime: 9876 };
  animate = vi.fn(() => this.animation);
  appendChild(child: PreviewElement) { this.children.push(child); return child; }
  setAttribute = vi.fn();
  getAnimations() { return [this.cssAnimation]; }
}

afterEach(() => vi.unstubAllGlobals());

function preview(character: Parameters<typeof characterArt>[0], state: Parameters<typeof characterArt>[2] = "walk") {
  vi.stubGlobal("document", { createElement: () => new PreviewElement() });
  return characterArt(character, null, state) as unknown as PreviewElement;
}

describe("Goku menu aura", () => {
  it("shares the cast background plane rather than painting over neighboring stacking contexts", () => {
    const [aura, sprite] = preview("goku").children;
    expect(Number(aura!.style.zIndex)).toBeLessThan(0);
    expect(Number(sprite!.style.zIndex)).toBeGreaterThan(0);
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    expect(html).toContain(".mascot.sheet.goku:has(> .goku-aura-preview) { isolation: isolate; }");
    expect(html).toContain(".cast .cast-member:has(> .mascot.sheet.goku > .goku-aura-preview),");
    expect(html).toContain(".cast .mascot.sheet.goku:has(> .goku-aura-preview) { isolation: auto; z-index: auto; transform: none; translate: none; rotate: none; scale: none; filter: none; }");
  });

  it("appears behind only the dedicated Goku lobby and victory strip", () => {
    expect(preview("goku").children).toHaveLength(2);
    expect(preview("goku", "win").children).toHaveLength(2);
    const victory = characterMoves(CHARACTER_SHEETS.goku).find(move => move.label === "Vitória")!;
    expect(preview("goku", victory).children).toHaveLength(2);
    expect(preview("goku", "idle").children).toHaveLength(1);
    expect(preview("goku", "dizzy").children).toHaveLength(1);
    const death = characterMoves(CHARACTER_SHEETS.goku).find(move => move.label === "Derrota")!;
    expect(preview("goku", death).children).toHaveLength(1);
    expect(preview("naruto").children).toHaveLength(1);
  });

  it("plays intro at hair rise, loops at full power, releases with reverse and hides at black hair", () => {
    const aura = preview("goku").children[0]!;
    const [frames, options] = aura.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(options).toMatchObject({ duration: 3000, iterations: Infinity });
    expect(frames).toHaveLength(61);
    expect(frames[8]!.opacity).toBe(0);
    expect(frames[9]).toMatchObject({ opacity: 1, backgroundPosition: "0px 0px" });
    expect(frames[17]!.backgroundPosition).toBe("-960px -320px");
    expect(frames[18]!.backgroundPosition).toBe("0px -640px");
    expect(frames[26]!.backgroundPosition).toBe(frames[18]!.backgroundPosition);
    expect(frames[33]!.backgroundPosition).toBe("-960px -320px");
    expect(frames[49]!.backgroundPosition).toBe("0px 0px");
    for (const index of [0, 50, 59, 60]) expect(frames[index]!.opacity).toBe(0);
    expect(frames[9]!.offset).toBe(9 / 60);
    expect(frames.every(frame => frame.easing === "steps(1, end)")).toBe(true);
  });

  it("uses native uniform scaling and the same foot origin and preview scale as the character", () => {
    const [aura, sprite] = preview("goku").children;
    expect(aura!.style["--s"]).toBe(sprite!.style["--s"]);
    expect(aura!.style.transformOrigin).toBe("160px 304px");
    expect(aura!.style.transform).toBe(`scale(calc(var(--s) * ${auraSheet.nativeScaleForA1}))`);
    expect(aura!.style.backgroundImage).toContain(auraSheet.image);
    expect(aura!.style.width).toBe("320px");
    expect(aura!.style.height).toBe("320px");
    expect(aura!.style.left).toContain("--cast-anchor-offset");
  });

  it("copies the CSS startTime after delayed insertion and each CSS restart", () => {
    const [aura, sprite] = preview("goku").children;
    expect(aura!.animation.pause).toHaveBeenCalled();
    expect(aura!.animation.startTime).toBeNull();
    const start = () => sprite!.dispatchEvent(Object.assign(new Event("animationstart"), { animationName: "sheet-play" }));
    start();
    expect(aura!.animation.startTime).toBe(9876);
    sprite!.cssAnimation.startTime = 15000;
    start();
    expect(aura!.animation.startTime).toBe(15000);
    sprite!.dispatchEvent(new Event("animationcancel"));
    expect(aura!.animation.currentTime).toBe(0);
  });
});
