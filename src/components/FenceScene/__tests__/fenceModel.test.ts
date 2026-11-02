import { describe, expect, it } from "vitest";
import { buildBom, layoutRuns } from "@/engine/bom";
import type { Mounting, PanelDesign, Run, SlatDesign } from "@/engine/types";
import { layoutPanelRuns } from "@/engine/panelBom";
import { initialPanelDesign } from "@/lib/designReducer";
import { buildFenceModel, type Box } from "../fenceModel";

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

function modelOf(d: SlatDesign, index = 0) {
  return buildFenceModel(d, layoutRuns(d)[index]);
}

const bottom = (box: Box) => box.y - box.height / 2;
const top = (box: Box) => box.y + box.height / 2;
const left = (box: Box) => box.x - box.width / 2;
const right = (box: Box) => box.x + box.width / 2;

describe("buildFenceModel: the 6000 mm example", () => {
  const model = modelOf(design([plain]));

  it("has every slat at its real size", () => {
    expect(model.slats).toHaveLength(100);
    for (const slat of model.slats) {
      expect(slat.width).toBe(1446);
      expect(slat.height).toBe(65);
      expect(slat.depth).toBe(16);
    }
  });

  it("has one slatted panel per bay, spanning its slats", () => {
    expect(model.panels).toHaveLength(4);
    for (const panel of model.panels) {
      expect(panel.width).toBe(1446);
      expect(panel.depth).toBe(16);
      expect(bottom(panel)).toBe(50);
      expect(top(panel)).toBe(1795);
    }
  });

  it("describes the slat pattern across a panel", () => {
    expect(model.slatPeriodMm).toBe(70);
    expect(model.slatFaceFraction).toBeCloseTo(65 / 70);
  });

  it("has 5 square posts", () => {
    expect(model.posts).toHaveLength(5);
    for (const post of model.posts) {
      expect(post.width).toBe(50);
      expect(post.depth).toBe(50);
    }
  });

  it("leaves the 50 mm ground clearance under the bottom slat", () => {
    expect(Math.min(...model.slats.map(bottom))).toBe(50);
  });

  it("tops out at the fence height", () => {
    expect(Math.max(...model.slats.map(top))).toBe(1795);
    expect(Math.max(...model.posts.map(top))).toBe(1795);
    expect(model.heightMm).toBe(1795);
  });

  it("centres the run on the origin", () => {
    const extent = [...model.posts.map(left), ...model.posts.map(right)];
    expect(Math.min(...extent)).toBe(-Math.max(...extent));
    expect(model.spanMm).toBe(6050);
  });

  it("spaces posts at the bay width", () => {
    expect(model.posts[1].x - model.posts[0].x).toBe(1500);
  });
});

describe("buildFenceModel: mounting", () => {
  it("runs in-ground posts 600 mm below ground, with no plates", () => {
    const model = modelOf(design([plain]));
    expect(bottom(model.posts[0])).toBe(-600);
    expect(model.basePlates).toEqual([]);
  });

  it("stops base-plated posts at the ground, with a plate each", () => {
    const model = modelOf(design([plain], "base-plate"));
    expect(bottom(model.posts[0])).toBe(0);
    expect(model.basePlates).toHaveLength(5);
    for (const plate of model.basePlates) expect(bottom(plate)).toBe(0);
  });
});

describe("buildFenceModel: corners and gates", () => {
  const model = modelOf(design([plain, cornerGate]), 1);

  it("flags only the shared corner post", () => {
    expect(model.posts.map((p) => p.shared)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("hangs a gate leaf of the right width between the last two posts", () => {
    const gate = model.gate!;
    const [lastFencePost, farPost] = model.posts.slice(-2);
    expect(gate.widthMm).toBe(900);
    expect(gate.leaf.width).toBe(900);
    expect(left(gate.leaf)).toBeGreaterThan(right(lastFencePost));
    expect(right(gate.leaf)).toBeLessThan(left(farPost));
  });

  it("frames the leaf and hinges it on the fence side", () => {
    const gate = model.gate!;
    expect(gate.frame).toHaveLength(4);
    expect(gate.hinges).toHaveLength(2);
    for (const hinge of gate.hinges) {
      expect(hinge.x).toBe(left(gate.leaf));
    }
  });

  it("leaves slats out of the gate, as the BOM does", () => {
    expect(model.slats).toHaveLength(2 * 25);
  });

  it("has no gate on a plain run", () => {
    expect(modelOf(design([plain])).gate).toBeUndefined();
  });
});

// The 3D view must never disagree with what is being ordered.
describe("buildFenceModel matches the BOM", () => {
  const cases: [string, SlatDesign][] = [
    ["one run", design([plain])],
    ["corner and gate", design([plain, cornerGate])],
    ["base plate", design([plain, cornerGate], "base-plate")],
    ["short run", design([{ ...plain, lengthMm: 300 }])],
    ["long run", design([{ ...plain, lengthMm: 50000 }])],
  ];

  it.each(cases)("%s: solid posts total the BOM's posts", (_, d) => {
    const drawn = layoutRuns(d).reduce(
      (sum, layout) =>
        sum + buildFenceModel(d, layout).posts.filter((p) => !p.shared).length,
      0,
    );
    expect(drawn).toBe(buildBom(d).lines[0].qty);
  });
});

describe("buildFenceModel: steel panels", () => {
  const d: PanelDesign = {
    ...initialPanelDesign,
    sleeperType: "aluminium",
    sleepers: 1,
    runs: [
      { id: "a", lengthMm: 10000, startsAtCorner: false },
      {
        id: "b",
        lengthMm: 4000,
        startsAtCorner: true,
        gate: { widthMm: 930 },
      },
    ],
  };
  const [first, second] = layoutPanelRuns(d);
  const model = buildFenceModel(d, first);

  it("has sheets, rails and sleepers, and no slats", () => {
    expect(model.sheets).toHaveLength(13);
    expect(model.rails).toHaveLength(8);
    expect(model.sleepers).toHaveLength(4);
    expect(model.slats).toEqual([]);
    expect(model.panels).toEqual([]);
  });

  it("sits the sleepers on the ground, and tops out at the fence height", () => {
    for (const sleeper of model.sleepers) expect(bottom(sleeper)).toBe(0);
    expect(Math.max(...model.posts.map(top))).toBe(1950);
    expect(model.heightMm).toBe(1950);
  });

  it("flags the shared corner, and matches the layout's post count", () => {
    const corner = buildFenceModel(d, second);
    expect(corner.posts[0].shared).toBe(true);
    expect(corner.posts.filter((p) => !p.shared)).toHaveLength(second.posts);
    expect(corner.gate?.widthMm).toBe(930);
  });
});
