import { buildBom, layoutRuns, type Bom, type RunLayout } from "./bom";
import { planCuts, type SkuCutPlan } from "./cutting";
import { solveHeight, type HeightOption } from "./height";
import { priceBom, type PriceContext, type PricedBom } from "./pricing";
import type { Design } from "./types";

export type Calculation =
  | {
      ok: true;
      heightOptions: HeightOption[];
      layouts: RunLayout[];
      bom: Bom;
      cutPlans: SkuCutPlan[];
      priced: PricedBom;
    }
  | { ok: false; heightOptions: HeightOption[]; error: string };

// The one entry point for the UI. Every number on screen comes from here.
export function calculate(design: Design, ctx: PriceContext): Calculation {
  const heightOptions = solveHeight(design.targetHeightMm);
  if (heightOptions.length === 0) {
    return {
      ok: false,
      heightOptions,
      error: `Target height cannot be built: ${design.targetHeightMm} mm`,
    };
  }
  try {
    const layouts = layoutRuns(design);
    const bom = buildBom(design);
    const cutPlans = planCuts(bom.cuts);
    const priced = priceBom(bom, cutPlans, ctx);
    return { ok: true, heightOptions, layouts, bom, cutPlans, priced };
  } catch (error) {
    if (error instanceof RangeError) {
      return { ok: false, heightOptions, error: error.message };
    }
    throw error;
  }
}
