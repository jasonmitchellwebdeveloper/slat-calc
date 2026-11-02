import { describe, expect, it } from "vitest";
import {
  designReducer,
  initialDesign,
  initialPanelDesign,
  type DesignAction,
} from "../designReducer";
import type { Design, PanelDesign, SlatDesign } from "@/engine/types";

const twoRuns: Design = {
  ...initialDesign,
  runs: [
    { id: "run-1", lengthMm: 6000, startsAtCorner: false },
    { id: "run-2", lengthMm: 3000, startsAtCorner: true },
  ],
};

const slatReducer = (design: Design, action: DesignAction) =>
  designReducer(design, action) as SlatDesign;

describe("designReducer: height", () => {
  it("selects the closest build when the current one is no longer offered", () => {
    const next = slatReducer(initialDesign, {
      type: "setTargetHeight",
      mm: 1200,
    });
    expect(next.targetHeightMm).toBe(1200);
    // Fence heights either side of 1200 mm, with 50 mm clearance included:
    // 5 mm gap: 16 slats 1165, 17 slats 1235. Both 35 away.
    // 9 mm gap: 15 slats 1151, 16 slats 1225. Closest is 25 away.
    // 20 mm gap: 13 slats 1135, 14 slats 1220. Closest is 20 away.
    expect(next.gapMm).toBe(20);
    expect(next.slatCount).toBe(14);
  });

  it("keeps a chosen build while it is still offered", () => {
    const chosen = slatReducer(initialDesign, {
      type: "selectHeight",
      gapMm: 9,
      slatCount: 24,
    });
    const next = slatReducer(chosen, { type: "setTargetHeight", mm: 1790 });
    expect(next.gapMm).toBe(9);
    expect(next.slatCount).toBe(24);
  });

  it("keeps the last build while the target cannot be built", () => {
    for (const mm of [Number.NaN, 18, 5000]) {
      const next = slatReducer(initialDesign, {
        type: "setTargetHeight",
        mm,
      });
      expect(next.targetHeightMm).toBe(mm);
      expect(next.slatCount).toBe(initialDesign.slatCount);
      expect(next.gapMm).toBe(initialDesign.gapMm);
    }
  });
});

describe("designReducer: colour and mounting", () => {
  it("sets the colour", () => {
    const next = designReducer(initialDesign, {
      type: "setColour",
      colour: "woodgrain",
    });
    expect(next.colour).toBe("woodgrain");
  });

  it("sets the mounting", () => {
    const next = designReducer(initialDesign, {
      type: "setMounting",
      mounting: "base-plate",
    });
    expect(next.mounting).toBe("base-plate");
  });
});

describe("designReducer: runs", () => {
  it("adds a run with a valid length and no corner or gate", () => {
    const next = designReducer(initialDesign, { type: "addRun" });
    expect(next.runs).toHaveLength(2);
    expect(next.runs[1]).toEqual({
      id: "run-2",
      lengthMm: 3000,
      startsAtCorner: false,
    });
  });

  it("never reuses the id of a run still in the design", () => {
    const removed = designReducer(twoRuns, { type: "removeRun", id: "run-1" });
    const next = designReducer(removed, { type: "addRun" });
    const ids = next.runs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("removes a run", () => {
    const next = designReducer(twoRuns, { type: "removeRun", id: "run-2" });
    expect(next.runs.map((r) => r.id)).toEqual(["run-1"]);
  });

  it("keeps at least one run", () => {
    const next = designReducer(initialDesign, {
      type: "removeRun",
      id: "run-1",
    });
    expect(next.runs).toHaveLength(1);
  });

  it("clears the corner flag on a run that becomes the first", () => {
    const next = designReducer(twoRuns, { type: "removeRun", id: "run-1" });
    expect(next.runs[0].id).toBe("run-2");
    expect(next.runs[0].startsAtCorner).toBe(false);
  });

  it("changes only the targeted run", () => {
    const next = designReducer(twoRuns, {
      type: "setRunLength",
      id: "run-2",
      mm: 4500,
    });
    expect(next.runs[0].lengthMm).toBe(6000);
    expect(next.runs[1].lengthMm).toBe(4500);
  });

  it("toggles the corner flag", () => {
    const next = designReducer(twoRuns, {
      type: "setCorner",
      id: "run-2",
      startsAtCorner: false,
    });
    expect(next.runs[1].startsAtCorner).toBe(false);
  });

  it("adds a gate at the default width, then removes it", () => {
    const gated = designReducer(twoRuns, {
      type: "setGate",
      id: "run-2",
      hasGate: true,
    });
    expect(gated.runs[1].gate).toEqual({ widthMm: 900 });

    const ungated = designReducer(gated, {
      type: "setGate",
      id: "run-2",
      hasGate: false,
    });
    expect(ungated.runs[1].gate).toBeUndefined();
  });

  it("sets the gate width", () => {
    const gated = designReducer(twoRuns, {
      type: "setGate",
      id: "run-2",
      hasGate: true,
    });
    const next = designReducer(gated, {
      type: "setGateWidth",
      id: "run-2",
      mm: 1000,
    });
    expect(next.runs[1].gate).toEqual({ widthMm: 1000 });
  });
});

describe("designReducer: fence type", () => {
  const toPanel = (design: Design = initialDesign) =>
    designReducer(design, { type: "setSystem", system: "panel" });

  it("switches type and uses that type's defaults", () => {
    const next = toPanel();
    expect(next).toEqual({ ...initialPanelDesign, runs: initialDesign.runs });
  });

  it("does nothing when the type is unchanged", () => {
    const panel = toPanel();
    expect(designReducer(panel, { type: "setSystem", system: "panel" })).toBe(
      panel,
    );
  });

  it("keeps runs, mounting and corners, within the new limits", () => {
    const slat: Design = {
      ...initialDesign,
      mounting: "base-plate",
      runs: [
        { id: "run-1", lengthMm: 300, startsAtCorner: false },
        { id: "run-2", lengthMm: 4000, startsAtCorner: true },
      ],
    };
    const next = toPanel(slat);
    expect(next.mounting).toBe("base-plate");
    expect(next.runs.map((r) => r.lengthMm)).toEqual([2500, 4000]);
    expect(next.runs[1].startsAtCorner).toBe(true);
  });

  it("limits a long panel run when going back to slat", () => {
    const panel: Design = {
      ...initialPanelDesign,
      runs: [{ id: "run-1", lengthMm: 90000, startsAtCorner: false }],
    };
    const next = designReducer(panel, { type: "setSystem", system: "slat" });
    expect(next.runs[0].lengthMm).toBe(50000);
  });

  it("replaces a half-typed length with a valid one", () => {
    const slat: Design = {
      ...initialDesign,
      runs: [{ id: "run-1", lengthMm: Number.NaN, startsAtCorner: false }],
    };
    expect(toPanel(slat).runs[0].lengthMm).toBe(3000);
  });

  it("uses the single gate on a panel fence, whatever the slat gate was", () => {
    const slat: Design = {
      ...initialDesign,
      runs: [
        {
          id: "run-1",
          lengthMm: 6000,
          startsAtCorner: false,
          gate: { widthMm: 1100 },
        },
      ],
    };
    expect(toPanel(slat).runs[0].gate).toEqual({ widthMm: 930 });
  });

  it("gives a new gate the panel width on a panel fence", () => {
    const next = designReducer(toPanel(), {
      type: "setGate",
      id: "run-1",
      hasGate: true,
    });
    expect(next.runs[0].gate).toEqual({ widthMm: 930 });
  });
});

describe("designReducer: panel options", () => {
  const panel: PanelDesign = { ...initialPanelDesign, postLengthMm: 3000 };

  it.each([
    ["height", { type: "setFenceHeight", mm: 1500 } as const],
    ["mounting", { type: "setMounting", mounting: "base-plate" } as const],
  ])("returns to the recommended post when %s changes", (_, action) => {
    const next = designReducer(panel, action) as PanelDesign;
    expect(next.postLengthMm).toBeNull();
  });

  it("sets the remaining options", () => {
    const apply = (action: DesignAction) =>
      designReducer(panel, action) as PanelDesign;
    expect(apply({ type: "setPostLength", mm: 2700 }).postLengthMm).toBe(2700);
    expect(apply({ type: "setProfile", profile: "trimline" }).profile).toBe(
      "trimline",
    );
    expect(apply({ type: "setConcrete", concrete: "none" }).concrete).toBe(
      "none",
    );
    expect(
      apply({ type: "setFrameColour", colour: "terracotta" }).frameColour,
    ).toBe("terracotta");
  });

  it("ignores options that belong to the other fence type", () => {
    expect(
      designReducer(initialDesign, { type: "setFenceHeight", mm: 1500 }),
    ).toBe(initialDesign);
    expect(designReducer(panel, { type: "setTargetHeight", mm: 1500 })).toBe(
      panel,
    );
  });
});

describe("designReducer: frame colour", () => {
  it("follows the infill by default", () => {
    expect(initialPanelDesign.frameColour).toBeNull();
  });

  it("starts a separate frame colour from the current infill", () => {
    const panel: PanelDesign = { ...initialPanelDesign, colour: "terracotta" };
    const next = designReducer(panel, {
      type: "setFrameMatchesInfill",
      matches: false,
    }) as PanelDesign;
    expect(next.frameColour).toBe("terracotta");
  });

  it("goes back to following the infill", () => {
    const panel: PanelDesign = {
      ...initialPanelDesign,
      frameColour: "slate-grey",
    };
    const next = designReducer(panel, {
      type: "setFrameMatchesInfill",
      matches: true,
    }) as PanelDesign;
    expect(next.frameColour).toBeNull();
  });

  it("keeps a chosen frame colour when the infill changes", () => {
    const panel: PanelDesign = {
      ...initialPanelDesign,
      frameColour: "slate-grey",
    };
    const next = designReducer(panel, {
      type: "setColour",
      colour: "off-white",
    }) as PanelDesign;
    expect(next.frameColour).toBe("slate-grey");
  });
});

describe("designReducer: sleepers", () => {
  const set = (design: PanelDesign, sleeperType: PanelDesign["sleeperType"]) =>
    designReducer(design, {
      type: "setSleeperType",
      sleeperType,
    }) as PanelDesign;

  it("starts at one row when a material is chosen", () => {
    const next = set(initialPanelDesign, "aluminium");
    expect(next.sleeperType).toBe("aluminium");
    expect(next.sleepers).toBe(1);
  });

  it("keeps the quantity when changing material", () => {
    const two: PanelDesign = {
      ...initialPanelDesign,
      sleeperType: "aluminium",
      sleepers: 2,
    };
    expect(set(two, "dressed-timber").sleepers).toBe(2);
  });

  it("clears the quantity when set back to none", () => {
    const two: PanelDesign = {
      ...initialPanelDesign,
      sleeperType: "aluminium",
      sleepers: 2,
    };
    const next = set(two, "none");
    expect(next.sleeperType).toBe("none");
    expect(next.sleepers).toBe(0);
  });

  it("leaves a chosen post alone, as sleepers don't change it", () => {
    const chosen: PanelDesign = { ...initialPanelDesign, postLengthMm: 2700 };
    expect(set(chosen, "aluminium").postLengthMm).toBe(2700);
  });
});
