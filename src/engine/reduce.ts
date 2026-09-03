import {
  CORP_BY_ID,
  CORPS,
  HEX_BY_ID,
  MARKET,
  PARS,
  PRIVATES,
  PRIVATE_BY_ID,
  STARTING_CASH,
  TILE_BY_ID,
  TILES,
} from "./catalog.ts";
import { adjacentHex, bestRun, currentPhaseColor, placedOn, tileExits } from "./track.ts";
import {
  asPlayer,
  type ApplyResult,
  type Command,
  type Corp,
  type CorpId,
  type GameState,
  type HexId,
  type Player,
  type PlayerId,
  type TileId,
  type TrainType,
} from "./types.ts";

const fail = (error: string): ApplyResult => ({ ok: false, error });
const ok = (state: GameState): ApplyResult => ({ ok: true, state });

function playerOf(state: GameState, id: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === id);
}

function corpOf(state: GameState, id: CorpId): Corp | undefined {
  return state.corps.find((c) => c.id === id);
}

function nextPlayer(state: GameState, id: PlayerId): PlayerId {
  const i = state.players.findIndex((p) => p.id === id);
  return state.players[(i + 1) % state.players.length].id;
}

function priceOf(c: Corp): number {
  return MARKET[c.priceIndex] ?? MARKET[0];
}

function sharesOf(p: Player, id: CorpId): number {
  return p.shares[id] ?? 0;
}

function presidentByShares(state: GameState, id: CorpId): Player | undefined {
  let best: Player | undefined;
  let n = 0;
  for (const p of state.players) {
    const s = sharesOf(p, id);
    if (s > n) {
      best = p;
      n = s;
    }
  }
  return n >= 2 ? best : undefined;
}

function log(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 80) state.log.shift();
}

function fromBank(state: GameState, amount: number): number {
  const take = Math.min(Math.max(0, amount), state.bank);
  state.bank -= take;
  return take;
}

function actorIs(state: GameState, id: PlayerId): boolean {
  const ph = state.phase;
  if (ph.kind === "auction" || ph.kind === "stock") return ph.actor === id;
  if (ph.kind === "operating") return corpOf(state, ph.corpId)?.president === id;
  return false;
}

export function createGame(names: string[]): ApplyResult {
  if (names.length < 2 || names.length > 5) return fail("2 to 5 players");
  const cash = STARTING_CASH[names.length];
  if (!cash) return fail("bad player count");
  const players: Player[] = names.map((name, i) => ({
    id: asPlayer(`p${i + 1}`),
    name: name.trim() || `Seat ${i + 1}`,
    cash,
    shares: {},
    privates: [],
  }));
  const state: GameState = {
    players,
    corps: CORPS.map((c) => ({
      id: c.id,
      president: null,
      floated: false,
      par: null,
      priceIndex: 0,
      treasury: 0,
      loans: 0,
      trains: [],
      tokensLeft: 3,
      tokens: [],
      sharesIpo: 5,
      sharesBank: 0,
      laidThisOr: 0,
      tokenedThisOr: false,
      ranThisOr: false,
    })),
    privatesLeft: PRIVATES.map((p) => p.id),
    tiles: [],
    tileCounts: Object.fromEntries(TILES.map((t) => [t.id, t.count])),
    trains: {
      "2": { price: 80, left: 6 },
      "3": { price: 180, left: 4 },
      "4": { price: 300, left: 3, rusts: "2" },
      "5": { price: 450, left: 2 },
      "6": { price: 600, left: 2, rusts: "3" },
    },
    bank: 8000,
    market: MARKET,
    phase: { kind: "auction", actor: players[0].id },
    orSet: 0,
    orNumber: 0,
    orsPerSet: 2,
    log: [`${players.length} operators open the books.`],
  };
  return ok(state);
}

function tileTouchesCorp(
  state: GameState,
  c: Corp,
  hex: HexId,
  tileId: TileId,
  rotation: number,
): boolean {
  if (c.tokens.includes(hex)) return true;
  const exits = tileExits({ hex, tile: tileId, rotation });
  for (const e of exits) {
    const n = adjacentHex(hex, e);
    if (!n) continue;
    if (c.tokens.includes(n)) return true;
    const nt = placedOn(state, n);
    if (nt && tileExits(nt).includes((e + 3) % 6) && corpReachable(state, c, n)) return true;
  }
  return false;
}

function corpReachable(state: GameState, c: Corp, hex: HexId): boolean {
  const seen = new Set<string>();
  const q: HexId[] = [...c.tokens];
  while (q.length) {
    const h = q.pop()!;
    if (seen.has(h)) continue;
    seen.add(h);
    if (h === hex) return true;
    const ht = placedOn(state, h);
    if (!ht && !c.tokens.includes(h)) continue;
    for (let e = 0; e < 6; e++) {
      const n = adjacentHex(h, e);
      if (!n || seen.has(n)) continue;
      const nt = placedOn(state, n);
      if (ht && nt && tileExits(ht).includes(e) && tileExits(nt).includes((e + 3) % 6)) q.push(n);
      if (!ht && c.tokens.includes(h) && nt) q.push(n);
    }
  }
  return seen.has(hex);
}

function maybeFloat(state: GameState, c: Corp) {
  const sold = 5 - c.sharesIpo - c.sharesBank;
  if (c.floated || sold < 3 || !c.par) return;
  c.floated = true;
  const target = c.par * 5;
  if (c.treasury < target) c.treasury += fromBank(state, target - c.treasury);
  log(state, `${c.id} floats. Treasury $${c.treasury}.`);
}

function beginOperating(state: GameState) {
  for (const p of state.players) {
    let income = 0;
    for (const id of p.privates) income += PRIVATE_BY_ID.get(id)?.income ?? 0;
    if (income) {
      p.cash += fromBank(state, income);
      log(state, `${p.name} collects $${income} from charters.`);
    }
  }
  const order = floatedOrder(state);
  state.orSet += 1;
  state.orNumber = 1;
  if (order.length === 0) {
    state.phase = { kind: "stock", actor: state.players[0].id, passes: 0 };
    log(state, "No companies floated. Another stock round.");
    return;
  }
  startCorpTurn(state, order[0].id);
}

function floatedOrder(state: GameState): Corp[] {
  return state.corps
    .filter((c) => c.floated)
    .sort((a, b) => b.priceIndex - a.priceIndex || a.id.localeCompare(b.id));
}

function startCorpTurn(state: GameState, id: CorpId) {
  const c = corpOf(state, id);
  if (!c) return;
  c.laidThisOr = 0;
  c.tokenedThisOr = false;
  c.ranThisOr = false;
  if (c.loans > 0) {
    const interest = c.loans * 5;
    if (c.treasury >= interest) {
      c.treasury -= interest;
      state.bank += interest;
      log(state, `${c.id} pays $${interest} interest.`);
    } else {
      const rest = interest - c.treasury;
      state.bank += c.treasury;
      c.treasury = 0;
      const pres = c.president ? playerOf(state, c.president) : undefined;
      if (pres && pres.cash >= rest) {
        pres.cash -= rest;
        state.bank += rest;
        log(state, `${pres.name} covers $${rest} interest for ${c.id}.`);
      } else log(state, `${c.id} misses interest.`);
    }
  }
  state.phase = { kind: "operating", corpId: id, step: "lay" };
  log(state, `${c.id} operates.`);
}

function rustTrains(state: GameState, rusts: TrainType) {
  for (const c of state.corps) {
    const before = c.trains.length;
    c.trains = c.trains.filter((t) => t !== rusts);
    if (c.trains.length !== before) log(state, `${c.id} rusts its ${rusts}-trains.`);
  }
}

function endGame(state: GameState) {
  const scores: Record<string, number> = {};
  let winner = state.players[0].id;
  let best = -Infinity;
  for (const p of state.players) {
    let total = p.cash;
    for (const id of p.privates) total += PRIVATE_BY_ID.get(id)?.face ?? 0;
    for (const c of state.corps) total += sharesOf(p, c.id) * priceOf(c);
    scores[p.id] = total;
    if (total > best) {
      best = total;
      winner = p.id;
    }
  }
  state.phase = { kind: "ended", scores, winner };
  log(state, `Books close. ${playerOf(state, winner)?.name ?? winner} wins with $${best}.`);
}

function advanceAfterCorp(state: GameState) {
  if (state.phase.kind !== "operating") return;
  const order = floatedOrder(state);
  const idx = order.findIndex((c) => c.id === state.phase.corpId);
  const next = order[idx + 1];
  if (next) {
    startCorpTurn(state, next.id);
    return;
  }
  if (state.orNumber < state.orsPerSet) {
    state.orNumber += 1;
    if (order[0]) startCorpTurn(state, order[0].id);
    return;
  }
  if (state.trains["6"].left <= 1 || state.bank <= 0) {
    endGame(state);
    return;
  }
  state.phase = { kind: "stock", actor: state.players[0].id, passes: 0 };
  log(state, "Stock round.");
}

function buyPrivate(state: GameState, cmd: Extract<Command, { type: "buyPrivate" }>): ApplyResult {
  if (state.phase.kind !== "auction") return fail("not auction");
  if (state.phase.actor !== cmd.player) return fail("not your turn");
  const p = playerOf(state, cmd.player);
  const priv = PRIVATE_BY_ID.get(cmd.privateId);
  if (!p || !priv) return fail("unknown");
  if (!state.privatesLeft.includes(cmd.privateId)) return fail("already sold");
  if (p.cash < priv.face) return fail("not enough cash");
  p.cash -= priv.face;
  state.bank += priv.face;
  p.privates.push(cmd.privateId);
  state.privatesLeft = state.privatesLeft.filter((id) => id !== cmd.privateId);
  log(state, `${p.name} buys ${priv.name} for $${priv.face}.`);
  if (state.privatesLeft.length === 0) {
    state.phase = { kind: "stock", actor: state.players[0].id, passes: 0 };
    log(state, "Stock round 1.");
  } else {
    state.phase = { kind: "auction", actor: nextPlayer(state, cmd.player) };
  }
  return ok(state);
}

function passTurn(state: GameState, cmd: Extract<Command, { type: "pass" }>): ApplyResult {
  const p = playerOf(state, cmd.player);
  if (!p) return fail("unknown player");
  if (state.phase.kind === "auction") {
    if (state.phase.actor !== cmd.player) return fail("not your turn");
    log(state, `${p.name} passes.`);
    const next = nextPlayer(state, cmd.player);
    if (next === state.players[0].id) {
      state.phase = { kind: "stock", actor: state.players[0].id, passes: 0 };
      log(state, "Auction closes. Stock round opens.");
      return ok(state);
    }
    state.phase = { kind: "auction", actor: next };
    return ok(state);
  }
  if (state.phase.kind !== "stock") return fail("cannot pass");
  if (state.phase.actor !== cmd.player) return fail("not your turn");
  const passes = state.phase.passes + 1;
  log(state, `${p.name} passes.`);
  if (passes >= state.players.length) {
    beginOperating(state);
    return ok(state);
  }
  state.phase = { kind: "stock", actor: nextPlayer(state, cmd.player), passes };
  return ok(state);
}

function startCorp(state: GameState, cmd: Extract<Command, { type: "startCorp" }>): ApplyResult {
  if (state.phase.kind !== "stock") return fail("not stock");
  if (state.phase.actor !== cmd.player) return fail("not your turn");
  if (!PARS.includes(cmd.par)) return fail("illegal par");
  const p = playerOf(state, cmd.player);
  const c = corpOf(state, cmd.corpId);
  const def = CORP_BY_ID.get(cmd.corpId);
  if (!p || !c || !def) return fail("unknown");
  if (c.par !== null) return fail("already started");
  const cost = cmd.par * 2;
  if (p.cash < cost) return fail("not enough cash");
  p.cash -= cost;
  c.treasury += cost;
  c.par = cmd.par;
  c.priceIndex = Math.max(0, MARKET.indexOf(cmd.par));
  c.president = p.id;
  c.sharesIpo = 3;
  p.shares[c.id] = 2;
  c.tokens = [def.home];
  c.tokensLeft = 2;
  log(state, `${p.name} takes the ${def.short} presidency at $${cmd.par}.`);
  state.phase = { kind: "stock", actor: nextPlayer(state, cmd.player), passes: 0 };
  return ok(state);
}

function buyShare(state: GameState, cmd: Extract<Command, { type: "buyShare" }>): ApplyResult {
  if (state.phase.kind !== "stock") return fail("not stock");
  if (state.phase.actor !== cmd.player) return fail("not your turn");
  const p = playerOf(state, cmd.player);
  const c = corpOf(state, cmd.corpId);
  if (!p || !c) return fail("unknown");
  if (c.par === null) return fail("not started");
  const price = priceOf(c);
  if (p.cash < price) return fail("not enough cash");
  if (c.sharesIpo > 0) {
    c.sharesIpo -= 1;
    c.treasury += price;
    state.bank = Math.max(0, state.bank);
  } else if (c.sharesBank > 0) c.sharesBank -= 1;
  else return fail("no shares");
  p.cash -= price;
  p.shares[c.id] = sharesOf(p, c.id) + 1;
  const pres = presidentByShares(state, c.id);
  if (pres) c.president = pres.id;
  maybeFloat(state, c);
  log(state, `${p.name} buys ${c.id} for $${price}.`);
  state.phase = { kind: "stock", actor: nextPlayer(state, cmd.player), passes: 0 };
  return ok(state);
}

function sellShare(state: GameState, cmd: Extract<Command, { type: "sellShare" }>): ApplyResult {
  if (state.phase.kind !== "stock") return fail("not stock");
  if (state.phase.actor !== cmd.player) return fail("not your turn");
  const p = playerOf(state, cmd.player);
  const c = corpOf(state, cmd.corpId);
  if (!p || !c) return fail("unknown");
  if (sharesOf(p, c.id) <= 0) return fail("no share");
  if (c.president === p.id && sharesOf(p, c.id) <= 2) return fail("president cert stays");
  const price = priceOf(c);
  p.shares[c.id] = sharesOf(p, c.id) - 1;
  c.sharesBank += 1;
  p.cash += fromBank(state, price);
  c.priceIndex = Math.max(0, c.priceIndex - 1);
  const pres = presidentByShares(state, c.id);
  if (pres) c.president = pres.id;
  log(state, `${p.name} sells ${c.id} at $${price}.`);
  state.phase = { kind: "stock", actor: nextPlayer(state, cmd.player), passes: 0 };
  return ok(state);
}

function layTile(state: GameState, cmd: Extract<Command, { type: "layTile" }>): ApplyResult {
  if (state.phase.kind !== "operating" || state.phase.step !== "lay") return fail("not lay step");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  const maxLays = currentPhaseColor(state) === "green" ? 1 : 2;
  if (c.laidThisOr >= maxLays) return fail("no lays left");
  const hex = HEX_BY_ID.get(cmd.hex);
  const tdef = TILE_BY_ID.get(cmd.tile);
  if (!hex || !tdef) return fail("unknown tile");
  const existing = placedOn(state, cmd.hex);
  if (tdef.color === "green" && currentPhaseColor(state) !== "green") return fail("green not available");
  if (tdef.city && hex.kind !== "city") return fail("city tile on city only");
  if (!tdef.city && hex.kind !== "land") return fail("track tile on land only");
  if (hex.kind === "offboard" || hex.kind === "water") return fail("illegal hex");
  if (!existing && tdef.color !== "yellow") return fail("yellow first");
  if (existing) {
    const old = TILE_BY_ID.get(existing.tile);
    if (!old) return fail("bad tile");
    if (old.color !== "yellow" || tdef.color !== "green") return fail("upgrade yellow to green");
    if (old.city !== tdef.city) return fail("upgrade kind");
  }
  const left = state.tileCounts[cmd.tile] ?? 0;
  if (left <= 0) return fail("tile depleted");
  if (!tileTouchesCorp(state, c, cmd.hex, cmd.tile, cmd.rotation)) return fail("must connect");
  if (existing) state.tiles = state.tiles.filter((t) => t.hex !== cmd.hex);
  state.tiles.push({ hex: cmd.hex, tile: cmd.tile, rotation: cmd.rotation });
  state.tileCounts[cmd.tile] = left - 1;
  c.laidThisOr += 1;
  log(state, `${c.id} lays ${cmd.tile} on ${hex.name ?? cmd.hex}.`);
  return ok(state);
}

function placeToken(state: GameState, cmd: Extract<Command, { type: "placeToken" }>): ApplyResult {
  if (state.phase.kind !== "operating" || state.phase.step !== "token") return fail("not token step");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  if (c.tokenedThisOr) return fail("already tokened");
  if (c.tokensLeft <= 0) return fail("no tokens");
  const hex = HEX_BY_ID.get(cmd.hex);
  if (!hex || hex.kind !== "city") return fail("city only");
  const tile = placedOn(state, cmd.hex);
  if (!tile) return fail("need a station tile");
  const slots = TILE_BY_ID.get(tile.tile)?.slots ?? 1;
  const used = state.corps.filter((x) => x.tokens.includes(cmd.hex)).length;
  if (used >= slots) return fail("city full");
  if (c.tokens.includes(cmd.hex)) return fail("already here");
  if (!corpReachable(state, c, cmd.hex)) return fail("not connected");
  const cost = 40 + (3 - c.tokensLeft) * 20;
  if (c.treasury < cost) return fail("treasury short");
  c.treasury -= cost;
  state.bank += cost;
  c.tokens.push(cmd.hex);
  c.tokensLeft -= 1;
  c.tokenedThisOr = true;
  log(state, `${c.id} tokens ${hex.name} for $${cost}.`);
  return ok(state);
}

function skipStep(state: GameState, cmd: Extract<Command, { type: "skip" }>): ApplyResult {
  if (state.phase.kind !== "operating") return fail("not operating");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  if (state.phase.step === "lay") {
    state.phase = { ...state.phase, step: "token" };
    return ok(state);
  }
  if (state.phase.step === "token") {
    state.phase = { ...state.phase, step: "run" };
    return ok(state);
  }
  if (state.phase.step === "train") {
    if (c.trains.length === 0) return fail("must buy a train");
    advanceAfterCorp(state);
    return ok(state);
  }
  return fail("cannot skip run");
}

function runTrains(state: GameState, cmd: Extract<Command, { type: "runTrains" }>): ApplyResult {
  if (state.phase.kind !== "operating" || state.phase.step !== "run") return fail("not run step");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  const sizes = c.trains.map((t) => Number.parseInt(t, 10) || 2);
  const rev = bestRun(state, c.tokens, sizes).revenue;
  if (cmd.withhold) {
    c.treasury += fromBank(state, rev);
    c.priceIndex = Math.max(0, c.priceIndex - (rev === 0 ? 2 : 1));
    log(state, `${c.id} withholds $${rev}.`);
  } else {
    const per = Math.floor(rev / 5);
    for (const p of state.players) {
      const n = sharesOf(p, c.id);
      if (n) p.cash += fromBank(state, per * n);
    }
    if (c.sharesIpo) c.treasury += fromBank(state, per * c.sharesIpo);
    if (rev > 0) c.priceIndex = Math.min(MARKET.length - 1, c.priceIndex + 1);
    log(state, `${c.id} pays $${per}/share from $${rev}.`);
  }
  c.ranThisOr = true;
  state.phase = { kind: "operating", corpId: c.id, step: "train" };
  if (state.bank <= 0) endGame(state);
  return ok(state);
}

function buyTrain(state: GameState, cmd: Extract<Command, { type: "buyTrain" }>): ApplyResult {
  if (state.phase.kind !== "operating" || state.phase.step !== "train") return fail("not train step");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  const pile = state.trains[cmd.train];
  if (!pile || pile.left <= 0) return fail("sold out");
  if (c.treasury < pile.price) return fail("treasury short");
  c.treasury -= pile.price;
  state.bank += pile.price;
  c.trains.push(cmd.train);
  pile.left -= 1;
  log(state, `${c.id} buys a ${cmd.train}-train for $${pile.price}.`);
  if (cmd.train === "3") state.orsPerSet = 3;
  if (pile.rusts) rustTrains(state, pile.rusts);
  return ok(state);
}

function takeLoan(state: GameState, cmd: Extract<Command, { type: "takeLoan" }>): ApplyResult {
  if (state.phase.kind !== "operating") return fail("not operating");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  if (c.loans >= 5) return fail("loan cap");
  c.loans += 1;
  c.treasury += fromBank(state, 100);
  log(state, `${c.id} takes a $100 loan.`);
  return ok(state);
}

function payLoan(state: GameState, cmd: Extract<Command, { type: "payLoan" }>): ApplyResult {
  if (state.phase.kind !== "operating") return fail("not operating");
  const c = corpOf(state, state.phase.corpId);
  if (!c || c.president !== cmd.player) return fail("not president");
  if (c.loans <= 0) return fail("no loans");
  if (c.treasury < 100) return fail("treasury short");
  c.treasury -= 100;
  state.bank += 100;
  c.loans -= 1;
  log(state, `${c.id} pays off a loan.`);
  return ok(state);
}

export function apply(state: GameState, cmd: Command): ApplyResult {
  if (state.phase.kind === "ended") return fail("game over");
  if (!actorIs(state, cmd.player)) return fail("not your turn");
  const next = structuredClone(state);
  switch (cmd.type) {
    case "buyPrivate":
      return buyPrivate(next, cmd);
    case "pass":
      return passTurn(next, cmd);
    case "startCorp":
      return startCorp(next, cmd);
    case "buyShare":
      return buyShare(next, cmd);
    case "sellShare":
      return sellShare(next, cmd);
    case "layTile":
      return layTile(next, cmd);
    case "placeToken":
      return placeToken(next, cmd);
    case "skip":
      return skipStep(next, cmd);
    case "runTrains":
      return runTrains(next, cmd);
    case "buyTrain":
      return buyTrain(next, cmd);
    case "takeLoan":
      return takeLoan(next, cmd);
    case "payLoan":
      return payLoan(next, cmd);
    default: {
      const _x: never = cmd;
      return fail(`unknown ${_x}`);
    }
  }
}

export { corpReachable, priceOf, sharesOf, tileTouchesCorp };
