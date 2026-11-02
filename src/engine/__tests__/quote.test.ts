import { describe, expect, it } from "vitest";
import { PRODUCTS } from "../catalogue";
import { DEMO_ACCOUNT_CODE, type PriceContext } from "../pricing";
import {
  buildQuote,
  createQuoteRef,
  QuoteSchema,
  verifyQuote,
  type Quote,
} from "../quote";
import type { PanelDesign, Design, SlatDesign } from "../types";

const design: Design = {
  system: "slat",
  targetHeightMm: 1800,
  gapMm: 5,
  slatCount: 25,
  colour: "charcoal",
  mounting: "in-ground",
  runs: [{ id: "run-1", lengthMm: 6000, startsAtCorner: false }],
};

const twoRuns: Design = {
  ...design,
  mounting: "base-plate",
  runs: [
    design.runs[0],
    {
      id: "run-2",
      lengthMm: 3000,
      startsAtCorner: true,
      gate: { widthMm: 900 },
    },
  ],
};

const RETAIL: PriceContext = { tier: "retail" };
const ACCOUNT: PriceContext = {
  tier: "trade",
  accountCode: DEMO_ACCOUNT_CODE,
};
const NOW = new Date("2026-11-02T09:30:00+10:00");

function quote(d = design, ctx = RETAIL): Quote {
  return buildQuote(d, ctx, NOW);
}

describe("buildQuote", () => {
  it("builds the payload for the 6000 mm example", () => {
    const q = quote();
    expect(q.source).toBe("fence-calculator");
    expect(q.createdAt).toBe("2026-11-01T23:30:00.000Z");
    expect(q.customer).toEqual({ tier: "retail" });
    expect(q.design).toEqual({
      system: "slat",
      fenceHeightMm: 1795,
      gapMm: 5,
      slatCount: 25,
      colour: "charcoal",
      mounting: "in-ground",
      runs: [{ lengthMm: 6000, startsAtCorner: false }],
    });
    expect(q.lines[0]).toEqual({
      sku: PRODUCTS.slat.sku,
      qty: 25,
      unitPriceCents: 3950,
      lineTotalCents: 98750,
    });
    expect(q.totals).toEqual({
      exGstCents: 138350,
      gstCents: 13835,
      incGstCents: 152185,
    });
  });

  it("carries the account code and the contract price", () => {
    const q = quote(design, ACCOUNT);
    expect(q.customer).toEqual({
      tier: "trade",
      accountCode: DEMO_ACCOUNT_CODE,
    });
    expect(q.lines[0].unitPriceCents).toBe(3150);
    expect(q.totals.incGstCents).toBe(124256);
  });

  it("keeps corners and gates on the runs", () => {
    expect(quote(twoRuns).design.runs).toEqual([
      { lengthMm: 6000, startsAtCorner: false },
      { lengthMm: 3000, startsAtCorner: true, gate: { widthMm: 900 } },
    ]);
  });

  it("refuses to build from an invalid design", () => {
    const bad = {
      ...design,
      runs: [{ ...design.runs[0], lengthMm: 12 }],
    };
    expect(() => quote(bad)).toThrow(RangeError);
  });
});

describe("QuoteSchema", () => {
  it("accepts what buildQuote produces", () => {
    for (const q of [quote(), quote(twoRuns), quote(design, ACCOUNT)]) {
      expect(QuoteSchema.safeParse(q).success).toBe(true);
    }
  });

  it("accepts a timestamp with a timezone offset", () => {
    const q = { ...quote(), createdAt: "2026-11-02T09:30:00+10:00" };
    expect(QuoteSchema.safeParse(q).success).toBe(true);
  });

  it.each([
    ["a null body", () => null],
    ["the wrong source", () => ({ ...quote(), source: "elsewhere" })],
    ["a bad timestamp", () => ({ ...quote(), createdAt: "yesterday" })],
    ["no customer", () => ({ ...quote(), customer: undefined })],
    ["an unknown tier", () => ({ ...quote(), customer: { tier: "platinum" } })],
    [
      "an unknown colour",
      () => ({ ...quote(), design: { ...quote().design, colour: "neon" } }),
    ],
    ["no lines", () => ({ ...quote(), lines: [] })],
    [
      "a fractional price",
      () => ({
        ...quote(),
        lines: [{ ...quote().lines[0], unitPriceCents: 39.5 }],
      }),
    ],
    [
      "a negative quantity",
      () => ({ ...quote(), lines: [{ ...quote().lines[0], qty: -1 }] }),
    ],
    [
      "a total as text",
      () => ({
        ...quote(),
        totals: { ...quote().totals, incGstCents: "152185" },
      }),
    ],
  ])("rejects %s", (_, build) => {
    expect(QuoteSchema.safeParse(build()).success).toBe(false);
  });
});

describe("verifyQuote", () => {
  it("accepts an honest quote at every price level", () => {
    expect(verifyQuote(quote())).toBe(true);
    expect(verifyQuote(quote(twoRuns))).toBe(true);
    expect(verifyQuote(quote(design, { tier: "trade" }))).toBe(true);
    expect(verifyQuote(quote(twoRuns, ACCOUNT))).toBe(true);
  });

  it("accepts any build the solver can make, not only the closest", () => {
    const d: SlatDesign = { ...design, gapMm: 9, slatCount: 24 };
    expect(verifyQuote(quote(d))).toBe(true);
  });

  it("rejects a lowered unit price", () => {
    const q = quote();
    q.lines[0] = { ...q.lines[0], unitPriceCents: 100, lineTotalCents: 2500 };
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects a lowered total", () => {
    const q = quote();
    q.totals = { ...q.totals, incGstCents: 100 };
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects a changed quantity", () => {
    const q = quote();
    q.lines[0] = { ...q.lines[0], qty: 1 };
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects a removed line", () => {
    const q = quote();
    q.lines = q.lines.slice(1);
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects retail lines claimed under a contract account", () => {
    const q = quote();
    q.customer = { tier: "trade", accountCode: DEMO_ACCOUNT_CODE };
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects an account code that doesn't exist", () => {
    const q = quote(design, { tier: "trade" });
    q.customer = { tier: "trade", accountCode: "NOT-AN-ACCOUNT" };
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects a height that doesn't match the build", () => {
    const q = quote();
    q.design = { ...q.design, fenceHeightMm: 900 };
    expect(verifyQuote(q)).toBe(false);
  });

  it("rejects a design the engine can't build", () => {
    const q = quote();
    q.design = {
      ...q.design,
      runs: [{ lengthMm: 12, startsAtCorner: false }],
    };
    expect(verifyQuote(q)).toBe(false);
  });
});

describe("createQuoteRef", () => {
  it("uses the Australian date and a random suffix", () => {
    // 23:30 UTC on the 1st is already the 2nd in Sydney.
    const ref = createQuoteRef(new Date("2026-11-01T23:30:00Z"));
    expect(ref).toMatch(/^Q-20261102-[0-9A-F]{4}$/);
  });
});

describe("steel panel quotes", () => {
  const panel: PanelDesign = {
    system: "panel",
    fenceHeightMm: 1800,
    sleepers: 1,
    postLengthMm: null,
    profile: "trimline",
    colour: "mist-grey",
    frameColour: "slate-grey",
    concrete: "rapid-set",
    mounting: "in-ground",
    runs: [
      { id: "run-1", lengthMm: 10000, startsAtCorner: false },
      {
        id: "run-2",
        lengthMm: 4000,
        startsAtCorner: true,
        gate: { widthMm: 930 },
      },
    ],
  };

  it("keeps every panel option in the payload", () => {
    const q = buildQuote(panel, RETAIL, NOW);
    expect(q.design).toEqual({
      system: "panel",
      fenceHeightMm: 1800,
      sleepers: 1,
      postLengthMm: null,
      profile: "trimline",
      colour: "mist-grey",
      frameColour: "slate-grey",
      concrete: "rapid-set",
      mounting: "in-ground",
      runs: [
        { lengthMm: 10000, startsAtCorner: false },
        { lengthMm: 4000, startsAtCorner: true, gate: { widthMm: 930 } },
      ],
    });
  });

  it("passes the schema and the price check", () => {
    for (const ctx of [RETAIL, ACCOUNT]) {
      const q = buildQuote(panel, ctx, NOW);
      expect(QuoteSchema.safeParse(q).success).toBe(true);
      expect(verifyQuote(q)).toBe(true);
    }
  });

  it("rejects a changed price and a changed option", () => {
    const cheap = buildQuote(panel, RETAIL, NOW);
    cheap.totals = { ...cheap.totals, incGstCents: 100 };
    expect(verifyQuote(cheap)).toBe(false);

    const changed = buildQuote(panel, RETAIL, NOW);
    if (changed.design.system !== "panel") throw new Error("expected panel");
    changed.design = { ...changed.design, sleepers: 0 };
    expect(verifyQuote(changed)).toBe(false);
  });

  it("rejects a slat colour on a panel fence", () => {
    const q = buildQuote(panel, RETAIL, NOW);
    const bad = { ...q, design: { ...q.design, colour: "woodgrain" } };
    expect(QuoteSchema.safeParse(bad).success).toBe(false);
  });
});
