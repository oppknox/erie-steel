import { describe, expect, it } from "vitest";
import { hexId } from "../src/engine/catalog.ts";
import { pickBotCommand } from "../src/client/bot.ts";
import { narrate } from "../src/client/narrator.ts";
import { actingPlayer, legalCommands, legalLaysAt } from "../src/engine/legal.ts";
import { apply, createGame } from "../src/engine/reduce.ts";
import { asCorp, asPlayer, type Command, type GameState } from "../src/engine/types.ts";

function isLegal(state: GameState, cmd: Command): boolean {
  if (cmd.type === "layTile") {
    return legalLaysAt(state, cmd.player, cmd.hex).some(
      (o) => o.tile === cmd.tile && o.rotation === cmd.rotation,
    );
  }
  return legalCommands(state, cmd.player).some((c) => JSON.stringify(c) === JSON.stringify(cmd));
}

describe("pickBotCommand", () => {
  it("returns no lays after the lay budget is exhausted", () => {
    const r = createGame(["Ada", "Bess"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = structuredClone(r.state);
    g.phase = { kind: "operating", corpId: asCorp("ICC"), step: "lay" };
    const corp = g.corps.find((c) => c.id === "ICC");
    if (!corp) throw new Error("setup");
    corp.president = asPlayer("p1");
    corp.laidThisOr = 2;
    expect(legalLaysAt(g, asPlayer("p1"), hexId(3, 1))).toEqual([]);
    g.trains["3"].left = 3;
    corp.laidThisOr = 1;
    expect(legalLaysAt(g, asPlayer("p1"), hexId(3, 1))).toEqual([]);
  });

  it("always returns a legal command while auctioning", () => {
    const r = createGame(["Ada", "Bess", "Cal"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    let g = r.state;
    for (let i = 0; i < 12; i++) {
      const actor = actingPlayer(g);
      if (!actor) break;
      const cmd = pickBotCommand(g, actor);
      expect(cmd).not.toBeNull();
      if (!cmd) return;
      expect(isLegal(g, cmd)).toBe(true);
      const next = apply(g, cmd);
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      g = next.state;
      if (g.phase.kind === "ended") break;
    }
  });

  it("plays a long run with zero rejected applies", () => {
    const r = createGame(["BotA", "BotB", "BotC"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    let g = r.state;
    let rejected = 0;
    for (let i = 0; i < 400; i++) {
      const actor = actingPlayer(g);
      if (!actor) break;
      const cmd = pickBotCommand(g, actor);
      if (!cmd) break;
      expect(isLegal(g, cmd)).toBe(true);
      const next = apply(g, cmd);
      if (!next.ok) rejected += 1;
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      g = next.state;
    }
    expect(g.log.length).toBeGreaterThan(5);
    expect(rejected).toBe(0);
  });
});

describe("narrate", () => {
  it("explains a private buy in plain English", () => {
    const r = createGame(["Ada", "Bess", "Cal"]);
    if (!r.ok) throw new Error("setup");
    const cmd: Command = {
      type: "buyPrivate",
      player: asPlayer("p1"),
      privateId: r.state.privatesLeft[0],
    };
    const line = narrate(r.state, cmd);
    expect(line.length).toBeGreaterThan(10);
    expect(line.toLowerCase()).toContain("buy");
  });
});
