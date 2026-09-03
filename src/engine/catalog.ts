import {
  asCorp,
  asHex,
  asPrivate,
  asTile,
  type CorpDef,
  type HexDef,
  type HexId,
  type PrivateDef,
  type TileDef,
  type TrainPile,
} from "./types.ts";

export const hexId = (q: number, r: number): HexId => asHex(`${q},${r}`);

export const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

const city = (
  q: number,
  r: number,
  name: string,
  values: number[],
  slots = 1,
): HexDef => ({
  id: hexId(q, r),
  q,
  r,
  kind: "city",
  name,
  values,
  slots,
});

const off = (q: number, r: number, name: string, value: number): HexDef => ({
  id: hexId(q, r),
  q,
  r,
  kind: "offboard",
  name,
  values: [value, value, value],
  slots: 0,
});

const land = (q: number, r: number): HexDef => ({
  id: hexId(q, r),
  q,
  r,
  kind: "land",
  values: [0],
  slots: 0,
});

const namedCities: HexDef[] = [
  city(0, 0, "Cleveland", [30, 50, 70], 2),
  city(0, 1, "Akron", [20, 30, 50]),
  city(2, 0, "Youngstown", [20, 40, 60]),
  city(3, 1, "Pittsburgh", [40, 60, 80], 2),
  city(1, -1, "Erie", [20, 40, 50]),
  city(3, -2, "Buffalo", [30, 50, 70], 2),
  city(5, -2, "Rochester", [20, 40, 50]),
  city(7, -3, "Albany", [30, 50, 70]),
  city(8, -2, "New York", [50, 80, 100], 2),
  city(6, -1, "Scranton", [20, 30, 50]),
  city(5, 1, "Harrisburg", [20, 40, 60]),
  city(7, 1, "Philadelphia", [40, 70, 90], 2),
  off(-3, 0, "Chicago", 40),
  off(3, 3, "Wheeling", 20),
  off(10, -3, "Boston", 30),
];

const citySet = new Set(namedCities.map((h) => h.id));
const lands: HexDef[] = [];
for (let q = -2; q <= 9; q++) {
  for (let r = -3; r <= 3; r++) {
    const id = hexId(q, r);
    if (citySet.has(id)) continue;
    if (r <= -3 && q < 6) continue;
    if (r >= 3 && q < 2) continue;
    if (q + r < -3) continue;
    if (q + r > 10) continue;
    lands.push(land(q, r));
  }
}

export const HEXES: HexDef[] = [...namedCities, ...lands];
export const HEX_BY_ID = new Map(HEXES.map((h) => [h.id, h]));

export const CORPS: CorpDef[] = [
  { id: asCorp("ICC"), name: "Iron City Central", short: "ICC", color: "#8c3b2a", home: hexId(3, 1) },
  { id: asCorp("AO"), name: "Allegheny & Ohio", short: "A&O", color: "#2c4a6e", home: hexId(0, 0) },
  { id: asCorp("LSL"), name: "Lake Shore Line", short: "LSL", color: "#1f6b4a", home: hexId(3, -2) },
  { id: asCorp("MV"), name: "Mohawk Valley", short: "MV", color: "#6b3fa0", home: hexId(7, -3) },
  { id: asCorp("HR"), name: "Hudson River", short: "HR", color: "#1a3d7c", home: hexId(8, -2) },
  { id: asCorp("KEY"), name: "Keystone", short: "KEY", color: "#b8893e", home: hexId(7, 1) },
  { id: asCorp("CW"), name: "Cuyahoga Works", short: "CW", color: "#c45c26", home: hexId(0, 1) },
  { id: asCorp("NG"), name: "Niagara Gauge", short: "NG", color: "#3d5c54", home: hexId(1, -1) },
];

export const CORP_BY_ID = new Map(CORPS.map((c) => [c.id, c]));

export const PRIVATES: PrivateDef[] = [
  { id: asPrivate("dock"), name: "Coal Dock", face: 20, income: 5 },
  { id: asPrivate("canal"), name: "Canal Rights", face: 40, income: 10 },
  { id: asPrivate("bridge"), name: "Bridge Charter", face: 60, income: 10 },
  { id: asPrivate("mill"), name: "Steel Mill", face: 80, income: 15 },
  { id: asPrivate("port"), name: "Port Authority", face: 100, income: 20 },
];

export const PRIVATE_BY_ID = new Map(PRIVATES.map((p) => [p.id, p]));

export const TILES: TileDef[] = [
  { id: asTile("7"), color: "yellow", city: false, slots: 0, connections: [[0, 1]], count: 12 },
  { id: asTile("8"), color: "yellow", city: false, slots: 0, connections: [[0, 2]], count: 12 },
  { id: asTile("9"), color: "yellow", city: false, slots: 0, connections: [[0, 3]], count: 12 },
  { id: asTile("5"), color: "yellow", city: true, slots: 1, connections: [[0, 1]], count: 8 },
  { id: asTile("6"), color: "yellow", city: true, slots: 1, connections: [[0, 2]], count: 8 },
  { id: asTile("57"), color: "yellow", city: true, slots: 1, connections: [[0, 3]], count: 8 },
  { id: asTile("18"), color: "green", city: false, slots: 0, connections: [[0, 3], [1, 4]], count: 8 },
  { id: asTile("19"), color: "green", city: false, slots: 0, connections: [[0, 2], [3, 5]], count: 8 },
  { id: asTile("23"), color: "green", city: false, slots: 0, connections: [[0, 3], [0, 2]], count: 8 },
  { id: asTile("14"), color: "green", city: true, slots: 2, connections: [[0, 2], [2, 3]], count: 6 },
  { id: asTile("15"), color: "green", city: true, slots: 2, connections: [[0, 1], [1, 3]], count: 6 },
  { id: asTile("16"), color: "green", city: true, slots: 2, connections: [[0, 3], [1, 4]], count: 6 },
];

export const TILE_BY_ID = new Map(TILES.map((t) => [t.id, t]));

export const MARKET = [60, 70, 80, 90, 100, 110, 125, 140, 160, 180, 200, 225, 250, 275, 300];

export const PARS = [70, 80, 90, 100, 110];

export const STARTING_CASH: Record<number, number> = {
  2: 420,
  3: 320,
  4: 270,
  5: 230,
};

export function initialTrains(): TrainPile {
  return {
    "2": { price: 80, left: 6, rusts: undefined },
    "3": { price: 180, left: 4 },
    "4": { price: 300, left: 3, rusts: "2" },
    "5": { price: 450, left: 2 },
    "6": { price: 600, left: 2, rusts: "3" },
  };
}

export function neighbor(q: number, r: number, edge: number): { q: number; r: number } {
  const [dq, dr] = DIRS[(edge + 6) % 6];
  return { q: q + dq, r: r + dr };
}

export function parseHex(id: HexId): { q: number; r: number } {
  const [q, r] = id.split(",").map(Number);
  return { q, r };
}
