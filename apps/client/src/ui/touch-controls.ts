import { STICK_RADIUS, TouchInput } from "../input/touch";
import { el } from "./dom";

/** True on phones/tablets (primary pointer is a finger). */
export const isTouchDevice = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

/** On-screen joystick (left half) and bomb/action buttons (right), feeding a TouchInput. */
export class TouchControls {
  readonly input = new TouchInput();
  private readonly root: HTMLElement;
  private readonly knob = el("div", { class: "knob" });

  constructor(parent: HTMLElement) {
    const stick = el("div", { class: "stick-zone" }, [this.knob]);
    stick.addEventListener("pointerdown", (e) => {
      this.input.stickStart(e.pointerId, e.clientX, e.clientY);
      this.knob.dataset.pid = String(e.pointerId);
      this.showKnob(e.clientX, e.clientY, 0, 0);
      try {
        stick.setPointerCapture(e.pointerId); // keep tracking the finger outside the zone
      } catch {
        /* pointer already gone */
      }
    });
    stick.addEventListener("pointermove", (e) => {
      this.input.stickMove(e.pointerId, e.clientX, e.clientY);
      const origin = this.input.origin;
      if (!origin || this.knob.dataset.pid !== String(e.pointerId)) return;
      this.showKnob(origin.x, origin.y, e.clientX - origin.x, e.clientY - origin.y);
    });
    const end = (e: PointerEvent) => {
      this.input.stickEnd(e.pointerId);
      this.knob.hidden = true;
    };
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);

    const pad = (label: string, cls: string, onPress: () => void) => {
      const b = el("div", { class: `touch-btn ${cls}`, text: label });
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        onPress();
      });
      return b;
    };

    this.root = el("div", { class: "touch" }, [
      stick,
      el("div", { class: "touch-buttons" }, [
        pad("❄", "special", () => this.input.press("special")),
        pad("AÇÃO", "action", () => this.input.press("action")),
        pad("💣", "bomb", () => this.input.press("bomb")),
      ]),
    ]);
    this.root.hidden = true;
    this.knob.hidden = true;
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible || !isTouchDevice();
    if (this.root.hidden) this.input.reset();
  }

  private showKnob(ox: number, oy: number, dx: number, dy: number): void {
    const len = Math.hypot(dx, dy);
    const k = len > STICK_RADIUS ? STICK_RADIUS / len : 1; // clamp the knob to the ring
    this.knob.style.left = `${ox + dx * k}px`;
    this.knob.style.top = `${oy + dy * k}px`;
    this.knob.hidden = false;
  }
}
