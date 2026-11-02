import { describe, expect, it } from "vitest";
import { calculate } from "../calculate";
import { PRODUCTS } from "../catalogue";
import { DEMO_ACCOUNT_CODE } from "../pricing";
import type { PanelDesign, Design } from "../types";

const design: Design = {
  system: "slat",
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

describe("contract price flag", () => {
  it("marks only the lines priced from an account's contract", () => {
    const result = calculate(design, {
      tier: "trade",
      accountCode: DEMO_ACCOUNT_CODE,
    });
    if (!result.ok) throw new Error(result.error);
    const contract = result.priced.lines.filter((l) => l.contractPrice);
    expect(contract.map((l) => l.sku)).toEqual([PRODUCTS.slat.sku]);
    expect(contract[0].unitPriceCents).toBe(3150);
  });

  it("marks nothing without an account", () => {
    const result = calculate(design, { tier: "trade" });
    if (!result.ok) throw new Error(result.error);
    expect(result.priced.lines.some((l) => l.contractPrice)).toBe(false);
  });
});

describe("calculate with a steel panel design", () => {
  const panel: PanelDesign = {
    system: "panel",
    fenceHeightMm: 1800,
    sleeperType: "none",
    sleepers: 0,
    postLengthMm: null,
    profile: "sawtooth",
    colour: "mist-grey",
    frameColour: "slate-grey",
    concrete: "post-mix",
    mounting: "in-ground",
    runs: [{ id: "run-1", lengthMm: 10000, startsAtCorner: false }],
  };

  it("prices the 10 m run through the same pipeline", () => {
    const result = calculate(panel, { tier: "retail" });
    if (!result.ok) throw new Error(result.error);
    expect(result.heightOptions).toEqual([]);
    expect(result.cutPlans).toEqual([]);
    const sum = result.priced.lines.reduce((t, l) => t + l.lineTotalCents, 0);
    expect(result.priced.totals.exGstCents).toBe(sum);
    expect(result.priced.totals.gstCents).toBe(Math.round(sum / 10));
    expect(sum).toBeGreaterThan(0);
  });

  it("charges less at trade than retail", () => {
    const retail = calculate(panel, { tier: "retail" });
    const trade = calculate(panel, { tier: "trade" });
    if (!retail.ok || !trade.ok) throw new Error("expected both to price");
    expect(trade.priced.totals.incGstCents).toBeLessThan(
      retail.priced.totals.incGstCents,
    );
    expect(trade.priced.savingCents).toBeGreaterThan(0);
  });

  it("reports a run that's too short instead of throwing", () => {
    const short = { ...panel, runs: [{ ...panel.runs[0], lengthMm: 2000 }] };
    const result = calculate(short, { tier: "retail" });
    expect(result.ok).toBe(false);
  });
});
