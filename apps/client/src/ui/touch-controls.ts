import { TouchInput } from "../input/touch";
import { el } from "./dom";

/** True on phones/tablets (primary pointer is a finger). */
export const isTouchDevice = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

/** On-screen d-pad (bottom left) and bomb/action/special buttons (right), feeding a TouchInput. */
export class TouchControls {
  readonly input = new TouchInput();
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    // A fixed d-pad: the finger steers by where it is on the cross and can slide from arrow to arrow.
    const arrows = (["up", "right", "down", "left"] as const).map((d) => el("span", { class: `dpad-arrow ${d}` }));
    const dpad = el("div", { class: "dpad" }, arrows);
    const light = (dir: string | null) => arrows.forEach((a) => a.classList.toggle("on", a.classList.contains(dir ?? "-")));
    const centre = () => {
      const r = dpad.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    dpad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const c = centre();
      this.input.padStart(e.pointerId, c.x, c.y, e.clientX, e.clientY);
      light(this.input.direction);
      try {
        dpad.setPointerCapture(e.pointerId); // keep tracking the finger off the pad
      } catch {
        /* pointer already gone */
      }
    });
    dpad.addEventListener("pointermove", (e) => {
      this.input.stickMove(e.pointerId, e.clientX, e.clientY);
      light(this.input.direction);
    });
    const end = (e: PointerEvent) => {
      this.input.stickEnd(e.pointerId);
      light(null);
    };
    dpad.addEventListener("pointerup", end);
    dpad.addEventListener("pointercancel", end);
    const stick = el("div", { class: "stick-zone" }, [dpad]);

    const pad = (label: string, button: "bomb" | "action" | "special") => {
      const b = el("div", { class: `touch-btn ${button}`, text: label });
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.input.press(button);
        try {
          b.setPointerCapture(e.pointerId); // the lift counts even if the finger slid off the button
        } catch {
          /* pointer already gone */
        }
      });
      const release = () => this.input.release(button);
      b.addEventListener("pointerup", release);
      b.addEventListener("pointercancel", release);
      return b;
    };

    this.root = el("div", { class: "touch" }, [
      stick,
      el("div", { class: "touch-buttons" }, [
        pad("❄", "special"),
        pad("AÇÃO", "action"),
        pad("💣", "bomb"),
      ]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible || !isTouchDevice();
    if (this.root.hidden) this.input.reset();
  }
}
