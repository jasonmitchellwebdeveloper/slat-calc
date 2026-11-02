import { solveHeight } from "@/engine/height";
import type { Design, GapMm, Mounting, Run } from "@/engine/types";

const NEW_RUN_LENGTH_MM = 3000;
const NEW_GATE_WIDTH_MM = 900;

export const initialDesign: Design = {
  system: "slat",
  targetHeightMm: 1800,
  gapMm: 5,
  slatCount: 25,
  colour: "charcoal",
  mounting: "in-ground",
  runs: [{ id: "run-1", lengthMm: 6000, startsAtCorner: false }],
};

// Lengths are NaN while a field is half-typed. calculate() reports those as
// invalid, so they never reach a total.
export type DesignAction =
  | { type: "setTargetHeight"; mm: number }
  | { type: "selectHeight"; gapMm: GapMm; slatCount: number }
  | { type: "setColour"; colour: string }
  | { type: "setMounting"; mounting: Mounting }
  | { type: "addRun" }
  | { type: "removeRun"; id: string }
  | { type: "setRunLength"; id: string; mm: number }
  | { type: "setCorner"; id: string; startsAtCorner: boolean }
  | { type: "setGate"; id: string; hasGate: boolean }
  | { type: "setGateWidth"; id: string; mm: number };

function updateRun(
  design: Design,
  id: string,
  change: (run: Run) => Run,
): Design {
  return {
    ...design,
    runs: design.runs.map((run) => (run.id === id ? change(run) : run)),
  };
}

function nextRunId(runs: Run[]): string {
  let n = runs.length + 1;
  while (runs.some((run) => run.id === `run-${n}`)) n += 1;
  return `run-${n}`;
}

export function designReducer(design: Design, action: DesignAction): Design {
  switch (action.type) {
    case "setTargetHeight": {
      const next = { ...design, targetHeightMm: action.mm };
      const options = solveHeight(action.mm);
      const stillOffered = options.some(
        (o) => o.gapMm === design.gapMm && o.slatCount === design.slatCount,
      );
      if (options.length === 0 || stillOffered) return next;
      return {
        ...next,
        gapMm: options[0].gapMm,
        slatCount: options[0].slatCount,
      };
    }
    case "selectHeight":
      return { ...design, gapMm: action.gapMm, slatCount: action.slatCount };
    case "setColour":
      return { ...design, colour: action.colour };
    case "setMounting":
      return { ...design, mounting: action.mounting };
    case "addRun":
      return {
        ...design,
        runs: [
          ...design.runs,
          {
            id: nextRunId(design.runs),
            lengthMm: NEW_RUN_LENGTH_MM,
            startsAtCorner: false,
          },
        ],
      };
    case "removeRun": {
      if (design.runs.length === 1) return design;
      const runs = design.runs.filter((run) => run.id !== action.id);
      // The first run has no previous post to share.
      return {
        ...design,
        runs: runs.map((run, index) =>
          index === 0 ? { ...run, startsAtCorner: false } : run,
        ),
      };
    }
    case "setRunLength":
      return updateRun(design, action.id, (run) => ({
        ...run,
        lengthMm: action.mm,
      }));
    case "setCorner":
      return updateRun(design, action.id, (run) => ({
        ...run,
        startsAtCorner: action.startsAtCorner,
      }));
    case "setGate":
      return updateRun(design, action.id, (run) => {
        const { id, lengthMm, startsAtCorner } = run;
        return action.hasGate
          ? { ...run, gate: { widthMm: NEW_GATE_WIDTH_MM } }
          : { id, lengthMm, startsAtCorner };
      });
    case "setGateWidth":
      return updateRun(design, action.id, (run) => ({
        ...run,
        gate: { widthMm: action.mm },
      }));
  }
}
