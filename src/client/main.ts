import { CORPS, HEXES, HEX_BY_ID, MARKET, PRIVATES } from "../engine/catalog.ts";
import { actingPlayer, legalCommands, legalLaysAt } from "../engine/legal.ts";
import { apply, createGame } from "../engine/reduce.ts";
import { placedOn, tileExits } from "../engine/track.ts";
import type { Command, GameState, HexId, PlayerId } from "../engine/types.ts";
import { asPlayer } from "../engine/types.ts";
import type { RoomState, Seat } from "../shared.ts";

const SIZE = 42;
const app = document.getElementById("app")!;

const SHORT: Record<string, string> = {
  Cleveland: "Cleveland",
  Akron: "Akron",
  Youngstown: "Youngs.",
  Pittsburgh: "Pgh",
  Erie: "Erie",
  Buffalo: "Buffalo",
  Rochester: "Roch.",
  Albany: "Albany",
  "New York": "N. York",
  Scranton: "Scran.",
  Harrisburg: "Harris.",
  Philadelphia: "Phila.",
  Chicago: "Chicago",
  Wheeling: "Wheeling",
  Boston: "Boston",
};

type Mode =
  | { kind: "landing" }
  | { kind: "practice"; game: GameState; you: PlayerId }
  | { kind: "online"; code: string; seat: Seat | null; room: RoomState; ws: WebSocket; error: string };

let mode: Mode = { kind: "landing" };
let selectedHex: HexId | null = null;
let name = localStorage.getItem("erie-name") ?? "";

function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`);
  }
  return pts.join(" ");
}

function axialPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: SIZE * Math.sqrt(3) * (q + r / 2),
    y: SIZE * 1.5 * r,
  };
}

function mapViewBox(): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const h of HEXES) {
    const { x, y } = axialPixel(h.q, h.r);
    minX = Math.min(minX, x - SIZE);
    maxX = Math.max(maxX, x + SIZE);
    minY = Math.min(minY, y - SIZE);
    maxY = Math.max(maxY, y + SIZE);
  }
  const pad = SIZE * 0.7;
  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
}

function edgePoint(cx: number, cy: number, edge: number): { x: number; y: number } {
  const a1 = (Math.PI / 180) * (60 * edge - 30);
  const a2 = (Math.PI / 180) * (60 * ((edge + 1) % 6) - 30);
  return {
    x: cx + (SIZE * (Math.cos(a1) + Math.cos(a2))) / 2,
    y: cy + (SIZE * (Math.sin(a1) + Math.sin(a2))) / 2,
  };
}

function landFill(q: number, r: number): string {
  const n = Math.abs(q * 17 + r * 31) % 5;
  return ["#3f5c3d", "#456544", "#4a6a42", "#3c5838", "#4e6e45"][n];
}

function cityValue(game: GameState, hex: (typeof HEXES)[number]): number {
  const tile = placedOn(game, hex.id);
  if (!tile) return hex.values[0] ?? 0;
  const green = tile.tile === "14" || tile.tile === "15" || tile.tile === "16";
  return hex.values[green ? 1 : 0] ?? hex.values[0];
}

function renderMap(game: GameState): string {
  const tracks: string[] = [];
  const hexes = HEXES.map((h) => {
    const { x, y } = axialPixel(h.q, h.r);
    const tile = placedOn(game, h.id);
    const sel = selectedHex === h.id ? " selected" : "";
    const fill =
      h.kind === "city" ? "#d7c7a1" : h.kind === "offboard" ? "#3a2c28" : landFill(h.q, h.r);
    if (tile) {
      for (const e of tileExits(tile)) {
        const p = edgePoint(x, y, e);
        tracks.push(
          `<line class="track-glow" x1="${x}" y1="${y}" x2="${p.x}" y2="${p.y}" /><line class="track" x1="${x}" y1="${y}" x2="${p.x}" y2="${p.y}" />`,
        );
      }
    }
    const tokens = game.corps
      .filter((c) => c.tokens.includes(h.id))
      .map((c, i) => {
        const def = CORPS.find((d) => d.id === c.id);
        const dx = (i - 0.3) * 11;
        return `<circle class="token" cx="${x + dx}" cy="${y + 11}" r="6.5" fill="${def?.color ?? "#888"}" />`;
      })
      .join("");
    let label = "";
    if (h.kind === "city" && h.name) {
      const short = SHORT[h.name] ?? h.name;
      const val = cityValue(game, h);
      label = `<text class="city-label" x="${x}" y="${y - 2}">${short}</text>
        <circle cx="${x}" cy="${y + 12}" r="8" fill="#6b2e22" />
        <text class="val" x="${x}" y="${y + 16}">${val}</text>
        <title>${h.name}</title>`;
    } else if (h.kind === "offboard" && h.name) {
      label = `<text class="off-label" x="${x}" y="${y + 3}">${SHORT[h.name] ?? h.name}</text>
        <text class="val" x="${x}" y="${y + 16}">${h.values[0]}</text>
        <title>${h.name}</title>`;
    }
    return `<g class="hex ${h.kind}${sel}" data-hex="${h.id}">
      <polygon class="fill" points="${hexPoints(x, y, SIZE - 1.2)}" fill="${fill}"></polygon>
      <polygon class="shade" points="${hexPoints(x, y, SIZE - 1.2)}" fill="url(#vol)" opacity="0.16"></polygon>
      <polygon class="edge" points="${hexPoints(x, y, SIZE - 1.2)}"></polygon>
      ${label}${tokens}
    </g>`;
  }).join("");
  return `<svg class="map" viewBox="${mapViewBox()}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="vol" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff" />
        <stop offset="100%" stop-color="#000" />
      </linearGradient>
    </defs>
    ${hexes}${tracks}
  </svg>`;
}

function phaseLabel(game: GameState): string {
  const ph = game.phase;
  if (ph.kind === "auction") return "Charter auction";
  if (ph.kind === "stock") return "Stock round";
  if (ph.kind === "operating") return `${ph.corpId} ${ph.step} · OR ${game.orNumber}/${game.orsPerSet}`;
  return "Books closed";
}

function cmdLabel(cmd: Command, game: GameState): string {
  switch (cmd.type) {
    case "buyPrivate": {
      const p = PRIVATES.find((x) => x.id === cmd.privateId);
      return `Buy ${p?.name ?? cmd.privateId} $${p?.face ?? ""}`;
    }
    case "pass":
      return "Pass";
    case "skip":
      return "Done with this step";
    case "startCorp":
      return `Start ${cmd.corpId} at $${cmd.par}`;
    case "buyShare":
      return `Buy ${cmd.corpId}`;
    case "sellShare":
      return `Sell ${cmd.corpId}`;
    case "placeToken": {
      const h = HEX_BY_ID.get(cmd.hex);
      return `Token ${h?.name ?? cmd.hex}`;
    }
    case "runTrains":
      return cmd.withhold ? "Withhold" : "Pay dividends";
    case "buyTrain":
      return `Buy a ${cmd.train}-train $${game.trains[cmd.train].price}`;
    case "takeLoan":
      return "Take $100 loan";
    case "payLoan":
      return "Pay off a loan";
    case "layTile":
      return `Lay ${cmd.tile}`;
    default:
      return cmd.type;
  }
}

function send(cmd: Command) {
  if (mode.kind === "practice") {
    const r = apply(mode.game, cmd);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    mode = { ...mode, game: r.state, you: actingPlayer(r.state) ?? mode.you };
    paint();
    return;
  }
  if (mode.kind === "online") {
    mode.ws.send(JSON.stringify({ op: "cmd", command: cmd }));
  }
}

function sheet(game: GameState, you: PlayerId | null, extra = ""): string {
  const actor = actingPlayer(game);
  const cmds = you ? legalCommands(game, you) : [];
  const visible = cmds.filter((c) => c.type !== "layTile");
  const players = game.players
    .map((p) => {
      const priv = p.privates.map((id) => PRIVATES.find((x) => x.id === id)?.name ?? id).join(", ");
      const turn = actor === p.id ? " turn" : "";
      const mine = you === p.id ? " you" : "";
      return `<div class="seat${turn}${mine}"><span>${p.name}${you === p.id ? " (you)" : ""}</span><span>$${p.cash}${priv ? ` · ${priv}` : ""}</span></div>`;
    })
    .join("");
  const started = game.corps.filter((c) => c.par !== null);
  const corps = started
    .map((c) => {
      const def = CORPS.find((d) => d.id === c.id);
      return `<div class="corp-row"><span class="swatch" style="background:${def?.color}"></span><span>${def?.short} ${c.trains.join(",") || "—"} · ${c.loans}L</span><span>$${c.treasury} @ $${game.market[c.priceIndex]}</span></div>`;
    })
    .join("");
  const chips = CORPS.map((def) => {
    const c = game.corps.find((x) => x.id === def.id);
    const on = c && c.par !== null ? "" : " off";
    return `<span class="chip${on}" style="background:${def.color}" title="${def.name}"></span>`;
  }).join("");
  const prices = new Set(started.map((c) => game.market[c.priceIndex]));
  const ladder = MARKET.map((p) => `<span class="${prices.has(p) ? "on" : ""}">${p}</span>`).join("");
  const trains = (["2", "3", "4", "5", "6"] as const)
    .map((t) => `<span>${t}×${game.trains[t].left}</span>`)
    .join("");
  const actions = visible.map((c, i) => `<button data-cmd="${i}">${cmdLabel(c, game)}</button>`).join("");
  const layHint =
    game.phase.kind === "operating" && game.phase.step === "lay"
      ? `<p class="hint">Click a hex to lay track.</p>`
      : "";
  return `<aside class="sheet">
    <h2>${phaseLabel(game)}</h2>
    ${extra}
    <h3>Bank $${game.bank}</h3>
    <div class="trains">${trains}</div>
    <h3>Market</h3>
    <div class="ladder">${ladder}</div>
    <h3>Operators</h3>
    ${players}
    <h3>Roads</h3>
    <div class="chips">${chips}</div>
    ${corps}
    <h3>Orders</h3>
    <div class="actions">${actions || `<p class="hint">Wait your turn.</p>`}${layHint}</div>
  </aside>`;
}

function paint() {
  if (mode.kind === "landing") {
    app.innerHTML = `<div class="landing"><div class="mast">
      <h1>Erie Steel</h1>
      <p>Auction charters, float companies, and borrow against the next dividend.</p>
      <div class="row"><input id="nm" placeholder="Your name" value="${name}" /><button id="new">Open a table</button></div>
      <div class="row"><input id="code" placeholder="Table code" maxlength="4" /><button id="join">Join</button></div>
      <div class="row"><button class="ghost" id="practice">Practice hotseat</button></div>
    </div></div>`;
    (document.getElementById("nm") as HTMLInputElement).addEventListener("input", (e) => {
      name = (e.target as HTMLInputElement).value;
      localStorage.setItem("erie-name", name);
    });
    document.getElementById("new")!.onclick = openTable;
    document.getElementById("join")!.onclick = () => {
      const code = (document.getElementById("code") as HTMLInputElement).value.trim().toUpperCase();
      if (code) connect(code);
    };
    document.getElementById("practice")!.onclick = startPractice;
    return;
  }

  if (mode.kind === "practice") {
    const g = mode.game;
    app.innerHTML = `<div class="shell">
      <header class="top"><div class="wordmark">Erie Steel</div><div class="bank">Bank $${g.bank}</div><div class="phase">Practice · ${phaseLabel(g)}</div></header>
      <div class="mapwrap">${renderMap(g)}<div class="log">${g.log.slice(-6).map((l) => `<div>${l}</div>`).join("")}</div></div>
      ${sheet(g, mode.you, `<p class="hint">Hotseat. You play every operator.</p>`)}
    </div>`;
    bindMap(g, mode.you);
    bindActions(g, mode.you);
    return;
  }

  const { room, seat, code, error } = mode;
  const g = room.game;
  if (!g) {
    app.innerHTML = `<div class="shell">
      <header class="top"><div class="wordmark">Erie Steel</div><div class="phase">Table ${code}</div></header>
      <div class="mapwrap"></div>
      <aside class="sheet">
        <h2>Table ${code}</h2>
        <p class="hint">Share this code. Two operators start the books.</p>
        <div class="err">${error}</div>
        ${(room.seats || []).map((s) => `<div class="seat">${s.name}</div>`).join("")}
        <div class="actions"><button id="start" ${room.seats.length < 2 ? "disabled" : ""}>Start</button></div>
      </aside>
    </div>`;
    document.getElementById("start")?.addEventListener("click", () => {
      if (mode.kind === "online") mode.ws.send(JSON.stringify({ op: "start" }));
    });
    return;
  }
  app.innerHTML = `<div class="shell">
    <header class="top"><div class="wordmark">Erie Steel</div><div class="bank">Bank $${g.bank}</div><div class="phase">${code} · ${phaseLabel(g)}</div></header>
    <div class="mapwrap">${renderMap(g)}<div class="log">${g.log.slice(-6).map((l) => `<div>${l}</div>`).join("")}</div></div>
    ${sheet(g, seat?.id ?? null, `<div class="err">${error}</div>`)}
  </div>`;
  bindMap(g, seat?.id ?? null);
  bindActions(g, seat?.id ?? null);
}

function bindActions(game: GameState, you: PlayerId | null) {
  if (!you) return;
  const cmds = legalCommands(game, you).filter((c) => c.type !== "layTile");
  app.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number((btn as HTMLElement).dataset.cmd);
      const cmd = cmds[i];
      if (cmd) send(cmd);
    });
  });
}

function bindMap(game: GameState, you: PlayerId | null) {
  app.querySelectorAll("[data-hex]").forEach((el) => {
    el.addEventListener("click", () => {
      const hex = (el as SVGElement).getAttribute("data-hex") as HexId;
      selectedHex = hex;
      if (!you) {
        paint();
        return;
      }
      if (game.phase.kind === "operating" && game.phase.step === "token") {
        send({ type: "placeToken", player: you, hex });
        return;
      }
      if (game.phase.kind === "operating" && game.phase.step === "lay") {
        const opts = legalLaysAt(game, you, hex);
        if (opts.length === 0) {
          paint();
          return;
        }
        const pick = opts[0];
        send({ type: "layTile", player: you, hex, tile: pick.tile, rotation: pick.rotation });
        return;
      }
      paint();
    });
  });
}

function startPractice() {
  const created = createGame([name || "Ada", "Bess", "Cal"]);
  if (!created.ok) return;
  mode = { kind: "practice", game: created.state, you: asPlayer("p1") };
  paint();
}

async function openTable() {
  const res = await fetch("/api/new", { method: "POST" });
  const data = (await res.json()) as { code: string };
  connect(data.code);
}

function connect(code: string) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws?code=${code}`);
  const token = sessionStorage.getItem("erie-token") ?? crypto.randomUUID();
  sessionStorage.setItem("erie-token", token);
  mode = { kind: "online", code, seat: null, room: { seats: [], game: null, history: [] }, ws, error: "" };
  ws.onopen = () => ws.send(JSON.stringify({ op: "hello", name: name || "Operator", token }));
  ws.onmessage = (ev) => {
    if (mode.kind !== "online") return;
    const msg = JSON.parse(ev.data as string) as
      | { op: "state"; room: RoomState }
      | { op: "you"; seat: Seat }
      | { op: "error"; error: string };
    if (msg.op === "state") {
      mode = { ...mode, room: { seats: msg.room.seats as Seat[], game: msg.room.game, history: [] }, error: "" };
    }
    if (msg.op === "you") mode = { ...mode, seat: msg.seat };
    if (msg.op === "error") mode = { ...mode, error: msg.error };
    paint();
  };
  ws.onclose = () => {
    if (mode.kind === "online") {
      mode = { ...mode, error: "disconnected" };
      paint();
    }
  };
  paint();
}

paint();
