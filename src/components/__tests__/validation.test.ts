import { describe, expect, it } from "vitest";
import { calculate } from "@/engine/calculate";
import type { Design } from "@/engine/types";
import { initialDesign } from "../designReducer";
import {
  gateWidthError,
  parseWholeNumber,
  runLengthError,
  targetHeightError,
} from "../validation";

function isOk(design: Design): boolean {
  return calculate(design, { tier: "retail" }).ok;
}

describe("parseWholeNumber", () => {
  it("reads whole numbers, ignoring surrounding spaces", () => {
    expect(parseWholeNumber("6000")).toBe(6000);
    expect(parseWholeNumber(" 6000 ")).toBe(6000);
  });

  it("gives NaN for anything half-typed or not whole", () => {
    for (const text of ["", " ", "abc", "60a0", "6000.5", "-6000", "1e3"]) {
      expect(parseWholeNumber(text)).toBeNaN();
    }
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
  it("states the allowed range", () => {
    expect(runLengthError(1)).toBe("Enter a whole number from 300 to 50000.");
    expect(gateWidthError(1)).toBe("Enter a whole number from 600 to 1200.");
    expect(targetHeightError(1)).toBe("Enter a whole number from 115 to 2100.");
  });
});
