import { describe, expect, it } from "vitest";
import { HEXES } from "../src/engine/catalog.ts";

const SIZE = 42;

function axialPixel(q: number, r: number) {
  return {
    x: SIZE * Math.sqrt(3) * (q + r / 2),
    y: SIZE * 1.5 * r,
  };
}

describe("map viewBox", () => {
  it("fits hexes without a 420px dead offset", () => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const h of HEXES) {
      const { x, y } = axialPixel(h.q, h.r);
      minX = Math.min(minX, x - SIZE);
      maxX = Math.max(maxX, x + SIZE);
      minY = Math.min(minY, y - SIZE);
      maxY = Math.max(maxY, y + SIZE);
    }
    const w = maxX - minX;
    const h = maxY - minY;
    expect(w).toBeGreaterThan(400);
    expect(h).toBeGreaterThan(250);
    expect(w / h).toBeGreaterThan(1.1);
    expect(w / h).toBeLessThan(3);
    const pit = HEXES.find((x) => x.name === "Pittsburgh")!;
    const p = axialPixel(pit.q, pit.r);
    expect(p.x).toBeGreaterThan(minX);
    expect(p.x).toBeLessThan(maxX);
  });
});
