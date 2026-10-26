import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StageDragOrder } from "../src/ui/stage-drag-order";

function node(top = 0) {
  const events = new Map<string, (event: PointerEvent) => void>();
  const classes = new Set<string>();
  let captured = false;
  return {
    disabled: false, offsetHeight: 100, style: { transform: "" },
    classList: { add: (s: string) => classes.add(s), remove: (s: string) => classes.delete(s), toggle: (s: string, on: boolean) => on ? classes.add(s) : classes.delete(s) },
    addEventListener: (name: string, callback: (event: PointerEvent) => void) => events.set(name, callback),
    setPointerCapture: () => { captured = true; }, hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; },
    getBoundingClientRect: () => ({ top, bottom: top + 100, height: 100 }),
    emit: (name: string, values: Partial<PointerEvent> = {}) => events.get(name)?.({ pointerId: 1, isPrimary: true, button: 0, clientY: 50, preventDefault: vi.fn(), ...values } as unknown as PointerEvent),
    captured: () => captured,
  };
}

let frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
  frames = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { const id = frames.size + 1; frames.set(id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const rows = [node(0), node(110), node(220)];
  const handle = node();
  const list = { children: rows };
  const scroller = { scrollTop: 0, scrollHeight: 660, clientHeight: 330, getBoundingClientRect: () => ({ top: 0, bottom: 330 }) };
  const drop = vi.fn();
  const drag = new StageDragOrder(list as unknown as HTMLElement, scroller as unknown as HTMLElement, drop);
  drag.bind(handle as unknown as HTMLButtonElement, rows[0] as unknown as HTMLElement, 0);
  return { drag, rows, handle, drop, scroller };
}

describe("stage pointer drag", () => {
  it.each(["mouse", "touch", "pen"])("reorders on %s release after crossing rows", pointerType => {
    const f = fixture();
    f.handle.emit("pointerdown", { pointerType });
    f.handle.emit("pointermove", { pointerType, clientY: 275 });
    expect(f.drop).not.toHaveBeenCalled();
    f.handle.emit("pointerup", { pointerType, clientY: 275 });
    expect(f.drop).toHaveBeenCalledWith(0, 2);
    expect(f.handle.captured()).toBe(false);
    expect(f.rows[0]!.style.transform).toBe("");
  });
  it("ignores taps, secondary fingers and the wrong pointer", () => {
    const f = fixture();
    f.handle.emit("pointerdown", { isPrimary: false });
    expect(f.handle.captured()).toBe(false);
    f.handle.emit("pointerdown");
    f.handle.emit("pointermove", { pointerId: 2, clientY: 280 });
    f.handle.emit("pointerup", { pointerId: 2, clientY: 280 });
    expect(f.handle.captured()).toBe(true);
    f.handle.emit("pointerup", { clientY: 52 });
    expect(f.drop).not.toHaveBeenCalled();
  });
  it("compensates UI zoom while following the pointer", () => {
    const f = fixture();
    f.rows[0]!.getBoundingClientRect = () => ({ top: 0, bottom: 200, height: 200 });
    f.handle.emit("pointerdown");
    f.handle.emit("pointermove", { clientY: 150 });
    expect(f.rows[0]!.style.transform).toBe("translateY(50px)");
    f.drag.cancel();
  });
  it("ignores late capture loss after dropping and never commits twice", () => {
    const f = fixture();
    f.handle.emit("pointerdown");
    f.handle.emit("pointermove", { clientY: 275 });
    f.handle.emit("pointerup", { clientY: 275 });
    f.handle.emit("lostpointercapture");
    f.handle.emit("pointerup", { clientY: 275 });
    expect(f.drop).toHaveBeenCalledOnce();
  });
  it.each(["pointercancel", "lostpointercapture"])("cancels without changing order on %s", event => {
    const f = fixture();
    f.handle.emit("pointerdown");
    f.handle.emit("pointermove", { clientY: 275 });
    f.handle.emit(event);
    expect(f.drop).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(f.rows[0]!.style.transform).toBe("");
  });
  it("scrolls near the edge and cancels safely when the dialog rerenders", () => {
    const f = fixture();
    f.handle.emit("pointerdown");
    f.handle.emit("pointermove", { clientY: 325 });
    const callback = [...frames.values()][0]!;
    callback(16);
    expect(f.scroller.scrollTop).toBeGreaterThan(0);
    f.drag.cancel();
    expect(f.drop).not.toHaveBeenCalled();
    expect(f.handle.captured()).toBe(false);
  });
  it("never extends the scroll range through the translated row", () => {
    const f = fixture();
    f.scroller.scrollHeight = f.scroller.clientHeight;
    f.handle.emit("pointerdown");
    f.handle.emit("pointermove", { clientY: 325 });
    [...frames.values()][0]!(16);
    expect(f.scroller.scrollTop).toBe(0);
    f.drag.cancel();
  });
});
