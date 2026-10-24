/**
 * Which way an offline (Wi-Fi) match's connection actually runs, read off the WebRTC statistics: straight over the
 * local network (or through its router), or out through the internet and back (a phone on mobile data, or a Wi-Fi that
 * keeps its devices from reaching each other, met through the STUN server's public addresses). The browser hides its own
 * addresses (mDNS), so a pair of the devices' own candidates counts as the Wi-Fi. Shown with ?debug and sent in the reports.
 */
export interface Route {
  via: "wifi" | "internet";
  /** The pair's round trip, ms (when the browser measured it). */
  rtt?: number;
}

type Stat = Record<string, unknown>;

/** Private (RFC 1918), link-local or mDNS-named: an address on the local network. */
function local(address: unknown): boolean {
  if (typeof address !== "string") return false;
  if (address.endsWith(".local")) return true;
  const [a, b] = address.split(".").map(Number);
  if (a === 10 || (a === 192 && b === 168) || (a === 172 && b! >= 16 && b! <= 31) || (a === 169 && b === 254)) return true;
  const v6 = address.toLowerCase();
  return v6.startsWith("fe80:") || v6.startsWith("fd") || v6.startsWith("fc");
}

/**
 * Two public addresses on one network: the same IPv4 address (phones out through one router, which turns their packets
 * straight back) or one IPv6 network (the first 64 bits).
 */
function sameNetwork(x: unknown, y: unknown): boolean {
  if (typeof x !== "string" || typeof y !== "string" || !x || !y) return false;
  if (!x.includes(":")) return x === y;
  // the first four groups, written out before any "::"
  const net = (v: string) => {
    const groups = v.toLowerCase().split("::")[0]!.split(":");
    return groups.length >= 4 ? groups.slice(0, 4).join(":") : null;
  };
  return net(x) !== null && net(x) === net(y);
}

/** The route of a getStats() report's selected candidate pair; null before one is chosen. */
export function routeOf(report: { forEach(cb: (stat: Stat) => void): void }): Route | null {
  const stats = new Map<string, Stat>();
  report.forEach((s) => stats.set(String(s.id), s));
  let pair: Stat | undefined;
  for (const s of stats.values()) if (s.type === "transport" && s.selectedCandidatePairId) pair = stats.get(String(s.selectedCandidatePairId));
  if (!pair) for (const s of stats.values()) if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") pair = s;
  if (!pair) return null;
  const [a, b] = [stats.get(String(pair.localCandidateId)), stats.get(String(pair.remoteCandidateId))];
  const own = (c: Stat | undefined) => !!c && (c.candidateType === "host" || local(c.address));
  const lan = !!a && !!b && a.candidateType !== "relay" && b.candidateType !== "relay" && ((own(a) && own(b)) || sameNetwork(a.address, b.address));
  const rtt = typeof pair.currentRoundTripTime === "number" ? { rtt: Math.round(pair.currentRoundTripTime * 1000) } : {};
  return { via: lan ? "wifi" : "internet", ...rtt };
}

/** The host's view of all its friends: the worst one (any over the internet, then the slowest). */
export function worstRoute(routes: readonly (Route | null)[]): Route | null {
  let worst: Route | null = null;
  for (const r of routes) {
    if (!r) continue;
    if (!worst || (r.via === "internet" && worst.via === "wifi") || (r.via === worst.via && (r.rtt ?? 0) > (worst.rtt ?? 0))) worst = r;
  }
  return worst;
}
