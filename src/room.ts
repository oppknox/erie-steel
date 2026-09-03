import { DurableObject } from "cloudflare:workers";
import { apply, createGame } from "./engine/reduce.ts";
import { parseCommand } from "./engine/parse.ts";
import { asPlayer, type PlayerId } from "./engine/types.ts";
import type { RoomState, Seat } from "./shared.ts";

export type { RoomState, Seat };

type InMsg =
  | { op: "hello"; name: string; token: string }
  | { op: "start" }
  | { op: "cmd"; command: unknown }
  | { op: "undo" };

function emptyRoom(): RoomState {
  return { seats: [], game: null, history: [] };
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomState = emptyRoom();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get<RoomState>("room")) ?? emptyRoom();
    });
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private async persist() {
    await this.ctx.storage.put("room", this.room);
  }

  private publicRoom(): { seats: { id: PlayerId; name: string }[]; game: RoomState["game"] } {
    return {
      seats: this.room.seats.map((s) => ({ id: s.id, name: s.name })),
      game: this.room.game,
    };
  }

  private broadcast() {
    const payload = JSON.stringify({ op: "state", room: this.publicRoom() });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        /* socket already closing */
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ op: "state", room: this.publicRoom() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let parsed: InMsg;
    try {
      parsed = JSON.parse(message) as InMsg;
    } catch {
      ws.send(JSON.stringify({ op: "error", error: "bad json" }));
      return;
    }
    try {
      await this.handle(ws, parsed);
    } catch (err) {
      const error = err instanceof Error ? err.message : "failed";
      ws.send(JSON.stringify({ op: "error", error }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
  }

  private async handle(ws: WebSocket, msg: InMsg) {
    if (msg.op === "hello") {
      const name = msg.name.trim().slice(0, 24) || "Operator";
      const token = msg.token || crypto.randomUUID();
      let seat = this.room.seats.find((s) => s.token === token);
      if (!seat && this.room.game) {
        ws.send(JSON.stringify({ op: "error", error: "table already underway" }));
        return;
      }
      if (!seat) {
        if (this.room.seats.length >= 5) {
          ws.send(JSON.stringify({ op: "error", error: "table full" }));
          return;
        }
        seat = { id: asPlayer(`p${this.room.seats.length + 1}`), name, token };
        this.room.seats.push(seat);
        await this.persist();
      }
      ws.serializeAttachment({ token: seat.token, id: seat.id });
      ws.send(JSON.stringify({ op: "you", seat }));
      this.broadcast();
      return;
    }
    const att = ws.deserializeAttachment() as { token: string; id: PlayerId } | null;
    if (!att) {
      ws.send(JSON.stringify({ op: "error", error: "say hello first" }));
      return;
    }
    if (msg.op === "start") {
      if (this.room.game) return;
      if (this.room.seats.length < 2) throw new Error("need at least two operators");
      const created = createGame(this.room.seats.map((s) => s.name));
      if (!created.ok) throw new Error(created.error);
      this.room.game = created.state;
      this.room.history = [];
      await this.persist();
      this.broadcast();
      return;
    }
    if (msg.op === "undo") {
      const prev = this.room.history.pop();
      if (!prev || !this.room.game) throw new Error("nothing to undo");
      this.room.game = prev;
      await this.persist();
      this.broadcast();
      return;
    }
    if (msg.op === "cmd") {
      if (!this.room.game) throw new Error("game not started");
      const command = parseCommand(msg.command);
      if (command.player !== att.id) throw new Error("not your seat");
      const next = apply(this.room.game, command);
      if (!next.ok) throw new Error(next.error);
      this.room.history.push(this.room.game);
      if (this.room.history.length > 40) this.room.history.shift();
      this.room.game = next.state;
      await this.persist();
      this.broadcast();
    }
  }
}
