import { describe, expect, it } from "vitest";
import { calculate } from "@/engine/calculate";
import {
  MAX_FENCE_HEIGHT_MM,
  MAX_GATE_WIDTH_MM,
  MAX_RUN_MM,
  MIN_GATE_WIDTH_MM,
  MIN_RUN_MM,
} from "@/engine/catalogue";
import { MIN_FENCE_HEIGHT_MM } from "@/engine/height";
import type { Design } from "@/engine/types";
import { initialDesign } from "../designReducer";
import {
  gateWidthError,
  parseLengthMm,
  runLengthError,
  targetHeightError,
} from "../validation";

function isOk(design: Design): boolean {
  return calculate(design, { tier: "retail" }).ok;
}

describe("parseLengthMm", () => {
  const RUN = MAX_RUN_MM;
  const HEIGHT = MAX_FENCE_HEIGHT_MM;
  const GATE = MAX_GATE_WIDTH_MM;

  it.each([
    ["6", RUN, 6000],
    ["2.4", RUN, 2400],
    ["2400", RUN, 2400],
    ["2.4m", RUN, 2400],
    ["2400mm", RUN, 2400],
    ["50", RUN, 50000],
    ["50000", RUN, 50000],
    ["1.8", HEIGHT, 1800],
    ["2", HEIGHT, 2000],
    ["1800", HEIGHT, 1800],
    ["0.9", GATE, 900],
    ["1", GATE, 1000],
    ["900", GATE, 900],
  ])("reads %s against a %d mm max as %d mm", (text, maxMm, expected) => {
    expect(parseLengthMm(text, maxMm)).toBe(expected);
  });

  it("treats a whole number above the max in metres as millimetres", () => {
    expect(parseLengthMm("51", RUN)).toBe(51);
    expect(parseLengthMm("3", HEIGHT)).toBe(3);
    expect(parseLengthMm("2", GATE)).toBe(2);
  });

  it("lets a typed suffix win, in any case, with spaces", () => {
    expect(parseLengthMm(" 2.4 M ", RUN)).toBe(2400);
    expect(parseLengthMm("2 mm", RUN)).toBe(2);
    expect(parseLengthMm("60m", RUN)).toBe(60000);
    expect(parseLengthMm("2400 MM", RUN)).toBe(2400);
  });

  it("always reads a decimal point as metres", () => {
    expect(parseLengthMm("300.5", RUN)).toBe(300500);
    expect(parseLengthMm(".5", RUN)).toBe(500);
    expect(parseLengthMm("2.", RUN)).toBe(2000);
  });

  it("converts metres to exact whole millimetres", () => {
    expect(parseLengthMm("1.1", RUN)).toBe(1100);
    expect(parseLengthMm("4.35", RUN)).toBe(4350);
    expect(parseLengthMm("1.005", RUN)).toBe(1005);
    expect(parseLengthMm("2.4000", RUN)).toBe(2400);
  });

  it.each([
    "",
    " ",
    ".",
    "abc",
    "m",
    "2.4.5",
    "-3",
    "1e3",
    "2.4005",
    "2400.5mm",
  ])("gives NaN for %j", (text) => {
    expect(parseLengthMm(text, RUN)).toBeNaN();
  });
});

// A number must never mean both, or auto-detecting the unit would be a guess.
describe("each field's units can't overlap", () => {
  it.each([
    ["run length", MIN_RUN_MM, MAX_RUN_MM],
    ["gate width", MIN_GATE_WIDTH_MM, MAX_GATE_WIDTH_MM],
    ["target height", MIN_FENCE_HEIGHT_MM, MAX_FENCE_HEIGHT_MM],
  ])("%s", (_, minMm, maxMm) => {
    expect(maxMm / 1000).toBeLessThan(minMm);
  });
});

// The form and the engine must agree, or the total could show beside an error.
describe("field rules match the engine", () => {
  const lengths = [Number.NaN, 0, 299, 300, 6000, 50000, 50001];
  it.each(lengths)("run length %d", (lengthMm) => {
    const design: Design = {
      ...initialDesign,
      runs: [{ ...initialDesign.runs[0], lengthMm }],
    };
    expect(runLengthError(lengthMm) === undefined).toBe(isOk(design));
  });

  const widths = [Number.NaN, 0, 599, 600, 900, 1200, 1201];
  it.each(widths)("gate width %d", (widthMm) => {
    const design: Design = {
      ...initialDesign,
      runs: [{ ...initialDesign.runs[0], gate: { widthMm } }],
    };
    expect(gateWidthError(widthMm) === undefined).toBe(isOk(design));
  });

  const heights = [Number.NaN, 0, 114, 115, 1800, 2100, 5000];
  it.each(heights)("target height %d", (targetHeightMm) => {
    const design: Design = { ...initialDesign, targetHeightMm };
    expect(targetHeightError(targetHeightMm) === undefined).toBe(isOk(design));
  });
});

describe("error messages", () => {
  it("states the allowed range in both units", () => {
    expect(runLengthError(1)).toBe("Enter 0.3 to 50 m, or 300 to 50000 mm.");
    expect(gateWidthError(1)).toBe("Enter 0.6 to 1.2 m, or 600 to 1200 mm.");
    expect(targetHeightError(1)).toBe(
      "Enter 0.115 to 2.1 m, or 115 to 2100 mm.",
    );
  });
});
