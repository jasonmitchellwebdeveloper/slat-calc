import { describe, expect, it } from "vitest";
import {
  COLOURS,
  IN_GROUND_POST_DEPTH_MM,
  MAX_FENCE_HEIGHT_MM,
  POST_PRODUCTS,
  PRODUCTS,
} from "../catalogue";

const products = Object.values(PRODUCTS);

describe("catalogue", () => {
  it("has unique SKUs, all marked as demo data", () => {
    const skus = products.map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
    expect(skus.every((sku) => sku.startsWith("DEMO-"))).toBe(true);
  });

  it("prices in whole cents, with trade never above retail", () => {
    for (const { priceCents } of products) {
      expect(Number.isInteger(priceCents.retail)).toBe(true);
      expect(Number.isInteger(priceCents.trade)).toBe(true);
      expect(priceCents.trade).toBeLessThanOrEqual(priceCents.retail);
    }
  });

  it("lists posts shortest first", () => {
    const lengths = POST_PRODUCTS.map((p) => p.stockLengthMm!);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  it("has a post long enough for the tallest in-ground fence", () => {
    const longest = Math.max(...POST_PRODUCTS.map((p) => p.stockLengthMm!));
    expect(longest).toBeGreaterThanOrEqual(
      MAX_FENCE_HEIGHT_MM + IN_GROUND_POST_DEPTH_MM,
    );
  });

  it("has unique colour ids", () => {
    const ids = COLOURS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
