import type { Bom } from "./bom";
import { findProduct, PRODUCTS } from "./catalogue";
import type { SkuCutPlan } from "./cutting";
import type { Product, Tier } from "./types";

export interface PriceContext {
  tier: Tier;
  accountCode?: string;
}

export interface PricedLine {
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  contractPrice: boolean; // true when the account's contract set the price
}

export interface Totals {
  exGstCents: number;
  gstCents: number;
  incGstCents: number;
}

export interface PricedBom {
  lines: PricedLine[];
  totals: Totals;
  retailExGstCents: number;
  savingCents: number; // ex GST, against retail
}

export const DEMO_ACCOUNT_CODE = "DEMO-BUILDER-01";

// Demo contract prices, shaped like a customer price list in an ERP.
export const ACCOUNT_PRICES: Record<string, Record<string, number>> = {
  [DEMO_ACCOUNT_CODE]: { [PRODUCTS.slat.sku]: 3150 },
};

// Contract price first, then the tier price, then retail.
export function resolvePrice(product: Product, ctx: PriceContext): number {
  return (
    ACCOUNT_PRICES[ctx.accountCode ?? ""]?.[product.sku] ??
    product.priceCents[ctx.tier] ??
    product.priceCents.retail
  );
}

// GST is rounded once on the subtotal. Rounding per line drifts on big orders.
export function calculateTotals(lineTotalsCents: number[]): Totals {
  const exGstCents = lineTotalsCents.reduce((sum, t) => sum + t, 0);
  const gstCents = Math.round(exGstCents / 10);
  return { exGstCents, gstCents, incGstCents: exGstCents + gstCents };
}

function requireProduct(sku: string): Product {
  const product = findProduct(sku);
  if (!product) throw new RangeError(`SKU ${sku} is not in the catalogue`);
  return product;
}

// Slats and channels are ordered as whole stock lengths, so their quantities
// come from the cut plans. Everything else comes straight from the BOM.
export function priceBom(
  bom: Bom,
  cutPlans: SkuCutPlan[],
  ctx: PriceContext,
): PricedBom {
  const ordered = [
    ...cutPlans.map((plan) => ({ sku: plan.sku, qty: plan.lengths })),
    ...bom.lines,
  ].map(({ sku, qty }) => ({ product: requireProduct(sku), qty }));

  const lines = ordered.map(({ product, qty }) => {
    const unitPriceCents = resolvePrice(product, ctx);
    return {
      sku: product.sku,
      name: product.name,
      qty,
      unitPriceCents,
      lineTotalCents: qty * unitPriceCents,
      contractPrice:
        ACCOUNT_PRICES[ctx.accountCode ?? ""]?.[product.sku] !== undefined,
    };
  });

  const totals = calculateTotals(lines.map((l) => l.lineTotalCents));
  const retailExGstCents = ordered.reduce(
    (sum, { product, qty }) => sum + qty * product.priceCents.retail,
    0,
  );

  return {
    lines,
    totals,
    retailExGstCents,
    savingCents: Math.max(0, retailExGstCents - totals.exGstCents),
  };
}
