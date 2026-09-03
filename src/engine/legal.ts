import { CORPS, HEXES, PARS, TILES } from "./catalog.ts";
import { currentPhaseColor, placedOn } from "./track.ts";
import { corpReachable, tileTouchesCorp } from "./reduce.ts";
import type { Command, GameState, HexId, PlayerId, TileId } from "./types.ts";

export function actingPlayer(state: GameState): PlayerId | null {
  const ph = state.phase;
  if (ph.kind === "auction" || ph.kind === "stock") return ph.actor;
  if (ph.kind === "operating") return state.corps.find((c) => c.id === ph.corpId)?.president ?? null;
  return null;
}

export function legalLaysAt(
  state: GameState,
  actor: PlayerId,
  hex: HexId,
): { tile: TileId; rotation: number }[] {
  const ph = state.phase;
  if (ph.kind !== "operating" || ph.step !== "lay") return [];
  const c = state.corps.find((x) => x.id === ph.corpId);
  if (!c || c.president !== actor) return [];
  const hexDef = HEXES.find((h) => h.id === hex);
  if (!hexDef) return [];
  const color = currentPhaseColor(state);
  const existing = placedOn(state, hex);
  const out: { tile: TileId; rotation: number }[] = [];
  for (const tile of TILES) {
    if (color === "yellow" && tile.color !== "yellow") continue;
    if (!existing && tile.color !== "yellow") continue;
    if (existing && tile.color !== "green") continue;
    if (tile.city && hexDef.kind !== "city") continue;
    if (!tile.city && hexDef.kind !== "land") continue;
    for (let rot = 0; rot < 6; rot++) {
      if (tileTouchesCorp(state, c, hex, tile.id, rot)) out.push({ tile: tile.id, rotation: rot });
    }
  }
  return out;
}

export function legalCommands(state: GameState, actor: PlayerId): Command[] {
  const ph = state.phase;
  const out: Command[] = [];
  if (ph.kind === "ended") return out;
  if (ph.kind === "auction") {
    if (ph.actor !== actor) return out;
    for (const id of state.privatesLeft) out.push({ type: "buyPrivate", player: actor, privateId: id });
    out.push({ type: "pass", player: actor });
    return out;
  }
  if (ph.kind === "stock") {
    if (ph.actor !== actor) return out;
    const p = state.players.find((x) => x.id === actor);
    if (!p) return out;
    for (const def of CORPS) {
      const c = state.corps.find((x) => x.id === def.id);
      if (!c) continue;
      if (c.par === null) {
        for (const par of PARS) {
          if (p.cash >= par * 2) out.push({ type: "startCorp", player: actor, corpId: c.id, par });
        }
      } else if (c.sharesIpo + c.sharesBank > 0) {
        const price = state.market[c.priceIndex] ?? 0;
        if (p.cash >= price) out.push({ type: "buyShare", player: actor, corpId: c.id });
      }
      const held = p.shares[c.id] ?? 0;
      if (held > 0 && !(c.president === actor && held <= 2)) {
        out.push({ type: "sellShare", player: actor, corpId: c.id });
      }
    }
    out.push({ type: "pass", player: actor });
    return out;
  }
  const c = state.corps.find((x) => x.id === ph.corpId);
  if (!c || c.president !== actor) return out;
  if (c.loans < 5) out.push({ type: "takeLoan", player: actor });
  if (c.loans > 0 && c.treasury >= 100) out.push({ type: "payLoan", player: actor });
  if (ph.step === "lay" || ph.step === "token") out.push({ type: "skip", player: actor });
  if (ph.step === "token") {
    for (const hex of HEXES) {
      if (hex.kind !== "city") continue;
      if (c.tokens.includes(hex.id)) continue;
      if (!placedOn(state, hex.id)) continue;
      if (corpReachable(state, c, hex.id)) out.push({ type: "placeToken", player: actor, hex: hex.id });
    }
  }
  if (ph.step === "run") {
    out.push({ type: "runTrains", player: actor, withhold: false });
    out.push({ type: "runTrains", player: actor, withhold: true });
  }
  if (ph.step === "train") {
    for (const train of ["2", "3", "4", "5", "6"] as const) {
      const pile = state.trains[train];
      if (pile.left > 0 && c.treasury >= pile.price) out.push({ type: "buyTrain", player: actor, train });
    }
    if (c.trains.length > 0) out.push({ type: "skip", player: actor });
  }
  return out;
}
