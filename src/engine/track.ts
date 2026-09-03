import { HEX_BY_ID, neighbor, parseHex, TILE_BY_ID } from "./catalog.ts";
import type { GameState, HexId, PlacedTile } from "./types.ts";

export function rotatedEdge(edge: number, rotation: number): number {
  return (edge + rotation + 6) % 6;
}

export function tileExits(placed: PlacedTile): number[] {
  const def = TILE_BY_ID.get(placed.tile);
  if (!def) return [];
  const edges = new Set<number>();
  for (const [a, b] of def.connections) {
    edges.add(rotatedEdge(a, placed.rotation));
    edges.add(rotatedEdge(b, placed.rotation));
  }
  return [...edges];
}

export function connectsOnEdge(placed: PlacedTile, edge: number): boolean {
  return tileExits(placed).includes(edge);
}

export function placedOn(state: GameState, hex: HexId): PlacedTile | undefined {
  return state.tiles.find((t) => t.hex === hex);
}

export function adjacentHex(hex: HexId, edge: number): HexId | null {
  const { q, r } = parseHex(hex);
  const n = neighbor(q, r, edge);
  const id = `${n.q},${n.r}` as HexId;
  return HEX_BY_ID.has(id) ? id : null;
}

export function trackNeighbors(state: GameState, hex: HexId): HexId[] {
  const tile = placedOn(state, hex);
  const def = HEX_BY_ID.get(hex);
  if (!tile) {
    if (def?.kind === "offboard") {
      const out: HexId[] = [];
      for (let e = 0; e < 6; e++) {
        const n = adjacentHex(hex, e);
        if (!n) continue;
        const nt = placedOn(state, n);
        if (nt && connectsOnEdge(nt, (e + 3) % 6)) out.push(n);
      }
      return out;
    }
    return [];
  }
  const out: HexId[] = [];
  for (const e of tileExits(tile)) {
    const n = adjacentHex(hex, e);
    if (!n) continue;
    const nd = HEX_BY_ID.get(n);
    if (nd?.kind === "offboard") {
      out.push(n);
      continue;
    }
    const nt = placedOn(state, n);
    if (nt && connectsOnEdge(nt, (e + 3) % 6)) out.push(n);
  }
  return out;
}

export function cityValue(state: GameState, hex: HexId): number {
  const def = HEX_BY_ID.get(hex);
  if (!def) return 0;
  if (def.kind === "offboard") return def.values[0] ?? 0;
  if (def.kind !== "city") return 0;
  const tile = placedOn(state, hex);
  if (!tile) return 0;
  const tdef = TILE_BY_ID.get(tile.tile);
  const idx = tdef?.color === "green" ? 1 : 0;
  return def.values[idx] ?? def.values[0] ?? 0;
}

export function isStation(state: GameState, hex: HexId): boolean {
  const def = HEX_BY_ID.get(hex);
  if (!def) return false;
  if (def.kind === "offboard") return true;
  if (def.kind !== "city") return false;
  return Boolean(placedOn(state, hex));
}

type Path = { hexes: HexId[]; stations: HexId[]; revenue: number };

function enumerateRoutes(state: GameState, start: HexId, maxStations: number): Path[] {
  const found: Path[] = [];
  const walk = (hex: HexId, used: Set<string>, stations: HexId[]) => {
    if (stations.length >= 2) {
      found.push({
        hexes: [...used] as HexId[],
        stations: [...stations],
        revenue: stations.reduce((s, h) => s + cityValue(state, h), 0),
      });
    }
    if (stations.length >= maxStations) return;
    for (const n of trackNeighbors(state, hex)) {
      if (used.has(n)) continue;
      const nextUsed = new Set(used);
      nextUsed.add(n);
      const nextStations = isStation(state, n) ? [...stations, n] : stations;
      if (isStation(state, n) && stations.includes(n)) continue;
      walk(n, nextUsed, nextStations);
    }
  };
  const used = new Set<string>([start]);
  const stations = isStation(state, start) ? [start] : [];
  walk(start, used, stations);
  return found;
}

export function bestRun(
  state: GameState,
  tokens: HexId[],
  trainSizes: number[],
): { revenue: number; routes: Path[] } {
  const sizes = [...trainSizes].sort((a, b) => b - a);
  const blocked = new Set<string>();
  const routes: Path[] = [];
  let revenue = 0;
  for (const size of sizes) {
    let best: Path | null = null;
    for (const token of tokens) {
      const options = enumerateRoutes(state, token, size).filter((p) => {
        if (p.stations.length < 2) return false;
        if (p.stations.length > size) return false;
        return p.hexes.every((h) => !blocked.has(h) || h === token);
      });
      for (const p of options) {
        if (!best || p.revenue > best.revenue) best = p;
      }
    }
    if (!best) continue;
    routes.push(best);
    revenue += best.revenue;
    for (const h of best.hexes) blocked.add(h);
  }
  return { revenue, routes };
}

export function greenAvailable(state: GameState): boolean {
  return state.trains["2"].left < 6 || Object.values(state.trains).some((t) => t.left < (t.price === 80 ? 6 : t.price === 180 ? 4 : 99) && t.price >= 180);
}

export function currentPhaseColor(state: GameState): "yellow" | "green" {
  const sold3 = state.trains["3"].left < 4;
  return sold3 ? "green" : "yellow";
}
