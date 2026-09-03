import { GameRoom } from "./room.ts";

export { GameRoom };

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/new") {
      return Response.json({ code: newCode() });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const code = (url.searchParams.get("code") ?? "").toUpperCase();
      if (!/^[A-Z2-9]{4}$/.test(code)) {
        return new Response("bad table code", { status: 400 });
      }
      const stub = env.ROOMS.getByName(code);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
