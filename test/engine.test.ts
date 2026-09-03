import { describe, expect, it } from "vitest";
import { CORPS, hexId } from "../src/engine/catalog.ts";
import { apply, createGame } from "../src/engine/reduce.ts";
import { asCorp, asPlayer, asPrivate, asTile, type Command, type GameState } from "../src/engine/types.ts";

const p1 = asPlayer("p1");
const p2 = asPlayer("p2");
const p3 = asPlayer("p3");

function must(state: GameState, cmd: Command): GameState {
  const r = apply(state, cmd);
  if (!r.ok) throw new Error(`${r.error} on ${cmd.type} ${JSON.stringify(cmd)}`);
  return r.state;
}

describe("createGame", () => {
  it("opens an auction for 3 players with $320", () => {
    const r = createGame(["Ada", "Bess", "Cal"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players).toHaveLength(3);
    expect(r.state.players[0].cash).toBe(320);
    expect(r.state.phase.kind).toBe("auction");
    expect(r.state.privatesLeft).toHaveLength(5);
  });

  it("rejects a solo table", () => {
    const r = createGame(["Ada"]);
    expect(r.ok).toBe(false);
  });
});

describe("turns", () => {
  it("rejects a buy from the wrong seat", () => {
    const g = createGame(["Ada", "Bess", "Cal"]);
    if (!g.ok) throw new Error("setup");
    const r = apply(g.state, {
      type: "buyPrivate",
      player: p2,
      privateId: asPrivate("dock"),
    });
    expect(r.ok).toBe(false);
  });

  it("sells a private and deducts cash", () => {
    const g = createGame(["Ada", "Bess", "Cal"]);
    if (!g.ok) throw new Error("setup");
    const next = must(g.state, {
      type: "buyPrivate",
      player: p1,
      privateId: asPrivate("dock"),
    });
    expect(next.players[0].cash).toBe(300);
    expect(next.players[0].privates).toContain("dock");
    expect(next.phase.kind).toBe("auction");
    if (next.phase.kind === "auction") expect(next.phase.actor).toBe("p2");
  });
});

describe("scripted 3p game", () => {
  it("reaches an operating round, lays the home station, buys a train, and scores", () => {
    let s = createGame(["Ada", "Bess", "Cal"]);
    if (!s.ok) throw new Error("setup");
    let g = s.state;
    g = must(g, { type: "buyPrivate", player: p1, privateId: asPrivate("dock") });
    g = must(g, { type: "buyPrivate", player: p2, privateId: asPrivate("canal") });
    g = must(g, { type: "buyPrivate", player: p3, privateId: asPrivate("bridge") });
    g = must(g, { type: "buyPrivate", player: p1, privateId: asPrivate("mill") });
    g = must(g, { type: "buyPrivate", player: p2, privateId: asPrivate("port") });
    expect(g.phase.kind).toBe("stock");

    const icc = asCorp("ICC");
    g = must(g, { type: "startCorp", player: p1, corpId: icc, par: 70 });
    expect(g.corps.find((c) => c.id === icc)?.president).toBe("p1");
    g = must(g, { type: "pass", player: p2 });
    g = must(g, { type: "pass", player: p3 });
    g = must(g, { type: "buyShare", player: p1, corpId: icc });
    const floated = g.corps.find((c) => c.id === icc);
    expect(floated?.floated).toBe(true);
    expect(floated?.treasury).toBeGreaterThanOrEqual(350);

    g = must(g, { type: "pass", player: p2 });
    g = must(g, { type: "pass", player: p3 });
    g = must(g, { type: "pass", player: p1 });
    expect(g.phase.kind).toBe("operating");

    const home = hexId(3, 1);
    g = must(g, {
      type: "layTile",
      player: p1,
      hex: home,
      tile: asTile("57"),
      rotation: 0,
    });
    g = must(g, { type: "skip", player: p1 });
    g = must(g, { type: "skip", player: p1 });
    g = must(g, { type: "runTrains", player: p1, withhold: true });
    g = must(g, { type: "buyTrain", player: p1, train: "2" });
    const afterBuy = g.corps.find((c) => c.id === icc);
    expect(afterBuy?.trains).toEqual(["2"]);
    g = must(g, { type: "skip", player: p1 });
    expect(["operating", "stock", "ended"]).toContain(g.phase.kind);
  });

  it("rusts 2-trains when a 4-train is bought", () => {
    let s = createGame(["Ada", "Bess"]);
    if (!s.ok) throw new Error("setup");
    let g = s.state;
    g = must(g, { type: "pass", player: p1 });
    g = must(g, { type: "pass", player: p2 });
    const icc = asCorp("ICC");
    g = must(g, { type: "startCorp", player: p1, corpId: icc, par: 70 });
    g = must(g, { type: "pass", player: p2 });
    g = must(g, { type: "buyShare", player: p1, corpId: icc });
    g = must(g, { type: "pass", player: p2 });
    g = must(g, { type: "pass", player: p1 });
    expect(g.phase.kind).toBe("operating");
    g = must(g, { type: "skip", player: p1 });
    g = must(g, { type: "skip", player: p1 });
    g = must(g, { type: "runTrains", player: p1, withhold: true });
    g = must(g, { type: "buyTrain", player: p1, train: "2" });
    expect(g.corps.find((c) => c.id === icc)?.trains).toContain("2");
    while ((g.corps.find((c) => c.id === icc)?.loans ?? 0) < 5) {
      g = must(g, { type: "takeLoan", player: p1 });
    }
    g = must(g, { type: "buyTrain", player: p1, train: "4" });
    expect(g.corps.find((c) => c.id === icc)?.trains.includes("2")).toBe(false);
    expect(g.corps.find((c) => c.id === icc)?.trains).toContain("4");
  });
});
