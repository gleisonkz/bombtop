import { describe, expect, it } from "vitest";
import { routeOf, worstRoute } from "../src/net/rtc-route";

/** A getStats() report: the transport, its selected pair, and the pair's two candidates. */
function report(local: Record<string, unknown>, remote: Record<string, unknown>, rtt?: number): Map<string, Record<string, unknown>> {
  return new Map<string, Record<string, unknown>>([
    ["T1", { id: "T1", type: "transport", selectedCandidatePairId: "P1" }],
    ["P1", { id: "P1", type: "candidate-pair", localCandidateId: "L1", remoteCandidateId: "R1", state: "succeeded", nominated: true, ...(rtt === undefined ? {} : { currentRoundTripTime: rtt }) }],
    ["P2", { id: "P2", type: "candidate-pair", localCandidateId: "L2", remoteCandidateId: "R2", state: "failed" }],
    ["L1", { id: "L1", type: "local-candidate", ...local }],
    ["R1", { id: "R1", type: "remote-candidate", ...remote }],
  ]);
}

describe("routeOf", () => {
  it("phones reaching each other at their Wi-Fi addresses talk straight over the Wi-Fi", () => {
    expect(routeOf(report({ candidateType: "host", address: "192.168.0.12" }, { candidateType: "host", address: "192.168.0.31" }, 0.008))).toEqual({ via: "wifi", rtt: 8 });
    expect(routeOf(report({ candidateType: "prflx", address: "10.0.0.5" }, { candidateType: "host", address: "abc.local" }))).toEqual({ via: "wifi" });
    expect(routeOf(report({ candidateType: "host", address: "172.20.10.2" }, { candidateType: "prflx", address: "172.20.10.3" }))?.via).toBe("wifi");
  });

  it("the browser hides its own addresses (mDNS): a pair of the phones' own candidates is the Wi-Fi", () => {
    expect(routeOf(report({ candidateType: "host", address: "" }, { candidateType: "host", address: "" }))?.via).toBe("wifi");
  });

  it("out through the same router (one public IPv4 address) or within one IPv6 network (/64) it is still the Wi-Fi", () => {
    expect(routeOf(report({ candidateType: "srflx", address: "186.249.156.116" }, { candidateType: "srflx", address: "186.249.156.116" }))?.via).toBe("wifi");
    expect(routeOf(report({ candidateType: "srflx", address: "2804:868:d042:12ec:a82f:74a3:2e79:fa57" }, { candidateType: "srflx", address: "2804:868:d042:12ec:1:2:3:4" }))?.via).toBe("wifi");
    expect(routeOf(report({ candidateType: "srflx", address: "2804:868:d042:12ec::1" }, { candidateType: "srflx", address: "2804:868:aaaa:12ec::2" }))?.via).toBe("internet");
  });

  it("through a public address (a phone on mobile data, a Wi-Fi keeping its devices apart) they talk over the internet", () => {
    expect(routeOf(report({ candidateType: "srflx", address: "177.196.49.194" }, { candidateType: "srflx", address: "189.5.1.20" }, 0.19))).toEqual({ via: "internet", rtt: 190 });
    expect(routeOf(report({ candidateType: "prflx", address: "177.4.4.4" }, { candidateType: "srflx", address: "189.5.1.20" }))?.via).toBe("internet");
    expect(routeOf(report({ candidateType: "relay", address: "10.0.0.1" }, { candidateType: "host", address: "10.0.0.2" }))?.via).toBe("internet");
  });

  it("falls back to the nominated pair without a transport, and says nothing before a pair is chosen", () => {
    const r = report({ candidateType: "host", address: "192.168.1.2" }, { candidateType: "host", address: "192.168.1.3" });
    r.delete("T1");
    expect(routeOf(r)?.via).toBe("wifi");
    expect(routeOf(new Map())).toBeNull();
  });
});

describe("worstRoute", () => {
  it("of several friends, the one over the internet (or the slowest) is what the host reports", () => {
    expect(worstRoute([{ via: "wifi", rtt: 5 }, { via: "internet", rtt: 150 }, { via: "wifi", rtt: 9 }])).toEqual({ via: "internet", rtt: 150 });
    expect(worstRoute([{ via: "wifi", rtt: 5 }, { via: "wifi", rtt: 30 }])).toEqual({ via: "wifi", rtt: 30 });
    expect(worstRoute([null, { via: "wifi" }])).toEqual({ via: "wifi" });
    expect(worstRoute([])).toBeNull();
  });
});
