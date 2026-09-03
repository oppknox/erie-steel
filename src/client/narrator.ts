import { CORPS, HEX_BY_ID, PRIVATES } from "../engine/catalog.ts";
import type { Command, GameState } from "../engine/types.ts";

function playerName(game: GameState, id: string): string {
  return game.players.find((p) => p.id === id)?.name ?? id;
}

/** Plain-English play-by-play line for a command. */
export function narrate(game: GameState, cmd: Command): string {
  const who = playerName(game, cmd.player);
  switch (cmd.type) {
    case "buyPrivate": {
      const p = PRIVATES.find((x) => x.id === cmd.privateId);
      return `${who} buys the ${p?.name ?? cmd.privateId} charter for $${p?.face ?? "?"}.`;
    }
    case "pass":
      return `${who} passes.`;
    case "skip":
      return `${who} is done with this operating step.`;
    case "startCorp": {
      const c = CORPS.find((x) => x.id === cmd.corpId);
      return `${who} floats ${c?.short ?? cmd.corpId} at par $${cmd.par}.`;
    }
    case "buyShare": {
      const c = CORPS.find((x) => x.id === cmd.corpId);
      return `${who} buys a share of ${c?.short ?? cmd.corpId}.`;
    }
    case "sellShare": {
      const c = CORPS.find((x) => x.id === cmd.corpId);
      return `${who} sells a share of ${c?.short ?? cmd.corpId}.`;
    }
    case "layTile": {
      const h = HEX_BY_ID.get(cmd.hex);
      return `${who} lays tile ${cmd.tile} on ${h?.name ?? cmd.hex}.`;
    }
    case "placeToken": {
      const h = HEX_BY_ID.get(cmd.hex);
      return `${who} places a station token in ${h?.name ?? cmd.hex}.`;
    }
    case "runTrains":
      return cmd.withhold
        ? `${who} runs trains and withholds earnings in the treasury.`
        : `${who} runs trains and pays dividends to shareholders.`;
    case "buyTrain": {
      const price = game.trains[cmd.train]?.price;
      return `${who} buys a ${cmd.train}-train${price != null ? ` for $${price}` : ""}.`;
    }
    case "takeLoan":
      return `${who}'s company takes a $100 loan from the bank.`;
    case "payLoan":
      return `${who}'s company pays off a $100 loan.`;
    default:
      return `${who} acts (${(cmd as Command).type}).`;
  }
}
