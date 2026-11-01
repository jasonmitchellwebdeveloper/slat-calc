import type { CutRequest } from "./bom";
import { findProduct, PRODUCTS, SAW_KERF_MM } from "./catalogue";

export interface CutBar {
  cutsMm: number[]; // longest first
  offcutMm: number;
}

export interface CutPattern {
  count: number; // how many stock lengths are cut this way
  cuts: { lengthMm: number; qty: number }[];
  offcutMm: number;
}

export interface CutPlan {
  bars: CutBar[];
  patterns: CutPattern[];
  lengths: number;
  wasteMm: number; // offcuts only, not the metal lost to the saw
  wastePct: number; // 0 to 1
}

export interface SkuCutPlan extends CutPlan {
  sku: string;
  unmixedLengths: number; // if each cut length had its own stock lengths
  savedLengths: number;
}

const DEFAULT_STOCK_MM = PRODUCTS.slat.stockLengthMm;

function toPatterns(bars: CutBar[]): CutPattern[] {
  const patterns = new Map<string, CutPattern>();
  for (const { cutsMm, offcutMm } of bars) {
    const key = `${cutsMm.join(",")}|${offcutMm}`;
    const existing = patterns.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    const qtyByLength = new Map<number, number>();
    for (const cut of cutsMm) {
      qtyByLength.set(cut, (qtyByLength.get(cut) ?? 0) + 1);
    }
    patterns.set(key, {
      count: 1,
      cuts: [...qtyByLength].map(([lengthMm, qty]) => ({ lengthMm, qty })),
      offcutMm,
    });
  }
  return [...patterns.values()];
}

// First-fit decreasing. Each join between pieces costs one kerf, and so does
// freeing the last piece from the offcut, unless that piece reaches the bar end.
export function optimiseCuts(
  cutsMm: number[],
  stockMm: number = DEFAULT_STOCK_MM,
  kerfMm: number = SAW_KERF_MM,
): CutPlan {
  const sorted = [...cutsMm].sort((a, b) => b - a);
  const open: { cutsMm: number[]; remainingMm: number }[] = [];

  for (const cut of cutsMm) {
    if (!Number.isInteger(cut) || cut <= 0) {
      throw new RangeError(
        `Cut must be a positive whole number of mm, got ${cut}`,
      );
    }
    if (cut > stockMm) {
      throw new RangeError(`Cut ${cut} mm exceeds stock ${stockMm} mm`);
    }
  }

  for (const cut of sorted) {
    const bar = open.find((b) => b.remainingMm >= cut + kerfMm);
    if (bar) {
      bar.cutsMm.push(cut);
      bar.remainingMm -= cut + kerfMm;
    } else {
      open.push({ cutsMm: [cut], remainingMm: stockMm - cut });
    }
  }

  const bars = open.map((b) => ({
    cutsMm: b.cutsMm,
    offcutMm: Math.max(0, b.remainingMm - kerfMm),
  }));
  const wasteMm = bars.reduce((sum, b) => sum + b.offcutMm, 0);

  return {
    bars,
    patterns: toPatterns(bars),
    lengths: bars.length,
    wasteMm,
    wastePct: bars.length === 0 ? 0 : wasteMm / (bars.length * stockMm),
  };
}

function stockLengthFor(sku: string): number {
  const stockMm = findProduct(sku)?.stockLengthMm;
  if (stockMm === undefined) {
    throw new RangeError(`SKU ${sku} is not cut from stock`);
  }
  return stockMm;
}

const expand = ({ lengthMm, qty }: CutRequest): number[] =>
  Array.from({ length: qty }, () => lengthMm);

// One plan per SKU, so slats and channels never share a stock length.
export function planCuts(cuts: CutRequest[]): SkuCutPlan[] {
  const requestsBySku = new Map<string, CutRequest[]>();
  for (const cut of cuts) {
    requestsBySku.set(cut.sku, [...(requestsBySku.get(cut.sku) ?? []), cut]);
  }

  return [...requestsBySku].map(([sku, requests]) => {
    const stockMm = stockLengthFor(sku);
    const plan = optimiseCuts(requests.flatMap(expand), stockMm);
    const unmixedLengths = requests.reduce(
      (sum, r) => sum + optimiseCuts(expand(r), stockMm).lengths,
      0,
    );
    return {
      sku,
      ...plan,
      unmixedLengths,
      savedLengths: Math.max(0, unmixedLengths - plan.lengths),
    };
  });
}
