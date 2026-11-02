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
  panelSleeper,
  RUN_END_ALLOWANCE_MM,
  SCREWS_PER_GATE,
  SCREWS_PER_PANEL,
  SHEET_CLEARANCE_MM,
  SHEET_COVER_MM,
  SLEEPER_HEIGHT_MM,
  STANDARD_POST_MM,
  STANDARD_STEEL_POST_MM,
  LONG_STEEL_POST_MM,
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
  sleeperRows: number;
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

function sleeperHeightMm({ sleeperType, sleepers }: PanelDesign): number {
  return sleepers * SLEEPER_HEIGHT_MM[sleeperType];
}

// The stock post for this panel height. Sleepers don't change it.
export function recommendedPostLength(design: PanelDesign): number {
  const { fenceHeightMm, mounting } = design;
  if (mounting === "base-plate") {
    return PANEL_POST_LENGTHS.find((l) => l >= fenceHeightMm)!;
  }
  return fenceHeightMm + IN_GROUND_POST_DEPTH_MM <= STANDARD_POST_MM
    ? STANDARD_POST_MM
    : fenceHeightMm + IN_GROUND_POST_DEPTH_MM;
}

// A chosen post can be short, for fixing to a structure, but not under the panel.
export function postLengthFor(design: PanelDesign): number {
  const { postLengthMm } = design;
  if (postLengthMm === null) return recommendedPostLength(design);
  const fits =
    PANEL_POST_LENGTHS.includes(postLengthMm) &&
    postLengthMm >= design.fenceHeightMm;
  if (!fits) {
    throw new RangeError(`A ${postLengthMm} mm post doesn't suit this fence`);
  }
  return postLengthMm;
}

// End posts carry the sleepers and the tallest panels, so they run longer.
function steelPostLengthFor(design: PanelDesign): number {
  const postLength = postLengthFor(design);
  if (design.mounting === "base-plate") {
    const aboveGround = design.fenceHeightMm + sleeperHeightMm(design);
    return Math.max(
      postLength,
      PANEL_POST_LENGTHS.find((l) => l >= aboveGround)!,
    );
  }
  const needsLong = design.sleepers > 0 || design.fenceHeightMm >= 2100;
  return Math.max(
    postLength,
    needsLong ? LONG_STEEL_POST_MM : STANDARD_STEEL_POST_MM,
  );
}

function assertValidOptions(design: PanelDesign): void {
  if (!PANEL_FENCE_HEIGHTS.includes(design.fenceHeightMm)) {
    throw new RangeError(
      `There's no sheet for a ${design.fenceHeightMm} mm fence`,
    );
  }
  if ((design.sleeperType === "none") !== (design.sleepers === 0)) {
    throw new RangeError("Choose a sleeper material and how many rows");
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
  const sleepersMm = sleeperHeightMm(design);

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
      fenceHeightMm: design.fenceHeightMm + sleepersMm,
      sheetHeightMm: design.fenceHeightMm - SHEET_CLEARANCE_MM,
      sleeperHeightMm: sleepersMm,
      sleeperRows: design.sleepers,
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
    {
      sku: panelPost("steel", steelPostLengthFor(design)).sku,
      qty: steelPosts,
    },
    { sku: P.rail.sku, qty: standard * RAILS_PER_PANEL },
    { sku: P.longRail.sku, qty: long * RAILS_PER_PANEL },
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
  if (design.sleeperType !== "none") {
    lines.push(
      {
        sku: panelSleeper(design.sleeperType, "standard").sku,
        qty: standard * design.sleepers,
      },
      {
        sku: panelSleeper(design.sleeperType, "long").sku,
        qty: long * design.sleepers,
      },
    );
  }
  if (inGround && concreteProduct) {
    lines.push({
      sku: concreteProduct.sku,
      qty: Math.ceil(holes * CONCRETE_BAGS_PER_HOLE),
    });
  }

  return { lines: lines.filter((line) => line.qty > 0), cuts: [] };
}
