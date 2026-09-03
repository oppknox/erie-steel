import {
  asCorp,
  asHex,
  asPlayer,
  asPrivate,
  asTile,
  type Command,
  type TrainType,
} from "./types.ts";

function str(v: unknown, name: string): string {
  if (typeof v !== "string" || v.length === 0) throw new Error(`missing ${name}`);
  return v;
}

function num(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`missing ${name}`);
  return v;
}

const TRAINS = new Set(["2", "3", "4", "5", "6"]);

export function parseCommand(raw: unknown): Command {
  if (!raw || typeof raw !== "object") throw new Error("command must be an object");
  const o = raw as Record<string, unknown>;
  const type = str(o.type, "type");
  const player = asPlayer(str(o.player, "player"));
  switch (type) {
    case "buyPrivate":
      return { type, player, privateId: asPrivate(str(o.privateId, "privateId")) };
    case "pass":
    case "skip":
      return { type, player };
    case "startCorp":
      return { type, player, corpId: asCorp(str(o.corpId, "corpId")), par: num(o.par, "par") };
    case "buyShare":
    case "sellShare":
      return { type, player, corpId: asCorp(str(o.corpId, "corpId")) };
    case "layTile":
      return {
        type,
        player,
        hex: asHex(str(o.hex, "hex")),
        tile: asTile(str(o.tile, "tile")),
        rotation: num(o.rotation, "rotation"),
      };
    case "placeToken":
      return { type, player, hex: asHex(str(o.hex, "hex")) };
    case "runTrains":
      return { type, player, withhold: Boolean(o.withhold) };
    case "buyTrain": {
      const train = str(o.train, "train");
      if (!TRAINS.has(train)) throw new Error("bad train");
      return { type, player, train: train as TrainType };
    }
    case "takeLoan":
    case "payLoan":
      return { type, player };
    default:
      throw new Error(`unknown command ${type}`);
  }
}
