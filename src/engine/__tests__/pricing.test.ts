import { describe, expect, it } from "vitest";
import { buildBom } from "../bom";
import { PRODUCTS } from "../catalogue";
import { planCuts } from "../cutting";
import {
  calculateTotals,
  DEMO_ACCOUNT_CODE,
  priceBom,
  resolvePrice,
  type PriceContext,
} from "../pricing";
import type { SlatDesign, Product, Run } from "../types";

const { slat, channel, post2400, cap, basePlate, gateKit, fixings } = PRODUCTS;

const RUN: Run = { id: "a", lengthMm: 6000, startsAtCorner: false };

function price(ctx: PriceContext, extra: Partial<SlatDesign> = {}) {
  const design: SlatDesign = {
    system: "slat",
    targetHeightMm: 1800,
    gapMm: 5,
    slatCount: 25,
    colour: "charcoal",
    mounting: "in-ground",
    runs: [RUN],
    ...extra,
  };
  const bom = buildBom(design);
  return priceBom(bom, planCuts(bom.cuts), ctx);
}

describe("resolvePrice", () => {
  const demo = { tier: "trade", accountCode: DEMO_ACCOUNT_CODE } as const;

  it("uses a contract price ahead of the tier price", () => {
    expect(resolvePrice(slat, demo)).toBe(3150);
  });

  it("applies a contract price whichever tier is set", () => {
    expect(resolvePrice(slat, { ...demo, tier: "retail" })).toBe(3150);
  });

  it("falls back to the tier price for SKUs not on the contract", () => {
    expect(resolvePrice(post2400, demo)).toBe(4200);
  });

  it("uses the tier price with no account", () => {
    expect(resolvePrice(slat, { tier: "trade" })).toBe(3450);
    expect(resolvePrice(slat, { tier: "retail" })).toBe(3950);
  });

  it("ignores an unknown account", () => {
    const ctx = { tier: "trade", accountCode: "NOPE" } as const;
    expect(resolvePrice(slat, ctx)).toBe(3450);
  });

  it("falls back to retail when a product has no tier price", () => {
    const retailOnly = {
      sku: "DEMO-RETAIL-ONLY",
      name: "Retail only",
      priceCents: { retail: 1000 },
    } as unknown as Product;
    expect(resolvePrice(retailOnly, { tier: "trade" })).toBe(1000);
  });
});

describe("calculateTotals", () => {
  it("rounds GST down on an awkward total", () => {
    expect(calculateTotals([3333])).toEqual({
      exGstCents: 3333,
      gstCents: 333,
      incGstCents: 3666,
    });
  });

  it("rounds GST up from half a cent", () => {
    expect(calculateTotals([3335]).gstCents).toBe(334);
    expect(calculateTotals([3334]).gstCents).toBe(333);
  });

  it("rounds once on the subtotal, not per line", () => {
    // Per line would be 2 + 2 + 2 = 6 cents. On the 45 cent subtotal it is 5.
    expect(calculateTotals([15, 15, 15]).gstCents).toBe(5);
  });

  it("is zero with no lines", () => {
    expect(calculateTotals([])).toEqual({
      exGstCents: 0,
      gstCents: 0,
      incGstCents: 0,
    });
  });
});

describe("priceBom", () => {
  it("prices the 6000 mm example at trade", () => {
    expect(price({ tier: "trade" })).toEqual({
      lines: [
        {
          sku: slat.sku,
          name: slat.name,
          qty: 25,
          unitPriceCents: 3450,
          lineTotalCents: 86250,
          contractPrice: false,
        },
        {
          sku: channel.sku,
          name: channel.name,
          qty: 3,
          unitPriceCents: 2450,
          lineTotalCents: 7350,
          contractPrice: false,
        },
        {
          sku: post2400.sku,
          name: post2400.name,
          qty: 5,
          unitPriceCents: 4200,
          lineTotalCents: 21000,
          contractPrice: false,
        },
        {
          sku: cap.sku,
          name: cap.name,
          qty: 5,
          unitPriceCents: 380,
          lineTotalCents: 1900,
          contractPrice: false,
        },
        {
          sku: fixings.sku,
          name: fixings.name,
          qty: 4,
          unitPriceCents: 990,
          lineTotalCents: 3960,
          contractPrice: false,
        },
      ],
      totals: { exGstCents: 120460, gstCents: 12046, incGstCents: 132506 },
      retailExGstCents: 138350,
      savingCents: 17890,
    });
  });

  it("orders stock lengths rather than individual cuts", () => {
    const { lines } = price({ tier: "trade" });
    expect(lines.find((l) => l.sku === slat.sku)?.qty).toBe(25);
    expect(lines.find((l) => l.sku === channel.sku)?.qty).toBe(3);
  });

  it("shows no saving at retail", () => {
    const quote = price({ tier: "retail" });
    expect(quote.totals).toEqual({
      exGstCents: 138350,
      gstCents: 13835,
      incGstCents: 152185,
    });
    expect(quote.retailExGstCents).toBe(138350);
    expect(quote.savingCents).toBe(0);
  });

  it("applies the contract price for the demo account", () => {
    const quote = price({ tier: "trade", accountCode: DEMO_ACCOUNT_CODE });
    expect(quote.lines[0]).toMatchObject({
      sku: slat.sku,
      unitPriceCents: 3150,
      lineTotalCents: 78750,
    });
    expect(quote.totals).toEqual({
      exGstCents: 112960,
      gstCents: 11296,
      incGstCents: 124256,
    });
    expect(quote.savingCents).toBe(25390);
  });

  it("prices gate kits and base plates", () => {
    const { lines } = price(
      { tier: "retail" },
      { mounting: "base-plate", runs: [{ ...RUN, gate: { widthMm: 900 } }] },
    );
    expect(lines.find((l) => l.sku === basePlate.sku)).toMatchObject({
      qty: 6,
      lineTotalCents: 11100,
    });
    expect(lines.find((l) => l.sku === gateKit.sku)).toMatchObject({
      qty: 1,
      lineTotalCents: 18500,
    });
  });

  it("makes every line total match its quantity and unit price", () => {
    const { lines, totals } = price({ tier: "trade" });
    for (const l of lines) {
      expect(l.lineTotalCents).toBe(l.qty * l.unitPriceCents);
    }
    const sum = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    expect(totals.exGstCents).toBe(sum);
    expect(totals.incGstCents).toBe(totals.exGstCents + totals.gstCents);
  });

  it("is all zero with no runs", () => {
    expect(price({ tier: "trade" }, { runs: [] })).toEqual({
      lines: [],
      totals: { exGstCents: 0, gstCents: 0, incGstCents: 0 },
      retailExGstCents: 0,
      savingCents: 0,
    });
  });

  it("rejects a SKU missing from the catalogue", () => {
    const bom = { lines: [{ sku: "NOPE", qty: 1 }], cuts: [] };
    expect(() => priceBom(bom, [], { tier: "trade" })).toThrow(RangeError);
  });
});
