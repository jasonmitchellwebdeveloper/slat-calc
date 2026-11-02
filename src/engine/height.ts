import {
  GAP_OPTIONS,
  GROUND_CLEARANCE_MM,
  MAX_FENCE_HEIGHT_MM,
  SLAT_FACE_MM,
} from "./catalogue";
import type { GapMm } from "./types";

export interface HeightOption {
  gapMm: GapMm;
  slatCount: number;
  panelHeightMm: number;
  fenceHeightMm: number;
  diffMm: number; // fence height minus target, negative when under
}

const MAX_OPTIONS = 3;
export const MIN_FENCE_HEIGHT_MM = SLAT_FACE_MM + GROUND_CLEARANCE_MM;

export function panelHeightFor(gapMm: GapMm, slatCount: number): number {
  return SLAT_FACE_MM * slatCount + gapMm * (slatCount - 1);
}

function buildOption(
  targetMm: number,
  gapMm: GapMm,
  slatCount: number,
): HeightOption {
  const panelHeightMm = panelHeightFor(gapMm, slatCount);
  const fenceHeightMm = panelHeightMm + GROUND_CLEARANCE_MM;
  return {
    gapMm,
    slatCount,
    panelHeightMm,
    fenceHeightMm,
    diffMm: fenceHeightMm - targetMm,
  };
}

// Closest real builds to a target height. Empty when nothing can be built.
export function solveHeight(
  targetMm: number,
  gaps: GapMm[] = GAP_OPTIONS,
): HeightOption[] {
  if (!Number.isFinite(targetMm)) return [];
  const target = Math.round(targetMm);
  if (target < MIN_FENCE_HEIGHT_MM) return [];

  const candidates = gaps.flatMap((gapMm) => {
    const exact =
      (target - GROUND_CLEARANCE_MM + gapMm) / (SLAT_FACE_MM + gapMm);
    const counts = new Set([Math.floor(exact), Math.ceil(exact)]);
    return [...counts].map((n) => buildOption(target, gapMm, n));
  });

  return candidates
    .filter((o) => o.fenceHeightMm <= MAX_FENCE_HEIGHT_MM)
    .sort(
      (a, b) =>
        Math.abs(a.diffMm) - Math.abs(b.diffMm) ||
        a.gapMm - b.gapMm ||
        a.slatCount - b.slatCount,
    )
    .slice(0, MAX_OPTIONS);
}
