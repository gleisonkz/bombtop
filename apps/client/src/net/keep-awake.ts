/**
 * Keeps a phone's Wi-Fi radio awake during a match. A phone that only listens
 * lets its radio doze between the router's beacons, and the snapshots sent
 * every 33 ms then arrive in bursts 150-600 ms apart (seen in the ?debug logs
 * from Android phones, with a 10 ms ping: sending wakes the radio). Sending
 * something every few dozen ms keeps it in its active mode.
 */
export class KeepAwake {
  private last = -Infinity;

  constructor(private readonly everyMs: number) {}

  /** Something went to the server at `now` (an input counts as much as a beat). */
  sent(now: number): void {
    this.last = now;
  }

  /** Whether a beat should go now. */
  due(now: number): boolean {
    return now - this.last >= this.everyMs;
  }
}
