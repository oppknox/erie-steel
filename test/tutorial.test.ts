import { describe, expect, it } from "vitest";
import { JARGON, tip, tipAttr } from "../src/client/jargon.ts";
import {
  markTutorialDone,
  resetTutorialForTests,
  tutorialDone,
  TUTORIAL_STEPS,
} from "../src/client/tutorial.ts";

describe("tutorial content", () => {
  it("has a short skippable tour (≤5 steps)", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(TUTORIAL_STEPS.length).toBeLessThanOrEqual(5);
    expect(TUTORIAL_STEPS[0].body.toLowerCase()).toContain("skip");
  });
});

describe("tutorial localStorage", () => {
  it("marks completion when storage is available", () => {
    const store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    (globalThis as { localStorage?: typeof ls }).localStorage = ls;
    resetTutorialForTests();
    expect(tutorialDone()).toBe(false);
    markTutorialDone();
    expect(tutorialDone()).toBe(true);
    resetTutorialForTests();
    expect(tutorialDone()).toBe(false);
  });
});

describe("jargon tips", () => {
  it("exposes tooltips for HUD keys", () => {
    expect(tip("float").length).toBeGreaterThan(10);
    expect(tipAttr("OR")).toContain("title=");
    expect(Object.keys(JARGON).length).toBeGreaterThan(5);
  });
});
