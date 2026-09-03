import type { GameState } from "./engine/types.ts";

export function phaseLabel(game: GameState): string {
  const ph = game.phase;
  if (ph.kind === "auction") return "Charter auction";
  if (ph.kind === "stock") return "Stock round";
  if (ph.kind === "operating") return `${ph.corpId} ${ph.step} · OR ${game.orNumber}/${game.orsPerSet}`;
  return "Books closed";
}

export function discordTurnContent(discordId: string | undefined, game: GameState, tableLink: string): string {
  const mention = discordId ? `<@${discordId}> ` : "";
  return `${mention}Your turn in Erie Steel — ${phaseLabel(game)} — ${tableLink}`;
}
