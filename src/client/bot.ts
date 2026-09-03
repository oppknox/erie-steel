import { CORPS, HEXES, PRIVATES } from "../engine/catalog.ts";
import { actingPlayer, legalCommands, legalLaysAt } from "../engine/legal.ts";
import type { Command, GameState, PlayerId } from "../engine/types.ts";

/** Prefer cheaper / safer moves; always returns a member of legalCommands (+ layTile from legalLaysAt). */
export function pickBotCommand(state: GameState, actor: PlayerId): Command | null {
  const cmds = legalCommands(state, actor);
  const lays =
    state.phase.kind === "operating" && state.phase.step === "lay"
      ? (() => {
          const out: Command[] = [];
          for (const h of HEXES) {
            for (const opt of legalLaysAt(state, actor, h.id)) {
              out.push({
                type: "layTile",
                player: actor,
                hex: h.id,
                tile: opt.tile,
                rotation: opt.rotation,
              });
            }
          }
          return out;
        })()
      : [];

  const all = [...cmds.filter((c) => c.type !== "layTile"), ...lays];
  if (all.length === 0) return null;

  const score = (cmd: Command): number => {
    switch (cmd.type) {
      case "buyPrivate": {
        const p = PRIVATES.find((x) => x.id === cmd.privateId);
        return 100 - (p?.face ?? 50);
      }
      case "startCorp":
        return 80 + cmd.par / 10;
      case "buyShare":
        return 70;
      case "layTile":
        return 90;
      case "placeToken": {
        const home = CORPS.find((c) => {
          const corp = state.corps.find((x) => x.id === c.id);
          return corp?.president === actor && state.phase.kind === "operating" && state.phase.corpId === c.id;
        });
        return home && cmd.hex === home.home ? 95 : 75;
      }
      case "runTrains": {
        const corp =
          state.phase.kind === "operating"
            ? state.corps.find((c) => c.id === state.phase.corpId)
            : undefined;
        if (cmd.withhold) {
          return corp && corp.trains.length === 0 ? 85 : 40;
        }
        return 70;
      }
      case "buyTrain": {
        const order = { "2": 5, "3": 4, "4": 3, "5": 2, "6": 1 } as const;
        return 60 + (order[cmd.train] ?? 0);
      }
      case "takeLoan": {
        const corp =
          state.phase.kind === "operating"
            ? state.corps.find((c) => c.id === state.phase.corpId)
            : undefined;
        return corp && corp.trains.length === 0 && corp.treasury < 100 ? 88 : 20;
      }
      case "payLoan":
        return 35;
      case "sellShare":
        return 10;
      case "skip":
        return 15;
      case "pass":
        return 5;
      default:
        return 1;
    }
  };

  let best = all[0];
  let bestScore = score(best);
  for (let i = 1; i < all.length; i++) {
    const s = score(all[i]);
    if (s > bestScore) {
      best = all[i];
      bestScore = s;
    }
  }
  return best;
}

export function botActingSeat(state: GameState): PlayerId | null {
  return actingPlayer(state);
}
