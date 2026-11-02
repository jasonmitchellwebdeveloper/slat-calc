import type { Bom, BomLine } from "./bom";
import {
  CONCRETE_BAGS_PER_HOLE,
  LONG_PANEL_FREE_STRETCH_MM,
  LONG_PANEL_RAIL_MM,
  LONG_PANEL_SHEETS,
  MAX_PANEL_RUN_MM,
  MIN_PANEL_RUN_MM,
  PANEL_FENCE_HEIGHTS,
  PANEL_GATE_WIDTH_MM,
  PANEL_POST_LENGTHS,
  PANEL_PRODUCTS,
  PANEL_RAIL_MM,
  PANEL_SHEETS,
  panelPost,
  panelSheet,
  RUN_END_ALLOWANCE_MM,
  SCREWS_PER_GATE,
  SCREWS_PER_PANEL,
  SHEET_CLEARANCE_MM,
  SHEET_COVER_MM,
  SLEEPER_HEIGHT_MM,
} from "./panelCatalogue";
import { GATE_ALLOWANCE_MM, IN_GROUND_POST_DEPTH_MM } from "./catalogue";
import type { PanelDesign, Run } from "./types";

export interface PanelBay {
  widthMm: number; // post centre to post centre
  kind: "standard" | "long";
  sheets: number;
  cutDown: boolean;
}

export interface PanelRunLayout {
  runId: string;
  lengthMm: number;
  sharesCorner: boolean; // first post belongs to the previous run
  bays: number;
  bayWidthsMm: number[];
  panels: PanelBay[];
  posts: number; // post holes this run adds
  fenceHeightMm: number; // above ground, sleepers included
  sheetHeightMm: number;
  sleeperHeightMm: number;
  postLengthMm: number;
  gateOpeningMm?: number;
}

const POSTS_PER_GATE = 2;
const END_POSTS_PER_RUN = 2;
const RAILS_PER_PANEL = 2;
const CHANNELS_PER_PANEL = 2;
const GATE_RAILS = 2;
const GATE_STILES = 2;

function assertValidRun({ lengthMm, gate }: Run): void {
  if (
    !Number.isInteger(lengthMm) ||
    lengthMm < MIN_PANEL_RUN_MM ||
    lengthMm > MAX_PANEL_RUN_MM
  ) {
    throw new RangeError(
      `Run length must be a whole number from ${MIN_PANEL_RUN_MM} to ${MAX_PANEL_RUN_MM} mm, got ${lengthMm}`,
    );
  }
  if (gate && gate.widthMm !== PANEL_GATE_WIDTH_MM) {
    throw new RangeError(
      `The single gate is ${PANEL_GATE_WIDTH_MM} mm wide, got ${gate.widthMm}`,
    );
  }
}

function aboveGroundMm({ fenceHeightMm, sleepers }: PanelDesign): number {
  return fenceHeightMm + sleepers * SLEEPER_HEIGHT_MM;
}

// The shortest stock post that leaves room for the in-ground depth.
export function recommendedPostLength(design: PanelDesign): number {
  const neededMm =
    aboveGroundMm(design) +
    (design.mounting === "in-ground" ? IN_GROUND_POST_DEPTH_MM : 0);
  const length = PANEL_POST_LENGTHS.find((l) => l >= neededMm);
  if (length === undefined) {
    throw new RangeError(`No post is long enough for ${neededMm} mm`);
  }
  return length;
}

// A chosen post can be short, for fixing to a structure, but not under the fence.
export function postLengthFor(design: PanelDesign): number {
  const { postLengthMm } = design;
  if (postLengthMm === null) return recommendedPostLength(design);
  const fits =
    PANEL_POST_LENGTHS.includes(postLengthMm) &&
    postLengthMm >= aboveGroundMm(design);
  if (!fits) {
    throw new RangeError(`A ${postLengthMm} mm post doesn't suit this fence`);
  }
  return postLengthMm;
}

function assertValidOptions(design: PanelDesign): void {
  if (!PANEL_FENCE_HEIGHTS.includes(design.fenceHeightMm)) {
    throw new RangeError(
      `There's no sheet for a ${design.fenceHeightMm} mm fence`,
    );
  }
}

// Fills the run with standard panels. What's left over turns one into a long
// panel if it fits, or else becomes an extra short panel cut to size.
function layoutPanels(lengthMm: number): PanelBay[] {
  const usableMm = lengthMm - RUN_END_ALLOWANCE_MM;
  const whole = Math.floor(usableMm / PANEL_RAIL_MM);
  const restMm = usableMm - whole * PANEL_RAIL_MM;
  const standard: PanelBay = {
    widthMm: PANEL_RAIL_MM,
    kind: "standard",
    sheets: PANEL_SHEETS,
    cutDown: false,
  };

  if (restMm === 0) return Array.from({ length: whole }, () => standard);

  const stretchMm = LONG_PANEL_RAIL_MM - PANEL_RAIL_MM;
  if (restMm <= stretchMm) {
    return [
      ...Array.from({ length: whole - 1 }, () => standard),
      {
        widthMm: PANEL_RAIL_MM + restMm,
        kind: "long",
        sheets:
          restMm <= LONG_PANEL_FREE_STRETCH_MM
            ? PANEL_SHEETS
            : LONG_PANEL_SHEETS,
        cutDown: restMm < stretchMm,
      },
    ];
  }
  return [
    ...Array.from({ length: whole }, () => standard),
    {
      widthMm: restMm,
      kind: "standard",
      sheets: Math.ceil(restMm / SHEET_COVER_MM),
      cutDown: true,
    },
  ];
}

export function layoutPanelRuns(design: PanelDesign): PanelRunLayout[] {
  assertValidOptions(design);
  const postLengthMm = postLengthFor(design);
  const sleeperHeightMm = design.sleepers * SLEEPER_HEIGHT_MM;

  return design.runs.map((run, index) => {
    assertValidRun(run);
    const panels = layoutPanels(run.lengthMm);
    const sharesCorner = run.startsAtCorner && index > 0;
    const layout: PanelRunLayout = {
      runId: run.id,
      lengthMm: run.lengthMm,
      sharesCorner,
      bays: panels.length,
      bayWidthsMm: panels.map((panel) => panel.widthMm),
      panels,
      posts:
        panels.length +
        1 -
        (sharesCorner ? 1 : 0) +
        (run.gate ? POSTS_PER_GATE : 0),
      fenceHeightMm: aboveGroundMm(design),
      sheetHeightMm: design.fenceHeightMm - SHEET_CLEARANCE_MM,
      sleeperHeightMm,
      postLengthMm,
    };
    if (run.gate) {
      layout.gateOpeningMm = run.gate.widthMm + GATE_ALLOWANCE_MM;
    }
    return layout;
  });
}

export function buildPanelBom(design: PanelDesign): Bom {
  const layouts = layoutPanelRuns(design);
  if (layouts.length === 0) return { lines: [], cuts: [] };

  const P = PANEL_PRODUCTS;
  const allPanels = layouts.flatMap((layout) => layout.panels);
  const standard = allPanels.filter((p) => p.kind === "standard").length;
  const long = allPanels.length - standard;
  const gates = layouts.filter((layout) => layout.gateOpeningMm).length;
  const holes = layouts.reduce((sum, layout) => sum + layout.posts, 0);
  const corners = layouts.filter((layout) => layout.sharesCorner).length;
  const steelPosts =
    layouts.length * END_POSTS_PER_RUN - corners + gates * POSTS_PER_GATE;
  const sheets =
    allPanels.reduce((sum, panel) => sum + panel.sheets, 0) + gates;
  const postLength = postLengthFor(design);
  const inGround = design.mounting === "in-ground";

  const concreteProduct =
    design.concrete === "rapid-set"
      ? P.concreteRapidSet
      : design.concrete === "post-mix"
        ? P.concretePostMix
        : null;

  const lines: BomLine[] = [
    {
      sku: panelSheet(design.profile, design.fenceHeightMm).sku,
      qty: sheets,
    },
    {
      sku: panelPost("channel", postLength).sku,
      qty: allPanels.length * CHANNELS_PER_PANEL,
    },
    { sku: panelPost("steel", postLength).sku, qty: steelPosts },
    { sku: P.rail.sku, qty: standard * RAILS_PER_PANEL },
    { sku: P.longRail.sku, qty: long * RAILS_PER_PANEL },
    { sku: P.sleeper.sku, qty: standard * design.sleepers },
    { sku: P.longSleeper.sku, qty: long * design.sleepers },
    { sku: P.cap.sku, qty: steelPosts + gates * GATE_STILES },
    {
      sku: P.screw.sku,
      qty: allPanels.length * SCREWS_PER_PANEL + gates * SCREWS_PER_GATE,
    },
    { sku: P.gateKit.sku, qty: gates },
    { sku: P.gateRail.sku, qty: gates * GATE_RAILS },
    { sku: P.gateStile.sku, qty: gates * GATE_STILES },
    { sku: P.basePlate.sku, qty: inGround ? 0 : holes },
  ];
  if (inGround && concreteProduct) {
    lines.push({
      sku: concreteProduct.sku,
      qty: Math.ceil(holes * CONCRETE_BAGS_PER_HOLE),
    });
  }

  return { lines: lines.filter((line) => line.qty > 0), cuts: [] };
}
