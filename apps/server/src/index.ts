import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@bombtopia/shared";
import { BattleRoom } from "./room";

const port = Number(process.env.PORT ?? 2567);

const server = defineServer({
  transport: new WebSocketTransport(),
  greet: false,
  rooms: { [ROOM_NAME]: defineRoom(BattleRoom) },
});

await server.listen(port);
console.log(`[bombtopia] server listening on ws://localhost:${port}`);
