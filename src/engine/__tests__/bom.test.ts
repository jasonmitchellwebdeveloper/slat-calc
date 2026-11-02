import { describe, expect, it } from "vitest";
import { buildBom, layoutRuns } from "../bom";
import { PRODUCTS } from "../catalogue";
import type { SlatDesign, Run } from "../types";

const { slat, post2400, post3000, channel, cap, basePlate, gateKit, fixings } =
  PRODUCTS;

function run(lengthMm: number, extra: Partial<Run> = {}): Run {
  return { id: `run-${lengthMm}`, lengthMm, startsAtCorner: false, ...extra };
}

function design(runs: Run[], extra: Partial<SlatDesign> = {}): SlatDesign {
  return {
    system: "slat",
    targetHeightMm: 1800,
    gapMm: 5,
    slatCount: 25,
    colour: "charcoal",
    mounting: "in-ground",
    runs,
    ...extra,
  };
}

function qty(d: SlatDesign, sku: string): number {
  return buildBom(d).lines.find((l) => l.sku === sku)?.qty ?? 0;
}

describe("buildBom", () => {
  it("matches the 6000 mm sanity check", () => {
    expect(buildBom(design([run(6000)]))).toEqual({
      lines: [
        { sku: post2400.sku, qty: 5 },
        { sku: cap.sku, qty: 5 },
        { sku: fixings.sku, qty: 4 },
      ],
      cuts: [
        { sku: slat.sku, lengthMm: 1446, qty: 100 },
        { sku: channel.sku, lengthMm: 1745, qty: 8 },
      ],
    });
  });

  it("returns nothing for a design with no runs", () => {
    expect(buildBom(design([]))).toEqual({ lines: [], cuts: [] });
  });

  describe("bay spacing", () => {
    it("uses full bays on an exact multiple of the max bay", () => {
      const bom = buildBom(design([run(3860)]));
      expect(qty(design([run(3860)]), post2400.sku)).toBe(3);
      expect(bom.cuts).toEqual([
        { sku: slat.sku, lengthMm: 1876, qty: 50 },
        { sku: channel.sku, lengthMm: 1745, qty: 4 },
      ]);
    });

    it("adds a bay one millimetre past the max and floors the width", () => {
      expect(layoutRuns(design([run(1930)]))[0].bays).toBe(1);
      expect(layoutRuns(design([run(1931)]))[0]).toMatchObject({
        bays: 2,
        bayWidthMm: 965,
        slatCutMm: 911,
      });
    });

    it("handles a run shorter than one bay", () => {
      const bom = buildBom(design([run(1000)]));
      expect(qty(design([run(1000)]), post2400.sku)).toBe(2);
      expect(qty(design([run(1000)]), fixings.sku)).toBe(1);
      expect(bom.cuts).toEqual([
        { sku: slat.sku, lengthMm: 946, qty: 25 },
        { sku: channel.sku, lengthMm: 1745, qty: 2 },
      ]);
    });

    it("floors fractional bay widths to whole millimetres", () => {
      expect(layoutRuns(design([run(5000)]))[0]).toMatchObject({
        bays: 3,
        bayWidthMm: 1666,
        slatCutMm: 1612,
      });
    });
  });

  describe("corners", () => {
    it("shares a post across two runs", () => {
      const d = design([run(6000), run(4000, { startsAtCorner: true })]);
      expect(qty(d, post2400.sku)).toBe(8); // 5 + (4 - 1)
      expect(qty(d, cap.sku)).toBe(8);
    });

    it("ignores the corner flag on the first run", () => {
      const d = design([run(6000, { startsAtCorner: true })]);
      expect(qty(d, post2400.sku)).toBe(5);
    });

    it("keeps different cut lengths apart and merges matching ones", () => {
      const d = design([
        run(6000),
        run(4000, { id: "b", startsAtCorner: true }),
        run(3000, { id: "c", startsAtCorner: true }),
      ]);
      expect(buildBom(d).cuts).toEqual([
        { sku: slat.sku, lengthMm: 1446, qty: 150 }, // 4 bays + 2 bays
        { sku: slat.sku, lengthMm: 1279, qty: 75 }, // 3 bays at 1333
        { sku: channel.sku, lengthMm: 1745, qty: 18 }, // 9 bays
      ]);
    });
  });

  describe("gates", () => {
    const gated = design([run(6000, { gate: { widthMm: 900 } })]);

    it("adds a post and a gate kit", () => {
      expect(qty(gated, post2400.sku)).toBe(6);
      expect(qty(gated, cap.sku)).toBe(6);
      expect(qty(gated, gateKit.sku)).toBe(1);
    });

    it("leaves slats and fixings alone", () => {
      expect(qty(gated, fixings.sku)).toBe(4);
      expect(buildBom(gated).cuts[0].qty).toBe(100);
    });

    it("includes the hinge and latch allowance in the opening", () => {
      expect(layoutRuns(gated)[0].gateOpeningMm).toBe(940);
    });

    it("omits the kit and the opening when there is no gate", () => {
      const d = design([run(6000)]);
      expect(qty(d, gateKit.sku)).toBe(0);
      expect(layoutRuns(d)[0].gateOpeningMm).toBeUndefined();
    });

    it("still shares a corner post after a gated run", () => {
      const d = design([
        run(6000, { gate: { widthMm: 900 } }),
        run(3000, { id: "b", startsAtCorner: true }),
      ]);
      expect(qty(d, post2400.sku)).toBe(8); // 6 + (3 - 1)
      expect(qty(d, gateKit.sku)).toBe(1);
    });
  });

  describe("mounting", () => {
    it("adds a base plate per post for base-plate mounting", () => {
      const d = design([run(6000)], { mounting: "base-plate" });
      expect(qty(d, basePlate.sku)).toBe(5);
      expect(qty(d, cap.sku)).toBe(5);
    });

    it("has no base plates for in-ground mounting", () => {
      expect(qty(design([run(6000)]), basePlate.sku)).toBe(0);
    });

    it("picks a longer post when in-ground depth needs it", () => {
      // 24 slats at 9 mm is 1817 mm high, so 2417 mm in the ground
      const d = design([run(6000)], { gapMm: 9, slatCount: 24 });
      expect(qty(d, post3000.sku)).toBe(5);
      expect(qty(d, post2400.sku)).toBe(0);
    });

    it("uses the shorter post for the same height on base plates", () => {
      const d = design([run(6000)], {
        gapMm: 9,
        slatCount: 24,
        mounting: "base-plate",
      });
      expect(qty(d, post2400.sku)).toBe(5);
      expect(qty(d, post3000.sku)).toBe(0);
    });
  });

  describe("bad input", () => {
    it.each([
      ["below the minimum", 299],
      ["above the maximum", 50001],
      ["fractional", 3000.5],
      ["not a number", Number.NaN],
    ])("rejects a run length that is %s", (_label, lengthMm) => {
      expect(() => buildBom(design([run(lengthMm)]))).toThrow(RangeError);
    });

    it("accepts the run length limits", () => {
      expect(() => buildBom(design([run(300), run(50000)]))).not.toThrow();
    });

    it("rejects a slat count below one or fractional", () => {
      expect(() => buildBom(design([run(6000)], { slatCount: 0 }))).toThrow(
        RangeError,
      );
      expect(() => buildBom(design([run(6000)], { slatCount: 2.5 }))).toThrow(
        RangeError,
      );
    });

    it("rejects a fence over the max height", () => {
      // 30 slats at 5 mm is 2145 mm high
      expect(() => buildBom(design([run(6000)], { slatCount: 30 }))).toThrow(
        RangeError,
      );
    });

    it("rejects a gate width that is not a whole number in range", () => {
      for (const widthMm of [0, -900, 900.5, 599, 1201]) {
        expect(() =>
          buildBom(design([run(6000, { gate: { widthMm } })])),
        ).toThrow(RangeError);
      }
    });
  });
});

describe("layoutRuns", () => {
  it("reports the geometry per run", () => {
    const d = design([
      run(6000, { id: "a" }),
      run(4000, { id: "b", startsAtCorner: true }),
    ]);
    expect(layoutRuns(d)).toEqual([
      {
        runId: "a",
        lengthMm: 6000,
        sharesCorner: false,
        bays: 4,
        bayWidthsMm: [1500, 1500, 1500, 1500],
        bayWidthMm: 1500,
        posts: 5,
        slatCutMm: 1446,
        panelHeightMm: 1745,
        fenceHeightMm: 1795,
      },
      {
        runId: "b",
        lengthMm: 4000,
        sharesCorner: true,
        bays: 3,
        bayWidthsMm: [1333, 1333, 1333],
        bayWidthMm: 1333,
        posts: 3,
        slatCutMm: 1279,
        panelHeightMm: 1745,
        fenceHeightMm: 1795,
      },
    ]);
  });
});
