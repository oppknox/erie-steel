const brand = Symbol("brand");
export type PlayerId = string & { readonly [brand]: "player" };
export type CorpId = string & { readonly [brand]: "corp" };
export type HexId = string & { readonly [brand]: "hex" };
export type PrivateId = string & { readonly [brand]: "private" };
export type TileId = string & { readonly [brand]: "tile" };

export const asPlayer = (s: string) => s as PlayerId;
export const asCorp = (s: string) => s as CorpId;
export const asHex = (s: string) => s as HexId;
export const asPrivate = (s: string) => s as PrivateId;
export const asTile = (s: string) => s as TileId;

export type HexKind = "land" | "city" | "offboard" | "water";

export type HexDef = {
  id: HexId;
  q: number;
  r: number;
  kind: HexKind;
  name?: string;
  values: number[];
  slots: number;
};

export type TileDef = {
  id: TileId;
  color: "yellow" | "green";
  city: boolean;
  slots: number;
  connections: [number, number][];
  count: number;
};

export type CorpDef = {
  id: CorpId;
  name: string;
  short: string;
  color: string;
  home: HexId;
};

export type PrivateDef = {
  id: PrivateId;
  name: string;
  face: number;
  income: number;
};

export type Player = {
  id: PlayerId;
  name: string;
  cash: number;
  shares: Partial<Record<CorpId, number>>;
  privates: PrivateId[];
};

export type Corp = {
  id: CorpId;
  president: PlayerId | null;
  floated: boolean;
  par: number | null;
  priceIndex: number;
  treasury: number;
  loans: number;
  trains: string[];
  tokensLeft: number;
  tokens: HexId[];
  sharesIpo: number;
  sharesBank: number;
  laidThisOr: number;
  tokenedThisOr: boolean;
  ranThisOr: boolean;
};

export type PlacedTile = {
  hex: HexId;
  tile: TileId;
  rotation: number;
};

export type TrainType = "2" | "3" | "4" | "5" | "6";

export type TrainPile = Record<TrainType, { price: number; left: number; rusts?: TrainType }>;

export type PhaseKind = "auction" | "stock" | "operating" | "ended";

export type OpStep = "lay" | "token" | "run" | "train";

export type Phase =
  | { kind: "auction"; actor: PlayerId }
  | { kind: "stock"; actor: PlayerId; passes: number }
  | { kind: "operating"; corpId: CorpId; step: OpStep }
  | { kind: "ended"; scores: Record<string, number>; winner: PlayerId };

export type GameState = {
  players: Player[];
  corps: Corp[];
  privatesLeft: PrivateId[];
  tiles: PlacedTile[];
  tileCounts: Partial<Record<TileId, number>>;
  trains: TrainPile;
  bank: number;
  market: number[];
  phase: Phase;
  orSet: number;
  orNumber: number;
  orsPerSet: number;
  log: string[];
};

export type Command =
  | { type: "buyPrivate"; player: PlayerId; privateId: PrivateId }
  | { type: "pass"; player: PlayerId }
  | { type: "startCorp"; player: PlayerId; corpId: CorpId; par: number }
  | { type: "buyShare"; player: PlayerId; corpId: CorpId }
  | { type: "sellShare"; player: PlayerId; corpId: CorpId }
  | { type: "layTile"; player: PlayerId; hex: HexId; tile: TileId; rotation: number }
  | { type: "placeToken"; player: PlayerId; hex: HexId }
  | { type: "skip"; player: PlayerId }
  | { type: "runTrains"; player: PlayerId; withhold: boolean }
  | { type: "buyTrain"; player: PlayerId; train: TrainType }
  | { type: "takeLoan"; player: PlayerId }
  | { type: "payLoan"; player: PlayerId };

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };
