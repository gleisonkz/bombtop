import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@bombtop/shared";
import { BattleRoom } from "./room";
import { logRoute } from "./client-log";
import { NetLog } from "./net-log";

const port = Number(process.env.PORT ?? 2567);
/** Pages' own events (boots, crashes, script errors), beside the connection reports (deploy/vps/README.md). */
const clientLog = logRoute(new NetLog(process.env.LOG_DIR ?? "logs", undefined, "client"));

const server = defineServer({
  transport: new WebSocketTransport(),
  greet: false,
  rooms: { [ROOM_NAME]: defineRoom(BattleRoom) },
  express: (app) => {
    app.post("/log", (req: Parameters<typeof clientLog>[0], res: Parameters<typeof clientLog>[1]) => void clientLog(req, res));
  },
});

await server.listen(port);
console.log(`[bombtop] server listening on ws://localhost:${port}`);
