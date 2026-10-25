import type { ControlStyle } from "../input/control-style";
import { STICK_RADIUS, TouchInput } from "../input/touch";
import { el } from "./dom";

/** True on phones/tablets (primary pointer is a finger). */
export const isTouchDevice = (): boolean =>
  typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

/** On-screen d-pad (bottom left) or stick (left side), and bomb/action/special buttons (right), feeding a TouchInput. */
export class TouchControls {
  readonly input = new TouchInput();
  private readonly root: HTMLElement;

  private readonly knob = el("div", { class: "knob" });
  private style: ControlStyle = "dpad";

  constructor(parent: HTMLElement) {
    // The d-pad: a fixed cross; the finger steers by where it is on it and can slide from arrow to arrow.
    const arrows = (["up", "right", "down", "left"] as const).map((d) => el("span", { class: `dpad-arrow ${d}` }));
    const dpad = el("div", { class: "dpad" }, arrows);
    const light = (dir: string | null) => arrows.forEach((a) => a.classList.toggle("on", a.classList.contains(dir ?? "-")));
    // The stick: appears wherever the thumb lands on the left side, and trails it.
    const stick = el("div", { class: "stick-zone" }, [dpad, this.knob]);
    stick.addEventListener("pointerdown", (e) => {
      if (this.style === "dpad") {
        if (!dpad.contains(e.target as Node)) return;
        const r = dpad.getBoundingClientRect();
        this.input.padStart(e.pointerId, r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY);
        light(this.input.direction);
      } else {
        this.input.stickStart(e.pointerId, e.clientX, e.clientY);
        this.knob.dataset.pid = String(e.pointerId);
        this.showKnob(e.clientX, e.clientY, 0, 0);
      }
      e.preventDefault();
      try {
        stick.setPointerCapture(e.pointerId); // keep tracking the finger outside the zone
      } catch {
        /* pointer already gone */
      }
    });
    stick.addEventListener("pointermove", (e) => {
      this.input.stickMove(e.pointerId, e.clientX, e.clientY);
      light(this.input.direction);
      const origin = this.input.origin;
      if (this.style !== "stick" || !origin || this.knob.dataset.pid !== String(e.pointerId)) return;
      this.showKnob(origin.x, origin.y, e.clientX - origin.x, e.clientY - origin.y);
    });
    const end = (e: PointerEvent) => {
      this.input.stickEnd(e.pointerId);
      light(null);
      this.knob.hidden = true;
    };
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);

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
        pad("⚡", "special"),
        pad("AÇÃO", "action"),
        pad("💣", "bomb"),
      ]),
    ]);
    this.root.hidden = true;
    this.knob.hidden = true;
    parent.appendChild(this.root);
  }

  /** Switches between the d-pad and the stick (any time, even mid-match). */
  setStyle(style: ControlStyle): void {
    this.style = style;
    this.root.classList.toggle("stick", style === "stick");
    this.input.reset();
    this.knob.hidden = true;
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
