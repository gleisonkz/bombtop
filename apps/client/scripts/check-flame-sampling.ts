import { Application, Rectangle, Sprite, Texture } from "pixi.js";
import { loadFlameArt } from "../src/render/flame-art";
import { FLAMES } from "../src/render/sprites";

export async function checkFlameJunctions() {
  const art = await loadFlameArt();
  const edges = [[127, 64], [64, 127], [0, 64], [64, 0]] as const;
  try {
    for (let connections = 0; connections < 16; connections++) {
      for (let frame = 0; frame < FLAMES.frames; frame++) {
        const canvas = art.center[connections]![frame]!.source.resource as HTMLCanvasElement;
        const ctx = canvas.getContext("2d")!;
        edges.forEach(([x, y], direction) => {
          const alpha = ctx.getImageData(x, y, 1, 1).data[3]!;
          const connected = Boolean(connections & (1 << direction));
          if (!connected && alpha > 8) throw new Error(`Square stub: junction ${connections}, frame ${frame}, direction ${direction}`);
          if (connected && alpha < 64) throw new Error(`Missing root: junction ${connections}, frame ${frame}, direction ${direction}`);
        });
      }
    }
    return { configurations: 16 * FLAMES.frames, directionsChecked: 16 * FLAMES.frames * 4, passed: true };
  } finally {
    for (const texture of [...art.center.flat(), ...art.mid.flat(), ...art.end]) texture.destroy(true);
  }
}

export async function checkFlameSampling() {
  const app = new Application();
  await app.init({ width: 512, height: 512, backgroundAlpha: 0, antialias: false });
  const canvas = document.createElement("canvas");
  canvas.width = FLAMES.size * FLAMES.frames;
  canvas.height = FLAMES.size * (FLAMES.rows.end + 1);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(128, 128, 128, 128);
  const art = await loadFlameArt(canvas.toDataURL());
  const base = Texture.from(canvas);
  base.source.scaleMode = "linear";
  const shared = new Texture({ source: base.source, frame: new Rectangle(128, 128, 128, 128) });
  const check = (texture: Texture, rotation: number) => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(64.3, 64.7);
    sprite.scale.set(0.43);
    sprite.rotation = rotation;
    const { pixels } = app.renderer.extract.pixels({ target: sprite, resolution: 4 });
    let contaminated = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]! > 200 && pixels[i + 1]! > 2) contaminated++;
    }
    sprite.destroy();
    return contaminated;
  };
  try {
    const baseline = [0, Math.PI / 2].map(rotation => check(shared, rotation));
    const isolated = [0, Math.PI / 2].map(rotation => check(art.mid[0]![1]!, rotation));
    if (baseline.some(count => count === 0)) throw new Error("Regression fixture did not reproduce atlas bleeding");
    if (isolated.some(count => count !== 0)) throw new Error("Isolated flame frame contains neighbour pixels");
    return { baseline, isolated, passed: true };
  } finally {
    for (const texture of [...art.center.flat(), ...art.mid.flat(), ...art.end]) texture.destroy(true);
    shared.destroy();
    base.destroy(true);
    app.destroy(true, { children: true });
  }
}
