import type { GameState, PlayerId } from "./engine/types.ts";

export type Seat = {
  id: PlayerId;
  name: string;
  token: string;
};

export type RoomState = {
  seats: Seat[];
  game: GameState | null;
  history: GameState[];
};
