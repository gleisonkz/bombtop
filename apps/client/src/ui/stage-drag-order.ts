interface Drag {
  pointer: number;
  from: number;
  target: number;
  handle: HTMLButtonElement;
  row: HTMLElement;
  centers: number[];
  startY: number;
  y: number;
  scrollTop: number;
  active: boolean;
  lastFrame: number | null;
  scale: number;
  maxScroll: number;
}

export class StageDragOrder {
  private drag: Drag | null = null;
  private frame = 0;

  constructor(private readonly list: HTMLElement, private readonly scroller: HTMLElement,
    private readonly drop: (from: number, to: number) => void) {}

  bind(handle: HTMLButtonElement, row: HTMLElement, from: number): void {
    handle.addEventListener("pointerdown", event => this.start(event, handle, row, from));
    handle.addEventListener("pointermove", event => this.move(event));
    handle.addEventListener("pointerup", event => this.finish(event));
    for (const name of ["pointercancel", "lostpointercapture"] as const) {
      handle.addEventListener(name, event => { if (event.pointerId === this.drag?.pointer) this.cancel(); });
    }
  }

  cancel(): void {
    const drag = this.drag;
    this.drag = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (!drag) return;
    drag.row.style.transform = "";
    drag.row.classList.remove("stage-dragging");
    for (const row of this.list.children) row.classList.remove("stage-drop-target");
    if (drag.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer);
  }

  private start(event: PointerEvent, handle: HTMLButtonElement, row: HTMLElement, from: number): void {
    if (this.drag || handle.disabled || event.button !== 0 || !event.isPrimary) return;
    handle.setPointerCapture(event.pointerId);
    const rect = row.getBoundingClientRect();
    this.drag = { pointer: event.pointerId, from, target: from, handle, row,
      centers: [...this.list.children].map(child => { const rect = child.getBoundingClientRect(); return rect.top + rect.height / 2; }),
      startY: event.clientY, y: event.clientY, scrollTop: this.scroller.scrollTop, active: false, lastFrame: null,
      scale: rect.height / (row.offsetHeight || rect.height),
      maxScroll: Math.max(0, this.scroller.scrollHeight - this.scroller.clientHeight) };
    event.preventDefault();
  }

  private move(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    drag.y = event.clientY;
    if (!drag.active && Math.abs(drag.y - drag.startY) < 6) return;
    if (!drag.active) {
      drag.active = true;
      drag.row.classList.add("stage-dragging");
      this.frame = requestAnimationFrame(time => this.scroll(time));
    }
    event.preventDefault();
    this.paint(drag);
  }

  private paint(drag: Drag): void {
    const scroll = this.scroller.scrollTop - drag.scrollTop;
    const offset = drag.y - drag.startY;
    drag.row.style.transform = `translateY(${offset / drag.scale + scroll}px)`;
    const center = drag.centers[drag.from]! + offset;
    let nearest = Infinity;
    drag.centers.forEach((y, index) => {
      const distance = Math.abs(y - scroll * drag.scale - center);
      if (distance < nearest) { nearest = distance; drag.target = index; }
    });
    [...this.list.children].forEach((row, index) => row.classList.toggle("stage-drop-target", index === drag.target && index !== drag.from));
  }

  private scroll(time: number): void {
    const drag = this.drag;
    if (!drag?.active) return;
    const bounds = this.scroller.getBoundingClientRect();
    const elapsed = Math.min(32, drag.lastFrame === null ? 16 : time - drag.lastFrame);
    drag.lastFrame = time;
    const edge = 48;
    const above = Math.min(0, drag.y - bounds.top - edge);
    const below = Math.max(0, drag.y - bounds.bottom + edge);
    const speed = Math.max(-1, Math.min(1, (above + below) / edge));
    this.scroller.scrollTop = Math.max(0, Math.min(drag.maxScroll, this.scroller.scrollTop + speed * elapsed * 0.6 / drag.scale));
    this.paint(drag);
    this.frame = requestAnimationFrame(next => this.scroll(next));
  }

  private finish(event: PointerEvent): void {
    if (event.pointerId !== this.drag?.pointer) return;
    this.move(event);
    const drag = this.drag!;
    this.cancel();
    if (drag.active && drag.target !== drag.from) this.drop(drag.from, drag.target);
  }
}
