import { describe, expect, it, vi } from "vitest";
import { Assets, Sprite } from "pixi.js";

const art = vi.hoisted(() => ({ source: { scaleMode: "linear" } }));
vi.mock("pixi.js", () => ({
  Assets: { load: vi.fn(async () => art) },
  Container: class { children: unknown[] = []; addChild(sprite: unknown) { this.children.push(sprite); } },
  Rectangle: class { constructor(public x: number, public y: number, public width: number, public height: number) {} },
  Texture: class { constructor(public options: unknown) {} },
  Sprite: class {
    constructor(public texture?: unknown) {}
    anchor = { set: vi.fn() }; position = { set: vi.fn() }; scale = { set: vi.fn() };
    width = 0; height = 0; alpha = 1; visible = true;
  },
}));
import { StunEffects } from "../src/render/stun-effects";

describe("shared overhead stun", () => {
  it("draws only living stunned players after loading", async () => {
    const effects = new StunEffects();
    const pose = { x: 24, headY: 14, remaining: 20, tick: 0, alpha: 1 };
    expect(effects.draw(pose)).toBe(false);
    await effects.load();
    expect(effects.draw({ ...pose, remaining: 0 })).toBe(false);
    expect(effects.draw(pose)).toBe(true);
    const sprite = effects.root.children[0] as Sprite;
    expect(sprite.anchor.set).toHaveBeenCalledWith(0.5, 1);
    expect(sprite.position.set).toHaveBeenCalledWith(24, 17);
    expect(sprite.scale.set).toHaveBeenCalledWith(0.375);
    expect(Assets.load).toHaveBeenCalledWith(expect.stringContaining("stun-effects-pixel-v2.png"));
    expect(art.source.scaleMode).toBe("nearest");
  });

  it("cycles twelve distinct five-tick frames and reuses hidden sprites after recovery", async () => {
    const effects = new StunEffects();
    await effects.load();
    const pose = { x: 12, headY: 30, remaining: 50, tick: 0, alpha: 0.35 };
    effects.draw(pose);
    const sprite = effects.root.children[0] as Sprite;
    const first = sprite.texture;
    expect(sprite.alpha).toBe(0.35);
    effects.beginFrame();
    expect(sprite.visible).toBe(false);
    effects.draw({ ...pose, tick: 5 });
    expect(sprite.texture).not.toBe(first);
    effects.beginFrame();
    effects.draw({ ...pose, tick: 60 });
    expect(sprite.texture).toBe(first);
    expect(effects.root.children).toHaveLength(1);
    effects.beginFrame();
    effects.draw({ ...pose, remaining: 0 });
    expect(sprite.visible).toBe(false);
  });
});
