import { describe, expect, it } from "vitest";
import { HidPads, mergePads, parseDs4, type HidLike } from "../src/input/ds4-hid";

/** A DS4 input report's data (the report id is not in it), as WebHID hands it over. */
function report(bytes: number[], length = 64): DataView {
  const a = new Uint8Array(length);
  a.set(bytes);
  return new DataView(a.buffer);
}

/** Sticks centred, hat released (8), nothing pressed. */
const IDLE = [128, 128, 128, 128, 0x08, 0, 0, 0, 0];

const pressed = (s: ReturnType<typeof parseDs4>) => s!.buttons.flatMap((b, i) => (b.pressed ? [i] : []));

describe("parseDs4", () => {
  it("reads nothing pressed with sticks centred", () => {
    const s = parseDs4(0x01, report(IDLE));
    expect(pressed(s)).toEqual([]);
    expect(s!.axes.map((a) => Math.round(a * 10) / 10)).toEqual([0, 0, 0, 0]);
  });

  it("maps the face buttons to the standard layout (cross A, circle B, square X, triangle Y)", () => {
    // bits 4..7 of byte 4: square, cross, circle, triangle
    expect(pressed(parseDs4(0x01, report([128, 128, 128, 128, 0x08 | 0x20])))).toEqual([0]);
    expect(pressed(parseDs4(0x01, report([128, 128, 128, 128, 0x08 | 0x40])))).toEqual([1]);
    expect(pressed(parseDs4(0x01, report([128, 128, 128, 128, 0x08 | 0x10])))).toEqual([2]);
    expect(pressed(parseDs4(0x01, report([128, 128, 128, 128, 0x08 | 0x80])))).toEqual([3]);
  });

  it("maps shoulders, share, options and PS", () => {
    // byte 5: L1 R1 L2 R2 share options L3 R3; byte 6 bit 0: PS
    expect(pressed(parseDs4(0x01, report([128, 128, 128, 128, 0x08, 0xff, 0x01])))).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 16]);
  });

  it("turns the hat into d-pad buttons, diagonals pressing two", () => {
    const hat = (h: number) => pressed(parseDs4(0x01, report([128, 128, 128, 128, h])));
    expect(hat(0)).toEqual([12]);
    expect(hat(2)).toEqual([15]);
    expect(hat(4)).toEqual([13]);
    expect(hat(6)).toEqual([14]);
    expect(hat(1)).toEqual([12, 15]);
    expect(hat(5)).toEqual([13, 14]);
  });

  it("reads the left stick as axes -1..1", () => {
    const s = parseDs4(0x01, report([0, 255, 128, 128, 0x08]));
    expect(s!.axes[0]).toBeCloseTo(-1, 1);
    expect(s!.axes[1]).toBeCloseTo(1, 1);
  });

  it("reads Bluetooth's full report (0x11), two bytes further in", () => {
    const s = parseDs4(0x11, report([0xc0, 0x00, 0, 128, 128, 128, 0x08 | 0x20], 77));
    expect(pressed(s)).toEqual([0]);
    expect(s!.axes[0]).toBeCloseTo(-1, 1);
  });

  it("ignores other reports", () => {
    expect(parseDs4(0x05, report(IDLE))).toBeNull();
  });
});

describe("mergePads", () => {
  const state = { buttons: [], axes: [] };
  it("keeps the browser's pads when no DS4 is read over WebHID", () => {
    const merged = mergePads([{ index: 0, id: "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)", state }], []);
    expect(merged.map((p) => p.index)).toEqual([0]);
  });

  it("drops the browser's Sony pads once WebHID reads them (no pad twice), keeping the rest", () => {
    const merged = mergePads(
      [
        { index: 0, id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)", state },
        { index: 1, id: "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)", state },
      ],
      [{ index: 100, state }, { index: 101, state }],
    );
    expect(merged.map((p) => p.index)).toEqual([0, 100, 101]);
  });
});

/** A fake navigator.hid with devices that can send reports. */
function fakeHid(granted: FakeDevice[] = []) {
  const listeners: Record<string, ((e: { device: FakeDevice }) => void)[]> = {};
  const hid: HidLike & { fire(type: string, device: FakeDevice): void; toGrant: FakeDevice[] } = {
    toGrant: [],
    getDevices: async () => granted,
    requestDevice: async () => {
      granted.push(...hid.toGrant);
      return hid.toGrant;
    },
    addEventListener: (type: string, fn: (e: { device: FakeDevice }) => void) => void (listeners[type] ??= []).push(fn),
    fire: (type, device) => listeners[type]?.forEach((fn) => fn({ device })),
  };
  return hid;
}

class FakeDevice {
  opened = false;
  vendorId = 0x054c;
  productId = 0x09cc;
  private fn: ((e: { reportId: number; data: DataView }) => void) | null = null;
  async open() {
    this.opened = true;
  }
  addEventListener(_: string, fn: (e: { reportId: number; data: DataView }) => void) {
    this.fn = fn;
  }
  send(bytes: number[]) {
    this.fn?.({ reportId: 0x01, data: report(bytes) });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("HidPads", () => {
  it("opens the controllers allowed before and reads their reports", async () => {
    const a = new FakeDevice();
    const pads = new HidPads(fakeHid([a]));
    await pads.restore();
    expect(a.opened).toBe(true);
    expect(pads.pads()).toEqual([]); // nothing read yet
    a.send([128, 128, 128, 128, 0x08 | 0x20]);
    expect(pads.pads().map((p) => [p.index, pressed(p.state)])).toEqual([[100, [0]]]);
  });

  it("asks for more controllers, each with a stable index, freed when it goes away", async () => {
    const hid = fakeHid();
    const pads = new HidPads(hid);
    const [a, b, c] = [new FakeDevice(), new FakeDevice(), new FakeDevice()];
    hid.toGrant = [a, b];
    await pads.request();
    a.send(IDLE);
    b.send(IDLE);
    expect(pads.pads().map((p) => p.index)).toEqual([100, 101]);
    hid.fire("disconnect", a);
    expect(pads.pads().map((p) => p.index)).toEqual([101]);
    hid.fire("connect", c);
    await flush();
    c.send(IDLE);
    expect(pads.pads().map((p) => p.index)).toEqual([100, 101]);
  });
});
