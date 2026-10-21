import { describe, expect, it } from "vitest";
import { decodeSignal, encodeSignal } from "../src/net/rtc-signal";

const SDP = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:1 1 udp 2113937151 192.168.0.12 54321 typ host generation 0 network-cost 999",
  "a=candidate:2 1 udp 2113939711 7f2c3e5a-1b2c-4d5e-9f00-123456789abc.local 54322 typ host generation 0",
  "a=ice-ufrag:abcd",
  "a=ice-pwd:aaaaaaaaaaaaaaaaaaaaaaaa",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 6B:8B:F0:65:5F:78:E2:51:3B:AC:6F:F3:3F:46:1B:35:DC:B8:5F:64:1A:24:C2:43:F0:A1:58:D0:A1:2C:19:08",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");

describe("rtc signal codes", () => {
  it("round-trip an offer and an answer", async () => {
    for (const type of ["offer", "answer"] as const) {
      const code = await encodeSignal({ type, sdp: SDP });
      expect(await decodeSignal(code)).toEqual({ type, sdp: SDP });
    }
  });

  it("are short, plain text that fits a QR code", async () => {
    const code = await encodeSignal({ type: "offer", sdp: SDP });
    expect(code.length).toBeLessThan(SDP.length);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("reject junk", async () => {
    await expect(decodeSignal("hello")).rejects.toThrow();
    await expect(decodeSignal("")).rejects.toThrow();
  });
});
