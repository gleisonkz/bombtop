import type { Replay } from "@bombtop/shared";

/**
 * Sends a round played in this browser (offline or couch play: no server ran it) to the server, which keeps it
 * beside its own (`POST /replay`) to be played back when a bug turns up. Without internet it is simply lost.
 */
export function replayUploader(serverUrl: string, version: string, room: "offline" | "couch", post: typeof fetch = fetch) {
  const url = `${serverUrl.replace(/^ws/, "http").replace(/\/$/, "")}/replay`;
  return (replay: Replay): void => {
    void post(url, { method: "POST", body: JSON.stringify({ room, v: version, replay }) }).catch(() => {});
  };
}
