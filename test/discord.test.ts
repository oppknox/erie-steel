import { describe, expect, it } from "vitest";
import { discordTurnContent, phaseLabel } from "../src/discord.ts";
import { createGame } from "../src/engine/reduce.ts";

function game() {
  const created = createGame(["Ada", "Bess"]);
  if (!created.ok) throw new Error(created.error);
  return created.state;
}

describe("Discord turn notifications", () => {
  it("builds a mention and phase label", () => {
    const state = game();
    expect(phaseLabel(state)).toBe("Charter auction");
    expect(discordTurnContent("123456789", state, "https://erie.example/?code=ABCD")).toBe(
      "<@123456789> Your turn in Erie Steel — Charter auction — https://erie.example/?code=ABCD",
    );
  });

  it("omits the mention when no Discord ID is set", () => {
    expect(discordTurnContent(undefined, game(), "https://erie.example/?code=ABCD")).toBe(
      "Your turn in Erie Steel — Charter auction — https://erie.example/?code=ABCD",
    );
  });
});
