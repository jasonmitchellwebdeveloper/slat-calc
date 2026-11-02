import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";
import { initialDesign } from "../designReducer";
import { designSearch, readDesignFromSearch } from "../designUrl";
import type { Design, PanelDesign } from "@/engine/types";

const twoRuns: Design = {
  system: "slat",
  targetHeightMm: 1800,
  gapMm: 9,
  slatCount: 24,
  colour: "woodgrain",
  mounting: "base-plate",
  runs: [
    { id: "run-1", lengthMm: 6000, startsAtCorner: false },
    {
      id: "run-2",
      lengthMm: 3000,
      startsAtCorner: true,
      gate: { widthMm: 900 },
    },
  ],
};

function searchFor(value: unknown): string {
  return `?d=${compressToEncodedURIComponent(JSON.stringify(value))}`;
}

function expectRejected(search: string) {
  expect(readDesignFromSearch(search)).toEqual({
    design: initialDesign,
    linkInvalid: true,
  });
}

describe("reading a design from the URL", () => {
  it("round-trips a design exactly", () => {
    expect(readDesignFromSearch(designSearch(twoRuns))).toEqual({
      design: twoRuns,
      linkInvalid: false,
    });
  });

  it("opens a link from before fence types existed as a slat design", () => {
    const oldDesign: Partial<Design> = { ...twoRuns };
    delete oldDesign.system;
    expect(readDesignFromSearch(searchFor(oldDesign))).toEqual({
      design: twoRuns,
      linkInvalid: false,
    });
  });

  it("uses the default design when there is no link", () => {
    for (const search of ["", "?", "?utm_source=email"]) {
      expect(readDesignFromSearch(search)).toEqual({
        design: initialDesign,
        linkInvalid: false,
      });
    }
  });

  it("clears a corner flag on the first run, which has no post to share", () => {
    const value = {
      ...twoRuns,
      runs: [{ ...twoRuns.runs[0], startsAtCorner: true }],
    };
    const { design } = readDesignFromSearch(searchFor(value));
    expect(design.runs[0].startsAtCorner).toBe(false);
  });
});

describe("rejecting a bad link", () => {
  it("rejects text that isn't a compressed design", () => {
    expectRejected("?d=not-a-design");
    expectRejected("?d=");
  });

  it("rejects compressed text that isn't JSON", () => {
    expectRejected(`?d=${compressToEncodedURIComponent("{oops")}`);
  });

  it("rejects an oversized link before decompressing it", () => {
    expectRejected(`?d=${"a".repeat(5000)}`);
  });

  it.each([
    ["a null design", null],
    ["a missing field", { ...twoRuns, colour: undefined }],
    ["an unknown colour", { ...twoRuns, colour: "neon" }],
    ["an unknown gap", { ...twoRuns, gapMm: 7 }],
    ["an unknown mounting", { ...twoRuns, mounting: "floating" }],
    ["no runs", { ...twoRuns, runs: [] }],
    ["a fractional length", runWith({ lengthMm: 6000.5 })],
    ["a length as text", runWith({ lengthMm: "6000" })],
    ["a length out of range", runWith({ lengthMm: 12 })],
    ["a gate out of range", runWith({ gate: { widthMm: 50 } })],
    ["a badly formed run id", runWith({ id: "<script>" })],
  ])("rejects %s", (_, value) => {
    expectRejected(searchFor(value));
  });

  it("rejects duplicate run ids", () => {
    const run = twoRuns.runs[0];
    expectRejected(searchFor({ ...twoRuns, runs: [run, run] }));
  });

  it("rejects more runs than the form could sensibly show", () => {
    const runs = Array.from({ length: 51 }, (_, i) => ({
      id: `run-${i + 1}`,
      lengthMm: 1000,
      startsAtCorner: false,
    }));
    expectRejected(searchFor({ ...twoRuns, runs }));
  });

  it("rejects a target height that can't be built", () => {
    expectRejected(searchFor({ ...twoRuns, targetHeightMm: 5000 }));
  });

  it("rejects a build the solver doesn't offer for that target", () => {
    expectRejected(searchFor({ ...twoRuns, slatCount: 3 }));
  });
});

function runWith(change: object): object {
  return { ...twoRuns, runs: [{ ...twoRuns.runs[0], ...change }] };
}

describe("steel panel links", () => {
  const panel: PanelDesign = {
    system: "panel",
    fenceHeightMm: 2100,
    sleepers: 1,
    postLengthMm: 3000,
    profile: "trimline",
    colour: "off-white",
    frameColour: "deep-charcoal",
    concrete: "none",
    mounting: "in-ground",
    runs: [
      { id: "run-1", lengthMm: 10000, startsAtCorner: false },
      {
        id: "run-2",
        lengthMm: 4000,
        startsAtCorner: true,
        gate: { widthMm: 930 },
      },
    ],
  };

  it("round-trips a frame that follows the infill", () => {
    const matching: PanelDesign = { ...panel, frameColour: null };
    expect(readDesignFromSearch(designSearch(matching))).toEqual({
      design: matching,
      linkInvalid: false,
    });
  });

  it("round-trips exactly", () => {
    expect(readDesignFromSearch(designSearch(panel))).toEqual({
      design: panel,
      linkInvalid: false,
    });
  });

  it.each([
    ["a height with no sheet", { fenceHeightMm: 1650 }],
    ["a slat colour", { colour: "woodgrain" }],
    ["too many sleepers", { sleepers: 3 }],
    ["a post under the fence", { postLengthMm: 1800 }],
    ["an unknown concrete", { concrete: "gravel" }],
    [
      "a run that's too short",
      { runs: [{ id: "run-1", lengthMm: 2000, startsAtCorner: false }] },
    ],
    [
      "a gate of the wrong width",
      {
        runs: [
          {
            id: "run-1",
            lengthMm: 5000,
            startsAtCorner: false,
            gate: { widthMm: 800 },
          },
        ],
      },
    ],
  ])("rejects %s", (_, change) => {
    expectRejected(searchFor({ ...panel, ...change }));
  });

  it("rejects an unknown fence type", () => {
    expectRejected(searchFor({ ...panel, system: "picket" }));
  });
});
