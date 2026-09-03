import type { GameState, PlayerId } from "./engine/types.ts";

export type Seat = {
  id: PlayerId;
  name: string;
  token: string;
  discordId?: string;
};

export type RoomState = {
  seats: Seat[];
  game: GameState | null;
  history: GameState[];
  webhookUrl?: string;
};
