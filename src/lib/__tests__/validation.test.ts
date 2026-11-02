import { describe, expect, it } from "vitest";
import { calculate } from "@/engine/calculate";
import type { Design } from "@/engine/types";
import { initialDesign } from "../designReducer";
import {
  formatLength,
  gateWidthError,
  parseLengthMm,
  runLengthError,
  targetHeightError,
} from "../validation";

function isOk(design: Design): boolean {
  return calculate(design, { tier: "retail" }).ok;
}

describe("parseLengthMm in metres", () => {
  it.each([
    ["6", 6000],
    ["2.4", 2400],
    [" 2.4 ", 2400],
    ["1.8", 1800],
    ["0.9", 900],
    [".5", 500],
    ["2.", 2000],
    ["1.1", 1100],
    ["4.35", 4350],
    ["1.005", 1005],
    ["2.4000", 2400],
    ["2400", 2400000],
  ])("reads %j as %d mm", (text, expected) => {
    expect(parseLengthMm(text, "m")).toBe(expected);
  });

  it.each(["", " ", ".", "abc", "2.4.5", "-3", "1e3", "2.4005", "2.4m"])(
    "gives NaN for %j",
    (text) => {
      expect(parseLengthMm(text, "m")).toBeNaN();
    },
  );
});

describe("parseLengthMm in millimetres", () => {
  it("reads whole numbers, ignoring surrounding spaces", () => {
    expect(parseLengthMm("2400", "mm")).toBe(2400);
    expect(parseLengthMm(" 2400 ", "mm")).toBe(2400);
    expect(parseLengthMm("6", "mm")).toBe(6);
  });

  it.each(["", " ", "abc", "2.4", "2400.5", "-3", "1e3", "2400mm"])(
    "gives NaN for %j",
    (text) => {
      expect(parseLengthMm(text, "mm")).toBeNaN();
    },
  );
});

describe("formatLength", () => {
  it("shows millimetres as they are", () => {
    expect(formatLength(2400, "mm")).toBe("2400");
  });

  it.each([
    [2400, "2.4"],
    [6000, "6"],
    [1005, "1.005"],
    [4350, "4.35"],
    [115, "0.115"],
  ])("shows %d mm as %s m", (mm, text) => {
    expect(formatLength(mm, "m")).toBe(text);
  });

  it("leaves a half-typed value blank", () => {
    expect(formatLength(Number.NaN, "m")).toBe("");
    expect(formatLength(Number.NaN, "mm")).toBe("");
  });

  // Switching units must never change the design.
  it.each([300, 1005, 1234, 1795, 2399, 4350, 49999, 50000])(
    "round-trips %d mm through both units",
    (mm) => {
      expect(parseLengthMm(formatLength(mm, "m"), "m")).toBe(mm);
      expect(parseLengthMm(formatLength(mm, "mm"), "mm")).toBe(mm);
    },
  );
});

// The form and the engine must agree, or the total could show beside an error.
describe("field rules match the engine", () => {
  const lengths = [Number.NaN, 0, 299, 300, 6000, 50000, 50001];
  it.each(lengths)("run length %d", (lengthMm) => {
    const design: Design = {
      ...initialDesign,
      runs: [{ ...initialDesign.runs[0], lengthMm }],
    };
    expect(runLengthError(lengthMm, "mm") === undefined).toBe(isOk(design));
  });

  const widths = [Number.NaN, 0, 599, 600, 900, 1200, 1201];
  it.each(widths)("gate width %d", (widthMm) => {
    const design: Design = {
      ...initialDesign,
      runs: [{ ...initialDesign.runs[0], gate: { widthMm } }],
    };
    expect(gateWidthError(widthMm, "mm") === undefined).toBe(isOk(design));
  });

  const heights = [Number.NaN, 0, 114, 115, 1800, 2100, 5000];
  it.each(heights)("target height %d", (targetHeightMm) => {
    const design: Design = { ...initialDesign, targetHeightMm };
    expect(targetHeightError(targetHeightMm, "mm") === undefined).toBe(
      isOk(design),
    );
  });
});

describe("error messages", () => {
  it("states the allowed range in the unit being entered", () => {
    expect(runLengthError(1, "m")).toBe("Enter 0.3 to 50 m.");
    expect(runLengthError(1, "mm")).toBe("Enter 300 to 50000 mm.");
    expect(gateWidthError(1, "m")).toBe("Enter 0.6 to 1.2 m.");
    expect(gateWidthError(1, "mm")).toBe("Enter 600 to 1200 mm.");
    expect(targetHeightError(1, "m")).toBe("Enter 0.115 to 2.1 m.");
    expect(targetHeightError(1, "mm")).toBe("Enter 115 to 2100 mm.");
  });
});
