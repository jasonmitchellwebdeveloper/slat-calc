import {
  MAX_FENCE_HEIGHT_MM,
  MAX_GATE_WIDTH_MM,
  MAX_RUN_MM,
  MIN_GATE_WIDTH_MM,
  MIN_RUN_MM,
} from "@/engine/catalogue";
import { MIN_FENCE_HEIGHT_MM, solveHeight } from "@/engine/height";
import { MAX_PANEL_RUN_MM, MIN_PANEL_RUN_MM } from "@/engine/panelCatalogue";

export type Unit = "m" | "mm";

export type Validate = (mm: number, unit: Unit) => string | undefined;

const MM_PER_M = 1000;
const MM_DIGITS = 3; // decimal places in a metre value that are whole mm

// Returns mm. NaN stands in for anything half-typed, and the engine rejects it.
export function parseLengthMm(text: string, unit: Unit): number {
  const trimmed = text.trim();
  if (unit === "mm") {
    return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  }

  const match = /^(\d*)\.?(\d*)$/.exec(trimmed);
  if (!match || (match[1] === "" && match[2] === "")) return Number.NaN;

  // Digit by digit, so 2.4 is exactly 2400 and not a floating-point near miss.
  const fraction = match[2].replace(/0+$/, "");
  if (fraction.length > MM_DIGITS) return Number.NaN;
  return Number(match[1]) * MM_PER_M + Number(fraction.padEnd(MM_DIGITS, "0"));
}

export function formatLength(mm: number, unit: Unit): string {
  if (Number.isNaN(mm)) return "";
  return String(unit === "m" ? mm / MM_PER_M : mm);
}

export function rangeText(minMm: number, maxMm: number, unit: Unit): string {
  return `${formatLength(minMm, unit)} to ${formatLength(maxMm, unit)} ${unit}`;
}

function rangeError(mm: number, min: number, max: number, unit: Unit) {
  const valid = Number.isInteger(mm) && mm >= min && mm <= max;
  return valid ? undefined : `Enter ${rangeText(min, max, unit)}.`;
}

export const runLengthError: Validate = (mm, unit) =>
  rangeError(mm, MIN_RUN_MM, MAX_RUN_MM, unit);

export const panelRunLengthError: Validate = (mm, unit) =>
  rangeError(mm, MIN_PANEL_RUN_MM, MAX_PANEL_RUN_MM, unit);

export const gateWidthError: Validate = (mm, unit) =>
  rangeError(mm, MIN_GATE_WIDTH_MM, MAX_GATE_WIDTH_MM, unit);

// Some targets just over the max still round down to a build, so ask the solver.
export const targetHeightError: Validate = (mm, unit) =>
  solveHeight(mm).length > 0
    ? undefined
    : `Enter ${rangeText(MIN_FENCE_HEIGHT_MM, MAX_FENCE_HEIGHT_MM, unit)}.`;
