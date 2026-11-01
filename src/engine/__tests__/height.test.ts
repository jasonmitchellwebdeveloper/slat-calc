import { describe, expect, it } from "vitest";
import { GROUND_CLEARANCE_MM, MAX_FENCE_HEIGHT_MM } from "../catalogue";
import { solveHeight } from "../height";

const summary = (targetMm: number, gaps?: Parameters<typeof solveHeight>[1]) =>
  solveHeight(targetMm, gaps).map(
    (o) => `${o.gapMm}/${o.slatCount}/${o.fenceHeightMm}/${o.diffMm}`,
  );

describe("solveHeight", () => {
  it("returns the three closest builds for the 1800 mm worked example", () => {
    expect(solveHeight(1800)).toEqual([
      {
        gapMm: 5,
        slatCount: 25,
        panelHeightMm: 1745,
        fenceHeightMm: 1795,
        diffMm: -5,
      },
      {
        gapMm: 20,
        slatCount: 21,
        panelHeightMm: 1765,
        fenceHeightMm: 1815,
        diffMm: 15,
      },
      {
        gapMm: 9,
        slatCount: 24,
        panelHeightMm: 1767,
        fenceHeightMm: 1817,
        diffMm: 17,
      },
    ]);
  });

  it("lists an exact hit first, and only once", () => {
    expect(summary(1795)).toEqual([
      "5/25/1795/0",
      "20/21/1815/20",
      "9/24/1817/22",
    ]);
  });

  describe("below one slat", () => {
    it("returns nothing under 115 mm", () => {
      expect(solveHeight(114)).toEqual([]);
      expect(solveHeight(0)).toEqual([]);
      expect(solveHeight(-500)).toEqual([]);
    });

    it("allows a single slat at exactly 115 mm", () => {
      expect(summary(115)).toEqual(["5/1/115/0", "9/1/115/0", "20/1/115/0"]);
    });
  });

  describe("above the max height", () => {
    it("keeps only builds at or under the max", () => {
      expect(summary(2110)).toEqual([
        "5/29/2075/-35",
        "20/24/2070/-40",
        "9/27/2039/-71",
      ]);
    });

    it("returns nothing when every candidate is over the max", () => {
      expect(solveHeight(2200)).toEqual([]);
      expect(solveHeight(5000)).toEqual([]);
    });
  });

  describe("ties", () => {
    it("prefers the smaller gap when two gaps are equally close", () => {
      expect(summary(1805)).toEqual([
        "5/25/1795/-10",
        "20/21/1815/10",
        "9/24/1817/12",
      ]);
    });

    it("prefers fewer slats when one gap is equally close both ways", () => {
      expect(summary(1830, [5])).toEqual(["5/25/1795/-35", "5/26/1865/35"]);
    });

    it("does not depend on the order of the gaps passed in", () => {
      expect(summary(1805, [20, 9, 5])).toEqual(summary(1805, [5, 9, 20]));
    });
  });

  describe("bad input", () => {
    it("returns nothing for non-numbers", () => {
      expect(solveHeight(Number.NaN)).toEqual([]);
      expect(solveHeight(Number.POSITIVE_INFINITY)).toEqual([]);
    });

    it("rounds a fractional target so lengths stay whole millimetres", () => {
      expect(solveHeight(1800.4)).toEqual(solveHeight(1800));
    });

    it("returns nothing when no gaps are given", () => {
      expect(solveHeight(1800, [])).toEqual([]);
    });
  });

  it("holds its rules across every height in range", () => {
    for (let target = 115; target <= MAX_FENCE_HEIGHT_MM; target++) {
      const options = solveHeight(target);
      expect(options.length).toBeGreaterThan(0);
      expect(options.length).toBeLessThanOrEqual(3);

      for (const o of options) {
        expect(o.slatCount).toBeGreaterThanOrEqual(1);
        expect(o.fenceHeightMm).toBeLessThanOrEqual(MAX_FENCE_HEIGHT_MM);
        expect(o.fenceHeightMm).toBe(
          65 * o.slatCount + o.gapMm * (o.slatCount - 1) + 50,
        );
        expect(o.panelHeightMm).toBe(o.fenceHeightMm - GROUND_CLEARANCE_MM);
        expect(o.diffMm).toBe(o.fenceHeightMm - target);
      }

      const diffs = options.map((o) => Math.abs(o.diffMm));
      expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
    }
  });
});
