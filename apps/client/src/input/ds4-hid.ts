import type { PadState } from "./gamepad";

/** A controller as the game reads it: a stable index and its state. */
export interface Pad {
  index: number;
  state: PadState;
}

const SONY = 0x054c;
/** DualShock 4 (first and second models) and Sony's own wireless adapter for it. */
const DS4_PRODUCTS = [0x05c4, 0x09cc, 0x0ba0];
export const DS4_FILTERS = DS4_PRODUCTS.map((productId) => ({ vendorId: SONY, productId }));
/** WebHID pads come after the browser's (which use 0-3). */
const FIRST_INDEX = 100;

/** Hat value (0 = up, clockwise to 7; 8 = released) to the d-pad's standard buttons 12-15 (up, down, left, right). */
const HAT: number[][] = [[12], [12, 15], [15], [13, 15], [13], [13, 14], [14], [12, 14]];

/**
 * A DS4 input report in the Gamepad API's standard mapping. Report 0x01 is USB's, and also Bluetooth's short one
 * (what a DS4 sends until asked for more); 0x11 is Bluetooth's full one, its fields two bytes further in.
 */
export function parseDs4(reportId: number, data: DataView): PadState | null {
  const at = reportId === 0x01 ? 0 : reportId === 0x11 ? 2 : -1;
  if (at < 0 || data.byteLength < at + 7) return null;
  const byte = (i: number) => data.getUint8(at + i);
  const face = byte(4);
  const shoulders = byte(5);
  const hat = HAT[face & 0x0f] ?? [];
  const pressed = [
    face & 0x20, face & 0x40, face & 0x10, face & 0x80, // cross, circle, square, triangle
    ...[0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].map((bit) => shoulders & bit), // L1 R1 L2 R2 share options L3 R3
    ...[12, 13, 14, 15].map((b) => (hat.includes(b) ? 1 : 0)),
    byte(6) & 0x01, // PS
  ];
  const axis = (v: number) => (v - 127.5) / 127.5;
  return {
    buttons: pressed.map((p) => ({ pressed: p !== 0 })),
    axes: [axis(byte(0)), axis(byte(1)), axis(byte(2)), axis(byte(3))],
  };
}

/** A browser pad, with the id that tells a Sony one apart. */
export interface BrowserPad extends Pad {
  id: string;
}

/**
 * Every controller: the browser's, then those read over WebHID. A DS4 read over WebHID is also among the browser's
 * (when it has room, 4 at most), so once WebHID reads any, the browser's Sony pads are left out: none counts twice.
 */
export function mergePads(browser: readonly BrowserPad[], hid: readonly Pad[]): Pad[] {
  const kept = hid.length ? browser.filter((p) => !/vendor: 054c/i.test(p.id)) : browser;
  return [...kept.map(({ index, state }) => ({ index, state })), ...hid];
}

/** What we use of a WebHID device. */
interface HidDeviceLike {
  open(): Promise<void>;
  opened?: boolean;
  addEventListener(type: "inputreport", fn: (e: { reportId: number; data: DataView }) => void): void;
}

/** What we use of navigator.hid. */
export interface HidLike {
  getDevices(): Promise<HidDeviceLike[]>;
  requestDevice(options: { filters: { vendorId: number; productId: number }[] }): Promise<HidDeviceLike[]>;
  addEventListener(type: "connect" | "disconnect", fn: (e: { device: HidDeviceLike }) => void): void;
}

/**
 * DS4 controllers read straight over WebHID, past the Gamepad API's 4 (Chrome keeps only 4). The browser asks once
 * which controllers to allow (`request`, needs a click or key); later visits get them back by themselves (`restore`).
 */
export class HidPads {
  private readonly devices = new Map<HidDeviceLike, { index: number; state: PadState | null }>();

  constructor(private readonly hid: HidLike | null = browserHid()) {
    hid?.addEventListener("connect", (e) => void this.open(e.device));
    hid?.addEventListener("disconnect", (e) => void this.devices.delete(e.device));
  }

  /** WebHID is there (Chrome/Edge on a computer). */
  get supported(): boolean {
    return !!this.hid;
  }

  /** Opens the controllers allowed on an earlier visit. */
  async restore(): Promise<void> {
    if (!this.hid) return;
    await Promise.all((await this.hid.getDevices()).map((d) => this.open(d)));
  }

  /** Asks the player which DS4s to allow (from a click or key press), and opens them. */
  async request(): Promise<number> {
    if (!this.hid) return 0;
    const chosen = await this.hid.requestDevice({ filters: DS4_FILTERS });
    await Promise.all(chosen.map((d) => this.open(d)));
    return this.devices.size;
  }

  /** The open controllers that sent a report, by index. */
  pads(): Pad[] {
    return [...this.devices.values()]
      .flatMap(({ index, state }) => (state ? [{ index, state }] : []))
      .sort((a, b) => a.index - b.index);
  }

  private async open(device: HidDeviceLike): Promise<void> {
    if (this.devices.has(device)) return;
    const taken = new Set([...this.devices.values()].map((d) => d.index));
    let index = FIRST_INDEX;
    while (taken.has(index)) index++;
    const entry = { index, state: null as PadState | null };
    this.devices.set(device, entry);
    try {
      if (!device.opened) await device.open();
    } catch {
      this.devices.delete(device);
      return;
    }
    device.addEventListener("inputreport", (e) => {
      const state = parseDs4(e.reportId, e.data);
      if (state) entry.state = state;
    });
  }
}

function browserHid(): HidLike | null {
  if (typeof navigator === "undefined") return null;
  return ((navigator as unknown as { hid?: HidLike }).hid) ?? null;
}

/** This page's WebHID controllers. */
export const hidPads = new HidPads();

/** Every connected controller, the browser's and WebHID's, in that order. */
export function connectedPads(): Pad[] {
  const browser: BrowserPad[] =
    typeof navigator === "undefined" || !navigator.getGamepads
      ? []
      : navigator.getGamepads().flatMap((p) => (p?.connected ? [{ index: p.index, id: p.id, state: p }] : []));
  return mergePads(browser, hidPads.pads());
}
