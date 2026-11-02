import { describe, expect, it } from "vitest";
import {
  buildPanelBom,
  layoutPanelRuns,
  recommendedPostLength,
} from "../panelBom";
import { PANEL_PRODUCTS as P, panelPost, panelSheet } from "../panelCatalogue";
import type { PanelDesign, Run } from "../types";

function run(lengthMm: number, overrides: Partial<Run> = {}): Run {
  return { id: "a", lengthMm, startsAtCorner: false, ...overrides };
}

function design(
  runs: Run[],
  overrides: Partial<PanelDesign> = {},
): PanelDesign {
  return {
    system: "panel",
    fenceHeightMm: 1800,
    sleepers: 0,
    postLengthMm: null,
    profile: "sawtooth",
    colour: "mist-grey",
    frameColour: "mist-grey",
    concrete: "post-mix",
    mounting: "in-ground",
    runs,
    ...overrides,
  };
}

function qty(d: PanelDesign, sku: string): number {
  return buildPanelBom(d).lines.find((l) => l.sku === sku)?.qty ?? 0;
}

const SHEET = panelSheet("sawtooth", 1800).sku;
const CHANNEL = panelPost("channel", 2400).sku;
const STEEL = panelPost("steel", 2400).sku;

// Quantities read from a published calculator, used as the reference.
describe("buildPanelBom matches the reference quantities", () => {
  it.each([
    // metres, standard panels, long panels, sheets
    [2500, 1, 0, 3],
    [2600, 0, 1, 4],
    [3000, 0, 1, 4],
    [3250, 0, 1, 4],
    [3300, 2, 0, 4],
    [4000, 2, 0, 5],
    [4900, 2, 0, 6],
    [5000, 1, 1, 7],
    [5600, 1, 1, 7],
    [5700, 3, 0, 7],
    [5750, 3, 0, 8],
    [6000, 3, 0, 8],
    [6500, 3, 0, 8],
    [7200, 3, 0, 9],
    [7350, 2, 1, 9],
    [7500, 2, 1, 10],
    [8800, 4, 0, 11],
    [9980, 3, 1, 13],
    [10000, 3, 1, 13],
    [12000, 5, 0, 15],
    [15000, 5, 1, 19],
    [17100, 6, 1, 22],
    [20000, 7, 1, 25],
    [33000, 14, 0, 42],
    [50000, 21, 0, 63],
  ])("%d mm", (lengthMm, standard, long, sheets) => {
    const d = design([run(lengthMm)]);
    const panels = standard + long;
    expect(qty(d, P.rail.sku)).toBe(standard * 2);
    expect(qty(d, P.longRail.sku)).toBe(long * 2);
    expect(qty(d, SHEET)).toBe(sheets);
    expect(qty(d, CHANNEL)).toBe(panels * 2);
    expect(qty(d, P.screw.sku)).toBe(panels * 12);
    expect(qty(d, STEEL)).toBe(2);
    expect(qty(d, P.cap.sku)).toBe(2);
  });

  it.each([
    [2500, 3],
    [5000, 5],
    [7500, 6],
    [10000, 8],
    [20000, 14],
  ])("%d mm takes %d bags of concrete", (lengthMm, bags) => {
    expect(qty(design([run(lengthMm)]), P.concretePostMix.sku)).toBe(bags);
  });

  // The reference counts the gate inside the run, and this field doesn't. Its
  // 10 m run with a gate left 4 panels, the last a 2 sheet cut, so 8800 matches.
  it("matches its 10 m run with a single gate", () => {
    const d = design([run(8800, { gate: { widthMm: 930 } })]);
    expect(qty(d, P.rail.sku)).toBe(8);
    expect(qty(d, SHEET)).toBe(12);
    expect(qty(d, CHANNEL)).toBe(8);
    expect(qty(d, STEEL)).toBe(4);
    expect(qty(d, P.cap.sku)).toBe(6);
    expect(qty(d, P.screw.sku)).toBe(64);
    expect(qty(d, P.gateKit.sku)).toBe(1);
    expect(qty(d, P.gateRail.sku)).toBe(2);
    expect(qty(d, P.gateStile.sku)).toBe(2);
    expect(qty(d, P.concretePostMix.sku)).toBe(11);
  });
});

describe("layoutPanelRuns", () => {
  it("spaces standard panels and leaves the rest to the last", () => {
    const [layout] = layoutPanelRuns(design([run(10000)]));
    expect(layout.bayWidthsMm).toEqual([2400, 2400, 2400, 2700]);
    expect(layout.bays).toBe(4);
    expect(layout.posts).toBe(5);
    expect(layout.panels.map((p) => p.kind)).toEqual([
      "standard",
      "standard",
      "standard",
      "long",
    ]);
  });

  it("makes the bays add up to the run, less the end allowance", () => {
    for (const length of [2500, 3000, 4000, 6000, 12345, 99999]) {
      const [layout] = layoutPanelRuns(design([run(length)]));
      const total = layout.bayWidthsMm.reduce((sum, w) => sum + w, 0);
      expect(total).toBe(length - 100);
    }
  });

  it("flags panels that need cutting down", () => {
    const cut = (length: number) =>
      layoutPanelRuns(design([run(length)]))[0].panels.map((p) => p.cutDown);
    expect(cut(2500)).toEqual([false]);
    expect(cut(4000)).toEqual([false, true]);
    expect(cut(3000)).toEqual([true]); // a long panel, under its full 3180 mm
    expect(cut(3280)).toEqual([false]); // exactly a full long panel
    expect(cut(4900)).toEqual([false, false]); // exactly two standard panels
  });

  it("counts a shared corner as one fewer post", () => {
    const layouts = layoutPanelRuns(
      design([run(5000), run(5000, { id: "b", startsAtCorner: true })]),
    );
    expect(layouts.map((l) => l.posts)).toEqual([3, 2]);
    expect(layouts[1].sharesCorner).toBe(true);
  });

  it("ignores the corner flag on the first run", () => {
    const [layout] = layoutPanelRuns(
      design([run(5000, { startsAtCorner: true })]),
    );
    expect(layout.sharesCorner).toBe(false);
    expect(layout.posts).toBe(3);
  });

  it("adds two posts for a gate", () => {
    const [layout] = layoutPanelRuns(
      design([run(5000, { gate: { widthMm: 930 } })]),
    );
    expect(layout.posts).toBe(5);
    expect(layout.gateOpeningMm).toBe(970);
  });

  it("adds sleepers to the height above ground", () => {
    const [layout] = layoutPanelRuns(
      design([run(5000)], { fenceHeightMm: 2100, sleepers: 2 }),
    );
    expect(layout.fenceHeightMm).toBe(2400);
    expect(layout.sheetHeightMm).toBe(2090);
    expect(layout.sleeperHeightMm).toBe(300);
  });
});

describe("post lengths", () => {
  it.each([
    [1200, 0, 1800],
    [1500, 0, 2100],
    [1800, 0, 2400],
    [2100, 0, 2700],
    [1800, 1, 2700],
    [1800, 2, 2700],
    [2100, 2, 3000],
  ] as const)("%d mm with %d sleepers recommends %d", (h, sleepers, post) => {
    expect(
      recommendedPostLength(design([], { fenceHeightMm: h, sleepers })),
    ).toBe(post);
  });

  it("needs no in-ground depth on base plates", () => {
    const d = design([], { mounting: "base-plate" });
    expect(recommendedPostLength(d)).toBe(1800);
  });

  it("uses the recommended length unless one is chosen", () => {
    expect(qty(design([run(5000)]), panelPost("channel", 2400).sku)).toBe(4);
    const chosen = design([run(5000)], { postLengthMm: 3000 });
    expect(qty(chosen, panelPost("channel", 3000).sku)).toBe(4);
    expect(qty(chosen, panelPost("steel", 3000).sku)).toBe(2);
    expect(qty(chosen, panelPost("channel", 2400).sku)).toBe(0);
  });

  it("allows a short post for fixing to a structure, down to the panel", () => {
    const short = design([run(5000)], { postLengthMm: 1800 });
    expect(qty(short, panelPost("channel", 1800).sku)).toBe(4);
  });

  it("rejects a post shorter than the fence", () => {
    const bad = design([run(5000)], { postLengthMm: 1500 });
    expect(() => buildPanelBom(bad)).toThrow(RangeError);
  });
});

describe("buildPanelBom options", () => {
  it("prices sheets by height and profile", () => {
    const d = design([run(2500)], { fenceHeightMm: 1200, profile: "trimline" });
    expect(qty(d, panelSheet("trimline", 1200).sku)).toBe(3);
    expect(qty(d, SHEET)).toBe(0);
  });

  it("adds a sleeper per panel per row, matching the rail length", () => {
    const d = design([run(10000)], { sleepers: 2 });
    expect(qty(d, P.sleeper.sku)).toBe(6);
    expect(qty(d, P.longSleeper.sku)).toBe(2);
  });

  it("has no sleepers by default", () => {
    expect(qty(design([run(10000)]), P.sleeper.sku)).toBe(0);
  });

  it("swaps the concrete type, or leaves it out", () => {
    const d = (concrete: PanelDesign["concrete"]) =>
      design([run(10000)], { concrete });
    expect(qty(d("rapid-set"), P.concreteRapidSet.sku)).toBe(8);
    expect(qty(d("rapid-set"), P.concretePostMix.sku)).toBe(0);
    expect(qty(d("none"), P.concretePostMix.sku)).toBe(0);
  });

  it("uses a plate per post and no concrete on base plates", () => {
    const d = design([run(10000)], { mounting: "base-plate" });
    expect(qty(d, P.basePlate.sku)).toBe(5);
    expect(qty(d, P.concretePostMix.sku)).toBe(0);
  });

  it("adds up concrete across runs, sharing the corner's hole", () => {
    const d = design([run(5000), run(5000, { id: "b", startsAtCorner: true })]);
    // 3 + 2 holes at 1.5 bags.
    expect(qty(d, P.concretePostMix.sku)).toBe(8);
    expect(qty(d, STEEL)).toBe(3);
  });

  it("orders no cuts, because rails are sold per panel", () => {
    expect(buildPanelBom(design([run(6000)])).cuts).toEqual([]);
  });
});

describe("bad input", () => {
  it.each([2499, 100001, 3000.5, Number.NaN])("rejects a %d mm run", (mm) => {
    expect(() => buildPanelBom(design([run(mm)]))).toThrow(RangeError);
  });

  it("rejects a gate other than the single gate", () => {
    const d = design([run(5000, { gate: { widthMm: 900 } })]);
    expect(() => buildPanelBom(d)).toThrow(RangeError);
  });

  it("rejects a height with no sheet", () => {
    expect(() =>
      buildPanelBom(design([run(5000)], { fenceHeightMm: 1650 })),
    ).toThrow(RangeError);
  });

  it("is an empty order with no runs", () => {
    expect(buildPanelBom(design([]))).toEqual({ lines: [], cuts: [] });
  });
});
