import { describe, expect, it } from "vitest";
import { calculate } from "../calculate";
import type { Design } from "../types";

const design: Design = {
  targetHeightMm: 1800,
  gapMm: 5,
  slatCount: 25,
  colour: "charcoal",
  mounting: "in-ground",
  runs: [{ id: "a", lengthMm: 6000, startsAtCorner: false }],
};

describe("calculate", () => {
  it("chains the solver, BOM, optimiser and pricing", () => {
    const result = calculate(design, { tier: "retail" });
    if (!result.ok) throw new Error(result.error);

    expect(result.heightOptions[0].fenceHeightMm).toBe(1795);
    expect(result.layouts[0].bays).toBe(4);
    expect(result.bom.cuts[0].qty).toBe(100);
    expect(result.cutPlans.map((p) => p.lengths)).toEqual([25, 3]);
    expect(result.priced.totals.incGstCents).toBe(152185);
  });

  it("passes the price context through", () => {
    const result = calculate(design, { tier: "trade" });
    if (!result.ok) throw new Error(result.error);
    expect(result.priced.totals.incGstCents).toBe(132506);
  });

  it("is a valid, empty quote with no runs", () => {
    const result = calculate({ ...design, runs: [] }, { tier: "retail" });
    if (!result.ok) throw new Error(result.error);
    expect(result.priced.totals.incGstCents).toBe(0);
    expect(result.heightOptions).toHaveLength(3);
  });

  it("reports an invalid design instead of throwing", () => {
    const bad = {
      ...design,
      runs: [{ id: "a", lengthMm: 12, startsAtCorner: false }],
    };
    const result = calculate(bad, { tier: "retail" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Run length/);
    expect(result.heightOptions).toHaveLength(3);
  });

  it("reports a target height that cannot be built", () => {
    for (const targetHeightMm of [Number.NaN, 114, 5000]) {
      const result = calculate(
        { ...design, targetHeightMm },
        { tier: "retail" },
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/Target height/);
      expect(result.heightOptions).toEqual([]);
    }
  });
});
