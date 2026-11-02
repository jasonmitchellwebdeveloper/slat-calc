import { describe, expect, it } from "vitest";
import { describeCutPattern, describeCutPlan, formatCents } from "../format";

describe("formatCents", () => {
  it("formats whole-cent amounts as Australian dollars", () => {
    expect(formatCents(152185)).toBe("$1,521.85");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("describeCutPlan", () => {
  it("gives the lengths to order and the waste", () => {
    expect(describeCutPlan({ lengths: 25, wastePct: 100 / 145000 })).toBe(
      "25 lengths, 0.1% waste",
    );
  });

  it("uses the singular for one length", () => {
    expect(describeCutPlan({ lengths: 1, wastePct: 0.25 })).toBe(
      "1 length, 25.0% waste",
    );
  });
});

describe("describeCutPattern", () => {
  it("describes a repeated pattern", () => {
    expect(
      describeCutPattern({
        count: 25,
        cuts: [{ lengthMm: 1446, qty: 4 }],
        offcutMm: 4,
      }),
    ).toBe("25 lengths: 4 × 1446 mm, 4 mm offcut");
  });

  it("describes mixed cuts with no offcut", () => {
    expect(
      describeCutPattern({
        count: 1,
        cuts: [
          { lengthMm: 2900, qty: 1 },
          { lengthMm: 2897, qty: 1 },
        ],
        offcutMm: 0,
      }),
    ).toBe("1 length: 1 × 2900 mm + 1 × 2897 mm, no offcut");
  });
});
