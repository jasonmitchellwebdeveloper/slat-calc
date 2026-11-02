import { MAX_RUN_MM, MIN_RUN_MM } from "@/engine/catalogue";
import { solveHeight } from "@/engine/height";
import {
  MAX_PANEL_RUN_MM,
  MIN_PANEL_RUN_MM,
  PANEL_GATE_WIDTH_MM,
} from "@/engine/panelCatalogue";
import type {
  ConcreteType,
  Design,
  GapMm,
  Mounting,
  PanelDesign,
  PanelProfile,
  Run,
  SlatDesign,
} from "@/engine/types";

const NEW_RUN_LENGTH_MM = 3000;
const NEW_GATE_WIDTH_MM = 900;

export const initialDesign: SlatDesign = {
  system: "slat",
  targetHeightMm: 1800,
  gapMm: 5,
  slatCount: 25,
  colour: "charcoal",
  mounting: "in-ground",
  runs: [{ id: "run-1", lengthMm: 6000, startsAtCorner: false }],
};

export const initialPanelDesign: PanelDesign = {
  system: "panel",
  fenceHeightMm: 1800,
  sleepers: 0,
  postLengthMm: null,
  profile: "sawtooth",
  colour: "mist-grey",
  frameColour: "mist-grey",
  concrete: "post-mix",
  mounting: "in-ground",
  runs: [{ id: "run-1", lengthMm: 6000, startsAtCorner: false }],
};

// Lengths are NaN while a field is half-typed. calculate() reports those as
// invalid, so they never reach a total.
export type DesignAction =
  | { type: "setSystem"; system: Design["system"] }
  | { type: "setFenceHeight"; mm: number }
  | { type: "setSleepers"; sleepers: PanelDesign["sleepers"] }
  | { type: "setPostLength"; mm: number | null }
  | { type: "setProfile"; profile: PanelProfile }
  | { type: "setFrameColour"; colour: string }
  | { type: "setConcrete"; concrete: ConcreteType }
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

// Keeps runs when changing fence type, adjusted to what the new type allows.
function adaptRun(run: Run, system: Design["system"]): Run {
  const min = system === "panel" ? MIN_PANEL_RUN_MM : MIN_RUN_MM;
  const max = system === "panel" ? MAX_PANEL_RUN_MM : MAX_RUN_MM;
  const lengthMm = Number.isNaN(run.lengthMm)
    ? NEW_RUN_LENGTH_MM
    : Math.min(max, Math.max(min, run.lengthMm));
  const adapted: Run = { ...run, lengthMm };
  if (run.gate) {
    adapted.gate = {
      widthMm: system === "panel" ? PANEL_GATE_WIDTH_MM : NEW_GATE_WIDTH_MM,
    };
  }
  return adapted;
}

export function designReducer(design: Design, action: DesignAction): Design {
  switch (action.type) {
    case "setSystem": {
      if (action.system === design.system) return design;
      const start =
        action.system === "panel" ? initialPanelDesign : initialDesign;
      return {
        ...start,
        mounting: design.mounting,
        runs: design.runs.map((run) => adaptRun(run, action.system)),
      };
    }
    case "setFenceHeight":
      if (design.system !== "panel") return design;
      return { ...design, fenceHeightMm: action.mm, postLengthMm: null };
    case "setSleepers":
      if (design.system !== "panel") return design;
      return { ...design, sleepers: action.sleepers, postLengthMm: null };
    case "setPostLength":
      if (design.system !== "panel") return design;
      return { ...design, postLengthMm: action.mm };
    case "setProfile":
      if (design.system !== "panel") return design;
      return { ...design, profile: action.profile };
    case "setFrameColour":
      if (design.system !== "panel") return design;
      return { ...design, frameColour: action.colour };
    case "setConcrete":
      if (design.system !== "panel") return design;
      return { ...design, concrete: action.concrete };
    case "setTargetHeight": {
      if (design.system !== "slat") return design;
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
      if (design.system !== "slat") return design;
      return { ...design, gapMm: action.gapMm, slatCount: action.slatCount };
    case "setColour":
      return { ...design, colour: action.colour };
    case "setMounting":
      return design.system === "panel"
        ? { ...design, mounting: action.mounting, postLengthMm: null }
        : { ...design, mounting: action.mounting };
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
          ? {
              ...run,
              gate: {
                widthMm:
                  design.system === "panel"
                    ? PANEL_GATE_WIDTH_MM
                    : NEW_GATE_WIDTH_MM,
              },
            }
          : { id, lengthMm, startsAtCorner };
      });
    case "setGateWidth":
      return updateRun(design, action.id, (run) => ({
        ...run,
        gate: { widthMm: action.mm },
      }));
  }
}
