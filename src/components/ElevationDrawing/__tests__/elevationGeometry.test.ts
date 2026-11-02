import { describe, expect, it } from "vitest";
import { buildBom, layoutRuns } from "@/engine/bom";
import type { Mounting, PanelDesign, Run, SlatDesign } from "@/engine/types";
import { layoutPanelRuns } from "@/engine/panelBom";
import { initialPanelDesign } from "@/lib/designReducer";
import { buildElevation, describeElevation } from "../elevationGeometry";

function design(runs: Run[], mounting: Mounting = "in-ground"): SlatDesign {
  return {
    system: "slat",
    targetHeightMm: 1800,
    gapMm: 5,
    slatCount: 25,
    colour: "charcoal",
    mounting,
    runs,
  };
}

const plain: Run = { id: "a", lengthMm: 6000, startsAtCorner: false };
const cornerGate: Run = {
  id: "b",
  lengthMm: 3000,
  startsAtCorner: true,
  gate: { widthMm: 900 },
};

function elevationOf(d: SlatDesign, index = 0) {
  return buildElevation(d, layoutRuns(d)[index]);
}

describe("buildElevation: the 6000 mm example", () => {
  const e = elevationOf(design([plain]));

  it("places a 50 mm post centred on each bay boundary", () => {
    expect(e.posts).toHaveLength(5);
    const spacing = e.posts.map((p, i) =>
      i === 0 ? 0 : p.x - e.posts[i - 1].x,
    );
    expect(spacing).toEqual([0, 1500, 1500, 1500, 1500]);
    expect(e.posts.every((p) => p.width === 50)).toBe(true);
  });

  it("draws every slat in every bay at the cut length", () => {
    expect(e.slats).toHaveLength(4 * 25);
    expect(e.slats.every((s) => s.width === 1446 && s.height === 65)).toBe(
      true,
    );
  });

  it("fits each slat between its posts with the channel clearance", () => {
    const first = e.slats[0];
    const post = e.posts[0];
    expect(first.x).toBe(post.x + post.width + 2);
    expect(first.x + first.width + 2).toBe(e.posts[1].x);
  });

  it("stacks slats at the slat face plus the gap", () => {
    const column = e.slats.filter((s) => s.x === e.slats[0].x);
    expect(column).toHaveLength(25);
    expect(column[1].y - column[0].y).toBe(70);
  });

  it("leaves the 50 mm ground clearance under the bottom slat", () => {
    const lowest = Math.max(...e.slats.map((s) => s.y + s.height));
    expect(e.groundY - lowest).toBe(50);
  });

  it("makes the top slat meet the top of the fence", () => {
    const highest = Math.min(...e.slats.map((s) => s.y));
    expect(highest).toBe(e.fenceTopY);
    expect(e.groundY - e.fenceTopY).toBe(1795);
  });

  it("labels each bay at its centre with its width", () => {
    expect(e.bays).toHaveLength(4);
    expect(e.bays.every((b) => b.widthMm === 1500)).toBe(true);
    expect(e.bays[1].centreX - e.bays[0].centreX).toBe(1500);
  });

  it("spans the fence dimension across the run", () => {
    expect(e.fenceSpan.toX - e.fenceSpan.fromX).toBe(6000);
    expect(e.fenceSpan.lengthMm).toBe(6000);
  });
});

describe("buildElevation: mounting", () => {
  it("runs in-ground posts 600 mm below the ground line", () => {
    const e = elevationOf(design([plain]));
    expect(e.posts[0].y + e.posts[0].height - e.groundY).toBe(600);
    expect(e.basePlates).toEqual([]);
  });

  it("stops base-plated posts at the ground, with one plate per post", () => {
    const e = elevationOf(design([plain], "base-plate"));
    expect(e.posts[0].y + e.posts[0].height).toBe(e.groundY);
    expect(e.basePlates).toHaveLength(5);
  });
});

describe("buildElevation: corners and gates", () => {
  const d = design([plain, cornerGate]);
  const e = elevationOf(d, 1);

  it("marks the shared corner post as not belonging to this run", () => {
    expect(e.posts[0].shared).toBe(true);
    expect(e.posts.slice(1).every((p) => !p.shared)).toBe(true);
  });

  it("ignores the corner flag on the first run", () => {
    const first = elevationOf(design([{ ...plain, startsAtCorner: true }]));
    expect(first.posts[0].shared).toBe(false);
  });

  it("draws the gate leaf in the opening, clear of both posts", () => {
    const gate = e.gate!;
    const lastFencePost = e.posts[e.posts.length - 2];
    const farPost = e.posts[e.posts.length - 1];
    expect(gate.widthMm).toBe(900);
    expect(gate.leaf.width).toBe(900);
    // 900 mm leaf plus the 40 mm hinge and latch allowance.
    expect(farPost.x - (lastFencePost.x + lastFencePost.width)).toBe(940);
    expect(gate.leaf.x).toBeGreaterThan(lastFencePost.x + lastFencePost.width);
    expect(gate.leaf.x + gate.leaf.width).toBeLessThan(farPost.x);
  });

  it("marks the hinge side against the last fence post", () => {
    const gate = e.gate!;
    expect(gate.hinges).toHaveLength(2);
    for (const hinge of gate.hinges) {
      expect(hinge.x).toBeLessThanOrEqual(gate.leaf.x);
    }
  });

  it("leaves the gate out of the slats, as the BOM does", () => {
    expect(e.slats).toHaveLength(2 * 25);
  });
});

describe("buildElevation: short runs", () => {
  const e = elevationOf(design([{ ...plain, lengthMm: 300 }]));

  it("keeps a minimum drawing width so labels stay in proportion", () => {
    expect(e.width).toBe(4000);
  });

  it("centres the fence in the spare width", () => {
    const left = e.posts[0].x;
    const last = e.posts[e.posts.length - 1];
    const right = e.width - (last.x + last.width);
    // The left margin stays wider, as it holds the height dimension. The
    // spare 2935 mm doesn't halve into whole mm, so the right gets the extra 1.
    expect(left - right).toBe(620 - 25 - 120 - 1);
  });

  it("leaves out the bay label when it would repeat the overall length", () => {
    expect(e.bays).toEqual([]);
  });
});

// The picture must never disagree with what is being ordered.
describe("buildElevation matches the BOM", () => {
  const cases: [string, SlatDesign][] = [
    ["one run", design([plain])],
    ["corner and gate", design([plain, cornerGate])],
    ["base plate", design([plain, cornerGate], "base-plate")],
    ["short run", design([{ ...plain, lengthMm: 300 }])],
    ["long run", design([{ ...plain, lengthMm: 50000 }])],
  ];

  it.each(cases)("%s: solid posts total the BOM's posts", (_, d) => {
    const layouts = layoutRuns(d);
    const drawn = layouts.reduce(
      (sum, layout) =>
        sum + buildElevation(d, layout).posts.filter((p) => !p.shared).length,
      0,
    );
    const postLine = buildBom(d).lines[0];
    expect(drawn).toBe(postLine.qty);
  });

  it.each(cases)("%s: everything sits inside the drawing", (_, d) => {
    for (const layout of layoutRuns(d)) {
      const e = buildElevation(d, layout);
      const shapes = [...e.posts, ...e.slats, ...e.basePlates];
      for (const s of shapes) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.x + s.width).toBeLessThanOrEqual(e.width);
        expect(s.y + s.height).toBeLessThanOrEqual(e.height);
      }
    }
  });
});

describe("describeElevation", () => {
  it("summarises a plain run", () => {
    const d = design([plain]);
    expect(describeElevation(layoutRuns(d)[0], 0)).toBe(
      "Run 1: 6000 mm, 4 bays, 1795 mm high.",
    );
  });

  it("mentions a shared corner post and a gate", () => {
    const d = design([plain, cornerGate]);
    expect(describeElevation(layoutRuns(d)[1], 1)).toBe(
      "Run 2: 3000 mm, 2 bays, 1795 mm high. Starts at a shared corner post. Ends with a 900 mm gate.",
    );
  });

  it("uses the singular for one bay", () => {
    const d = design([{ ...plain, lengthMm: 1000 }]);
    expect(describeElevation(layoutRuns(d)[0], 0)).toContain("1 bay,");
  });
});

describe("buildElevation: steel panels", () => {
  const panelDesign = (
    runs: Run[],
    overrides: Partial<PanelDesign> = {},
  ): PanelDesign => ({ ...initialPanelDesign, runs, ...overrides });
  const of = (d: PanelDesign, index = 0) =>
    buildElevation(d, layoutPanelRuns(d)[index]);
  const longRun: Run = { id: "a", lengthMm: 10000, startsAtCorner: false };

  it("spaces posts by each panel's own width", () => {
    const e = of(panelDesign([longRun]));
    const gaps = e.posts.slice(1).map((p, i) => p.x - e.posts[i].x);
    expect(gaps).toEqual([2400, 2400, 2400, 2700]);
  });

  it("draws every sheet and two rails per panel, and no slats", () => {
    const e = of(panelDesign([longRun]));
    expect(e.sheets).toHaveLength(13);
    expect(e.rails).toHaveLength(8);
    expect(e.slats).toEqual([]);
  });

  it("marks only cut panels", () => {
    const e = of(panelDesign([{ ...longRun, lengthMm: 4000 }]));
    expect(e.bays.map((b) => b.cut)).toEqual([false, true]);
  });

  it("sits sleepers on the ground, under the panel", () => {
    const e = of(panelDesign([longRun], { sleepers: 2 }));
    expect(e.sleepers).toHaveLength(4);
    expect(e.sleepers[0].y + e.sleepers[0].height).toBe(e.groundY);
    expect(e.groundY - e.fenceTopY).toBe(2100);
  });

  it("runs posts below ground by what the post length leaves", () => {
    const e = of(panelDesign([longRun], { postLengthMm: 3000 }));
    expect(e.posts[0].y + e.posts[0].height - e.groundY).toBe(1200);
    const short = of(panelDesign([longRun], { postLengthMm: 1800 }));
    expect(short.posts[0].y + short.posts[0].height).toBe(short.groundY);
  });

  it("uses a plate per post on base plates", () => {
    const e = of(panelDesign([longRun], { mounting: "base-plate" }));
    expect(e.basePlates).toHaveLength(5);
    expect(e.posts[0].y + e.posts[0].height).toBe(e.groundY);
  });

  it("puts the gate between its own two posts", () => {
    const e = of(panelDesign([{ ...longRun, gate: { widthMm: 930 } }]));
    const [near, far] = e.posts.slice(-2);
    expect(e.gate!.leaf.width).toBe(930);
    expect(e.gate!.leaf.x).toBeGreaterThan(near.x + near.width);
    expect(e.gate!.leaf.x + 930).toBeLessThan(far.x);
    expect(e.posts).toHaveLength(7);
  });

  it.each([
    ["one run", [longRun]],
    ["short", [{ ...longRun, lengthMm: 2500 }]],
    ["long", [{ ...longRun, lengthMm: 100000 }]],
    [
      "corner and gate",
      [
        longRun,
        {
          id: "b",
          lengthMm: 4000,
          startsAtCorner: true,
          gate: { widthMm: 930 },
        },
      ],
    ],
  ] as [string, Run[]][])(
    "%s: solid posts match, and fit the drawing",
    (_, runs) => {
      const d = panelDesign(runs);
      const layouts = layoutPanelRuns(d);
      layouts.forEach((layout) => {
        const e = buildElevation(d, layout);
        expect(e.posts.filter((p) => !p.shared)).toHaveLength(layout.posts);
        for (const s of [...e.posts, ...e.sheets, ...e.rails]) {
          expect(s.x).toBeGreaterThanOrEqual(0);
          expect(s.x + s.width).toBeLessThanOrEqual(e.width);
          expect(s.y + s.height).toBeLessThanOrEqual(e.height);
        }
      });
    },
  );

  it("describes panels, not bays", () => {
    const [layout] = layoutPanelRuns(panelDesign([longRun]));
    expect(describeElevation(layout, 0)).toBe(
      "Run 1: 10000 mm, 4 panels, 1800 mm high.",
    );
  });
});
