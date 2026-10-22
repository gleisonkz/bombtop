import { FreezeWatch, type FreezeEvent } from "./freeze-watch";

/** From the page: where to report and what it is, its beats, and when it goes to the background. */
type Message =
  | { type: "init"; url: string; page: Record<string, string | number> }
  | { type: "beat"; crumb: string; path: string }
  | { type: "away" };

const watch = new FreezeWatch();
let report: ((event: FreezeEvent) => void) | null = null;

const tell = (event: FreezeEvent | null): void => {
  if (event) report?.(event);
};

self.onmessage = (e: MessageEvent<Message>) => {
  const m = e.data;
  if (m.type === "init") {
    // No sendBeacon in a worker; plain text keeps it free of a CORS preflight, as on the page.
    report = (event) => void fetch(m.url, { method: "POST", body: JSON.stringify({ ...event, ...m.page }), mode: "no-cors" }).catch(() => {});
  } else if (m.type === "beat") tell(watch.beat(Date.now(), m.crumb, m.path));
  else watch.away();
};

setInterval(() => tell(watch.check(Date.now())), 1000);
