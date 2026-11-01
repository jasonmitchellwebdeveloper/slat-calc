import { describe, expect, it } from "vitest";
import { buildBom } from "../bom";
import { PRODUCTS, SAW_KERF_MM } from "../catalogue";
import { optimiseCuts, planCuts } from "../cutting";
import type { Design } from "../types";

const STOCK = 5800;
const repeat = (lengthMm: number, qty: number) =>
  Array.from({ length: qty }, () => lengthMm);

describe("optimiseCuts", () => {
  it("returns nothing for no cuts, without dividing by zero", () => {
    expect(optimiseCuts([])).toEqual({
      bars: [],
      patterns: [],
      lengths: 0,
      wasteMm: 0,
      wastePct: 0,
    });
  });

  it("handles a single cut", () => {
    // 5800 - 1000 leaves 4800, and the saw takes 3 more freeing the offcut
    const plan = optimiseCuts([1000]);
    expect(plan.lengths).toBe(1);
    expect(plan.bars).toEqual([{ cutsMm: [1000], offcutMm: 4797 }]);
    expect(plan.wasteMm).toBe(4797);
    expect(plan.wastePct).toBeCloseTo(4797 / 5800);
  });

  it("packs 100 x 1446 mm into 25 lengths with a 4 mm offcut each", () => {
    const plan = optimiseCuts(repeat(1446, 100));
    expect(plan.lengths).toBe(25);
    expect(plan.wasteMm).toBe(100);
    expect(plan.wastePct).toBeCloseTo(100 / (25 * 5800));
    expect(plan.patterns).toEqual([
      { count: 25, cuts: [{ lengthMm: 1446, qty: 4 }], offcutMm: 4 },
    ]);
  });

  describe("stock and kerf boundaries", () => {
    it("fits a cut exactly equal to stock, with no negative waste", () => {
      const plan = optimiseCuts([STOCK]);
      expect(plan.lengths).toBe(1);
      expect(plan.bars[0].offcutMm).toBe(0);
      expect(plan.wasteMm).toBe(0);
    });

    it("throws on a cut longer than stock", () => {
      expect(() => optimiseCuts([STOCK + 1])).toThrow(RangeError);
    });

    it("needs no kerf after a last piece that uses the bar exactly", () => {
      // 2900 + 3 + 2897 = 5800
      const plan = optimiseCuts([2900, 2897]);
      expect(plan.lengths).toBe(1);
      expect(plan.bars[0].offcutMm).toBe(0);
    });

    it("starts a new bar when a cut misses by one millimetre", () => {
      // 2900 + 3 + 2898 = 5801
      expect(optimiseCuts([2900, 2898]).lengths).toBe(2);
    });

    it("counts an end smaller than the kerf as no offcut", () => {
      expect(optimiseCuts([5799]).bars[0].offcutMm).toBe(0);
      expect(optimiseCuts([5797]).bars[0].offcutMm).toBe(0);
      expect(optimiseCuts([5796]).bars[0].offcutMm).toBe(1);
    });

    it("respects custom stock and kerf", () => {
      expect(optimiseCuts(repeat(250, 4), 1000, 0).bars).toEqual([
        { cutsMm: [250, 250, 250, 250], offcutMm: 0 },
      ]);
      expect(optimiseCuts(repeat(250, 4), 1000, 1).lengths).toBe(2);
    });
  });

  describe("packing", () => {
    it("places longest first and fills earlier bars", () => {
      expect(optimiseCuts([800, 5000, 1000]).bars).toEqual([
        { cutsMm: [5000], offcutMm: 797 },
        { cutsMm: [1000, 800], offcutMm: 3994 },
      ]);
    });

    it("does not depend on input order or change the input", () => {
      const input = [500, 5297, 1000];
      const copy = [...input];
      const plan = optimiseCuts(input);
      expect(input).toEqual(copy);
      expect(plan).toEqual(optimiseCuts([1000, 500, 5297]));
    });

    it("groups identical bars into one pattern", () => {
      expect(optimiseCuts([3000, 2000, 3000, 2000]).patterns).toEqual([
        {
          count: 2,
          cuts: [
            { lengthMm: 3000, qty: 1 },
            { lengthMm: 2000, qty: 1 },
          ],
          offcutMm: 794,
        },
      ]);
    });

    it("never loses a cut or overfills a bar", () => {
      const cuts = Array.from(
        { length: 400 },
        (_, i) => 200 + ((i * 397) % 5600),
      );
      const plan = optimiseCuts(cuts);

      const packed = plan.bars.flatMap((b) => b.cutsMm);
      expect([...packed].sort((a, b) => a - b)).toEqual(
        [...cuts].sort((a, b) => a - b),
      );

      for (const { cutsMm, offcutMm } of plan.bars) {
        const sum = cutsMm.reduce((s, c) => s + c, 0);
        const used = sum + SAW_KERF_MM * (cutsMm.length - 1);
        expect(used).toBeLessThanOrEqual(STOCK);
        expect(offcutMm).toBe(Math.max(0, STOCK - used - SAW_KERF_MM));
      }
    });
  });

  describe("bad input", () => {
    it.each([0, -100, 1.5, Number.NaN])("rejects a cut of %s mm", (cut) => {
      expect(() => optimiseCuts([cut])).toThrow(RangeError);
    });
  });
});

describe("planCuts", () => {
  const { slat, channel, cap } = PRODUCTS;

  it("returns nothing for no cuts", () => {
    expect(planCuts([])).toEqual([]);
  });

  it("plans slats and channels separately for the 6000 mm example", () => {
    const design: Design = {
      targetHeightMm: 1800,
      gapMm: 5,
      slatCount: 25,
      colour: "charcoal",
      mounting: "in-ground",
      runs: [{ id: "a", lengthMm: 6000, startsAtCorner: false }],
    };
    const [slats, channels, ...rest] = planCuts(buildBom(design).cuts);

    expect(rest).toEqual([]);
    expect(slats).toMatchObject({ sku: slat.sku, lengths: 25, wasteMm: 100 });
    // 3 x 1745 per length leaves a 556 mm offcut, and the last 2 leave 2304
    expect(channels).toMatchObject({
      sku: channel.sku,
      lengths: 3,
      wasteMm: 3416,
    });
    expect(channels.patterns).toEqual([
      { count: 2, cuts: [{ lengthMm: 1745, qty: 3 }], offcutMm: 556 },
      { count: 1, cuts: [{ lengthMm: 1745, qty: 2 }], offcutMm: 2304 },
    ]);
  });

  it("packs different lengths of one SKU onto shared stock", () => {
    const [plan] = planCuts([
      { sku: slat.sku, lengthMm: 4000, qty: 2 },
      { sku: slat.sku, lengthMm: 1700, qty: 2 },
    ]);
    expect(plan.lengths).toBe(2);
    expect(plan.patterns).toEqual([
      {
        count: 2,
        cuts: [
          { lengthMm: 4000, qty: 1 },
          { lengthMm: 1700, qty: 1 },
        ],
        offcutMm: 94,
      },
    ]);
  });

  it("reports the lengths saved by mixing cut lengths", () => {
    // Unmixed: 2 x 4000 needs 2 bars and 2 x 1700 needs 1, so 3 against 2
    const [plan] = planCuts([
      { sku: slat.sku, lengthMm: 4000, qty: 2 },
      { sku: slat.sku, lengthMm: 1700, qty: 2 },
    ]);
    expect(plan.unmixedLengths).toBe(3);
    expect(plan.savedLengths).toBe(1);
  });

  it("reports no saving when there is only one cut length", () => {
    const [plan] = planCuts([{ sku: slat.sku, lengthMm: 1446, qty: 100 }]);
    expect(plan.unmixedLengths).toBe(25);
    expect(plan.savedLengths).toBe(0);
  });

  it("rejects SKUs that are not cut from stock", () => {
    expect(() => planCuts([{ sku: cap.sku, lengthMm: 100, qty: 1 }])).toThrow(
      RangeError,
    );
    expect(() => planCuts([{ sku: "NOPE", lengthMm: 100, qty: 1 }])).toThrow(
      RangeError,
    );
  });
});
