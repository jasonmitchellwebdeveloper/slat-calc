import {
  MAX_FENCE_HEIGHT_MM,
  MAX_GATE_WIDTH_MM,
  MAX_RUN_MM,
  MIN_GATE_WIDTH_MM,
  MIN_RUN_MM,
} from "@/engine/catalogue";
import { MIN_FENCE_HEIGHT_MM, solveHeight } from "@/engine/height";

export type Validate = (value: number) => string | undefined;

const LENGTH_PATTERN = /^(\d*)(\.?)(\d*)\s*(mm|m)?$/i;
const MM_PER_M = 1000;
const MM_DIGITS = 3; // decimal places in a metre value that are whole mm

// Reads metres or millimetres. A field's valid ranges in each unit don't
// overlap, so a suffix, a decimal point or the size of the number settles which.
// NaN stands in for anything half-typed, and the engine rejects it.
export function parseLengthMm(text: string, maxMm: number): number {
  const match = LENGTH_PATTERN.exec(text.trim());
  if (!match) return Number.NaN;

  const [, whole, point, fraction, suffix] = match;
  if (whole === "" && fraction === "") return Number.NaN;

  const unit = suffix?.toLowerCase();
  const inMetres =
    unit === "m" ||
    (unit !== "mm" && (point !== "" || Number(whole) <= maxMm / MM_PER_M));

  // Digit by digit, so 2.4 is exactly 2400 and not a floating-point near miss.
  const significant = fraction.replace(/0+$/, "");
  if (inMetres) {
    if (significant.length > MM_DIGITS) return Number.NaN;
    const mm = significant.padEnd(MM_DIGITS, "0");
    return Number(whole) * MM_PER_M + Number(mm);
  }
  return significant === "" ? Number(whole) : Number.NaN;
}

function rangeMessage(min: number, max: number): string {
  return `Enter ${min / MM_PER_M} to ${max / MM_PER_M} m, or ${min} to ${max} mm.`;
}

function rangeError(value: number, min: number, max: number) {
  const valid = Number.isInteger(value) && value >= min && value <= max;
  return valid ? undefined : rangeMessage(min, max);
}

export const runLengthError: Validate = (mm) =>
  rangeError(mm, MIN_RUN_MM, MAX_RUN_MM);

export const gateWidthError: Validate = (mm) =>
  rangeError(mm, MIN_GATE_WIDTH_MM, MAX_GATE_WIDTH_MM);

// Some targets just over the max still round down to a build, so ask the solver.
export const targetHeightError: Validate = (mm) =>
  solveHeight(mm).length > 0
    ? undefined
    : rangeMessage(MIN_FENCE_HEIGHT_MM, MAX_FENCE_HEIGHT_MM);
