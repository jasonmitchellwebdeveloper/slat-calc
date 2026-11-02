import {
  CHANNEL_CLEARANCE_MM,
  GATE_ALLOWANCE_MM,
  GROUND_CLEARANCE_MM,
  IN_GROUND_POST_DEPTH_MM,
  MAX_BAY_MM,
  MAX_FENCE_HEIGHT_MM,
  MAX_GATE_WIDTH_MM,
  MAX_RUN_MM,
  MIN_GATE_WIDTH_MM,
  MIN_RUN_MM,
  POST_PRODUCTS,
  POST_WIDTH_MM,
  PRODUCTS,
} from "./catalogue";
import { panelHeightFor } from "./height";
import type { Mounting, Product, Run, SlatDesign } from "./types";

export interface BomLine {
  sku: string;
  qty: number;
}

export interface CutRequest {
  sku: string;
  lengthMm: number;
  qty: number;
}

export interface Bom {
  lines: BomLine[];
  cuts: CutRequest[]; // slats and channels, packed into stock by the optimiser
}

export interface RunLayout {
  runId: string;
  lengthMm: number;
  sharesCorner: boolean; // first post belongs to the previous run
  bays: number;
  bayWidthsMm: number[]; // post centre to post centre
  bayWidthMm: number;
  posts: number;
  slatCutMm: number;
  panelHeightMm: number;
  fenceHeightMm: number;
  gateOpeningMm?: number;
}

function assertValidRun(run: Run): void {
  const { lengthMm, gate } = run;
  if (
    !Number.isInteger(lengthMm) ||
    lengthMm < MIN_RUN_MM ||
    lengthMm > MAX_RUN_MM
  ) {
    throw new RangeError(
      `Run length must be a whole number from ${MIN_RUN_MM} to ${MAX_RUN_MM} mm, got ${lengthMm}`,
    );
  }
  if (
    gate &&
    (!Number.isInteger(gate.widthMm) ||
      gate.widthMm < MIN_GATE_WIDTH_MM ||
      gate.widthMm > MAX_GATE_WIDTH_MM)
  ) {
    throw new RangeError(
      `Gate width must be a whole number from ${MIN_GATE_WIDTH_MM} to ${MAX_GATE_WIDTH_MM} mm, got ${gate.widthMm}`,
    );
  }
}

function assertValidHeight(slatCount: number, fenceHeightMm: number): void {
  if (!Number.isInteger(slatCount) || slatCount < 1) {
    throw new RangeError(
      `Slat count must be a positive whole number, got ${slatCount}`,
    );
  }
  if (fenceHeightMm > MAX_FENCE_HEIGHT_MM) {
    throw new RangeError(
      `Fence height ${fenceHeightMm} mm is over the ${MAX_FENCE_HEIGHT_MM} mm max`,
    );
  }
}

function pickPost(fenceHeightMm: number, mounting: Mounting): Product {
  const neededMm =
    mounting === "in-ground"
      ? fenceHeightMm + IN_GROUND_POST_DEPTH_MM
      : fenceHeightMm;
  const post = POST_PRODUCTS.find((p) => p.stockLengthMm! >= neededMm);
  if (!post) throw new RangeError(`No post is long enough for ${neededMm} mm`);
  return post;
}

// Geometry per run. The BOM and the elevation both draw from this.
export function layoutRuns(design: SlatDesign): RunLayout[] {
  const { gapMm, slatCount, runs } = design;
  const panelHeightMm = panelHeightFor(gapMm, slatCount);
  const fenceHeightMm = panelHeightMm + GROUND_CLEARANCE_MM;
  assertValidHeight(slatCount, fenceHeightMm);

  return runs.map((run, index) => {
    assertValidRun(run);
    const bays = Math.ceil(run.lengthMm / MAX_BAY_MM);
    // Whole mm, so every slat in a run matches. Leftover is taken up on site.
    const bayWidthMm = Math.floor(run.lengthMm / bays);
    const sharesCorner = run.startsAtCorner && index > 0;
    const layout: RunLayout = {
      runId: run.id,
      lengthMm: run.lengthMm,
      sharesCorner,
      bays,
      bayWidthsMm: Array.from({ length: bays }, () => bayWidthMm),
      bayWidthMm,
      posts: bays + 1 - (sharesCorner ? 1 : 0) + (run.gate ? 1 : 0),
      slatCutMm: bayWidthMm - POST_WIDTH_MM - 2 * CHANNEL_CLEARANCE_MM,
      panelHeightMm,
      fenceHeightMm,
    };
    if (run.gate) {
      layout.gateOpeningMm = run.gate.widthMm + GATE_ALLOWANCE_MM;
    }
    return layout;
  });
}

export function buildBom(design: SlatDesign): Bom {
  const layouts = layoutRuns(design);
  if (layouts.length === 0) return { lines: [], cuts: [] };

  const { slatCount, mounting, runs } = design;
  const { panelHeightMm, fenceHeightMm } = layouts[0];
  const bays = layouts.reduce((sum, l) => sum + l.bays, 0);
  const posts = layouts.reduce((sum, l) => sum + l.posts, 0);
  const gates = runs.filter((r) => r.gate).length;

  const lines: BomLine[] = [
    { sku: pickPost(fenceHeightMm, mounting).sku, qty: posts },
    { sku: PRODUCTS.cap.sku, qty: posts },
  ];
  if (mounting === "base-plate") {
    lines.push({ sku: PRODUCTS.basePlate.sku, qty: posts });
  }
  if (gates > 0) lines.push({ sku: PRODUCTS.gateKit.sku, qty: gates });
  lines.push({ sku: PRODUCTS.fixings.sku, qty: bays });

  const slatQtyByLength = new Map<number, number>();
  for (const { slatCutMm, bays: runBays } of layouts) {
    const qty = (slatQtyByLength.get(slatCutMm) ?? 0) + runBays * slatCount;
    slatQtyByLength.set(slatCutMm, qty);
  }

  const cuts: CutRequest[] = [
    ...[...slatQtyByLength].map(([lengthMm, qty]) => ({
      sku: PRODUCTS.slat.sku,
      lengthMm,
      qty,
    })),
    { sku: PRODUCTS.channel.sku, lengthMm: panelHeightMm, qty: bays * 2 },
  ];

  return { lines, cuts };
}
