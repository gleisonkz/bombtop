import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@bombtop/shared";
import { BattleRoom } from "./room";
import { logRoute } from "./client-log";
import { LanDirectory, lanRoute } from "./lan";
import { NetLog, offlineNetRoute } from "./net-log";

const port = Number(process.env.PORT ?? 2567);
/** Pages' own events (boots, crashes, script errors), beside the connection reports (deploy/vps/README.md). */
const clientLog = logRoute(new NetLog(process.env.LOG_DIR ?? "logs", undefined, "client"));

/** Offline (Wi-Fi) rooms: listed and paired through here, played phone to phone (lan.ts). */
const lan = lanRoute(new LanDirectory());
/** Offline (Wi-Fi) matches' connection reports, beside the online ones (net-<date>.jsonl). */
const offlineNet = offlineNetRoute(new NetLog(process.env.LOG_DIR ?? "logs"));

const server = defineServer({
  transport: new WebSocketTransport(),
  greet: false,
  rooms: { [ROOM_NAME]: defineRoom(BattleRoom) },
  express: (app) => {
    app.post("/log", (req: Parameters<typeof clientLog>[0], res: Parameters<typeof clientLog>[1]) => void clientLog(req, res));
    app.post("/net", (req: Parameters<typeof offlineNet>[0], res: Parameters<typeof offlineNet>[1]) => void offlineNet(req, res));
    app.post("/lan/:op", (req: Parameters<typeof lan>[0], res: Parameters<typeof lan>[1]) => void lan(req, res));
  },
});

await server.listen(port);
console.log(`[bombtop] server listening on ws://localhost:${port}`);
