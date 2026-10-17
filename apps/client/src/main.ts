import { Application } from "pixi.js";

const app = new Application();
await app.init({ width: 624, height: 528, background: "#1b1b2f" });
document.getElementById("app")!.appendChild(app.canvas);
