const base = process.argv[2] ?? "https://erie-steel.catnip-lightning.workers.dev";
const code = (await (await fetch(`${base}/api/new`, { method: "POST" })).json()).code;

function connect(name, token) {
  const ws = new WebSocket(`${base.replace("https", "wss")}/ws?code=${code}`);
  const events = [];
  let seat = null;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => ws.send(JSON.stringify({ op: "hello", name, token })));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      events.push(msg);
      if (msg.op === "you") {
        seat = msg.seat;
        resolve(msg);
      }
    });
    ws.addEventListener("error", reject);
    setTimeout(() => reject(new Error("timeout")), 8000);
  });
  return { ws, events, ready, getSeat: () => seat };
}

const a = connect("Ada", "ta");
const b = connect("Bess", "tb");
await Promise.all([a.ready, b.ready]);
a.ws.send(JSON.stringify({ op: "start" }));
await new Promise((r) => setTimeout(r, 600));
const started = [...a.events].reverse().find((m) => m.op === "state" && m.room.game);
if (!started) throw new Error("game did not start");
const actor = started.room.game.phase.actor;
const mover = a.getSeat().id === actor ? a : b;
mover.ws.send(JSON.stringify({ op: "cmd", command: { type: "buyPrivate", player: actor, privateId: "dock" } }));
await new Promise((r) => setTimeout(r, 600));
const after = [...a.events].reverse().find((m) => m.op === "state" && m.room.game);
const buyer = after.room.game.players.find((p) => p.id === actor);
if (!buyer.privates.includes("dock")) throw new Error("dock not bought");
if (JSON.stringify(after.room.seats).includes("token")) throw new Error("seat tokens leaked");
console.log(`ok ${code} ${buyer.name} ${buyer.cash}`);
a.ws.close();
b.ws.close();
