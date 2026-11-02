import {
  MAX_FENCE_HEIGHT_MM,
  MAX_GATE_WIDTH_MM,
  MAX_RUN_MM,
  MIN_GATE_WIDTH_MM,
  MIN_RUN_MM,
} from "@/engine/catalogue";
import { MIN_FENCE_HEIGHT_MM, solveHeight } from "@/engine/height";

export type Validate = (value: number) => string | undefined;

// NaN stands in for anything half-typed, and the engine rejects it.
export function parseWholeNumber(text: string): number {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function rangeMessage(min: number, max: number): string {
  return `Enter a whole number from ${min} to ${max}.`;
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
