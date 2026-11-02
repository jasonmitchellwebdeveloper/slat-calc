import type { RunLayout } from "@/engine/bom";
import type { FenceLayout } from "@/engine/calculate";
import type { PanelRunLayout } from "@/engine/panelBom";
import {
  CHANNEL_CLEARANCE_MM,
  GATE_ALLOWANCE_MM,
  GROUND_CLEARANCE_MM,
  IN_GROUND_POST_DEPTH_MM,
  POST_WIDTH_MM,
  SLAT_FACE_MM,
} from "@/engine/catalogue";
import type { Design, PanelDesign, SlatDesign } from "@/engine/types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElevationPost extends Rect {
  shared: boolean; // belongs to the previous run, so isn't counted in this one
}

export interface ElevationGate {
  widthMm: number;
  leaf: Rect;
  hinges: Rect[];
}

export interface Elevation {
  width: number;
  height: number;
  groundY: number;
  fenceTopY: number;
  fenceHeightMm: number;
  posts: ElevationPost[];
  slats: Rect[];
  sheets: Rect[];
  rails: Rect[];
  sleepers: Rect[];
  basePlates: Rect[];
  bays: { centreX: number; widthMm: number; cut: boolean }[];
  fenceSpan: { fromX: number; toX: number; lengthMm: number };
  gate?: ElevationGate;
}

// Drawing space, in the same mm as the fence so the picture stays to scale.
const LEFT_MARGIN = 620;
const RIGHT_MARGIN = 120;
const TOP_MARGIN = 520; // overall length label and dimension line
const GATE_LABEL_ROW = 320;
const BELOW_GROUND = 420; // bay labels
const MIN_WIDTH = 4000; // stops the labels ballooning on very short runs
const PLATE_WIDTH = 110;
const PLATE_HEIGHT = 16;
const HINGE_WIDTH = 50;
const HINGE_HEIGHT = 110;
const PANEL_BELOW_GROUND = 640; // bay labels, with a "cut" line under them
const GATE_POST_OFFSET_MM = 60; // the gate's own post sits beside the fence's
const RAIL_HEIGHT_MM = 40;
const SHEET_CLEARANCE_MM = 10;

function postAt(centreX: number, shared: boolean, top: number, height: number) {
  return {
    x: centreX - POST_WIDTH_MM / 2,
    y: top,
    width: POST_WIDTH_MM,
    height,
    shared,
  };
}

// Pure geometry from the engine's layout, so it can't disagree with the BOM.
export function buildElevation(design: Design, layout: FenceLayout): Elevation {
  return design.system === "panel"
    ? buildPanelElevation(design, layout as PanelRunLayout)
    : buildSlatElevation(design, layout as RunLayout);
}

function buildSlatElevation(design: SlatDesign, layout: RunLayout): Elevation {
  const { gapMm, slatCount, mounting } = design;
  const { bays, bayWidthMm, slatCutMm, fenceHeightMm, gateOpeningMm } = layout;
  const inGround = mounting === "in-ground";

  const fenceTopY = TOP_MARGIN + (gateOpeningMm ? GATE_LABEL_ROW : 0);
  const groundY = fenceTopY + fenceHeightMm;
  const postHeight = fenceHeightMm + (inGround ? IN_GROUND_POST_DEPTH_MM : 0);

  const gateExtent = gateOpeningMm ? gateOpeningMm + POST_WIDTH_MM : 0;
  const naturalWidth =
    LEFT_MARGIN +
    bays * bayWidthMm +
    gateExtent +
    POST_WIDTH_MM / 2 +
    RIGHT_MARGIN;
  const width = Math.max(naturalWidth, MIN_WIDTH);
  const firstX = LEFT_MARGIN + Math.floor((width - naturalWidth) / 2);
  const fenceEndX = firstX + bays * bayWidthMm;
  const centres = Array.from(
    { length: bays + 1 },
    (_, i) => firstX + i * bayWidthMm,
  );
  const posts = centres.map((x, i) =>
    postAt(x, i === 0 && layout.sharesCorner, fenceTopY, postHeight),
  );

  const slats = centres.slice(0, -1).flatMap((centre) =>
    Array.from({ length: slatCount }, (_, row) => ({
      x: centre + POST_WIDTH_MM / 2 + CHANNEL_CLEARANCE_MM,
      y: fenceTopY + row * (SLAT_FACE_MM + gapMm),
      width: slatCutMm,
      height: SLAT_FACE_MM,
    })),
  );

  let gate: ElevationGate | undefined;
  if (gateOpeningMm) {
    const openingX = fenceEndX + POST_WIDTH_MM / 2;
    const widthMm = gateOpeningMm - GATE_ALLOWANCE_MM;
    const leaf = {
      x: openingX + GATE_ALLOWANCE_MM / 2,
      y: fenceTopY,
      width: widthMm,
      height: fenceHeightMm - GROUND_CLEARANCE_MM,
    };
    gate = {
      widthMm,
      leaf,
      hinges: [0.2, 0.8].map((at) => ({
        x: leaf.x - HINGE_WIDTH / 2,
        y: leaf.y + leaf.height * at - HINGE_HEIGHT / 2,
        width: HINGE_WIDTH,
        height: HINGE_HEIGHT,
      })),
    };
    posts.push(
      postAt(
        openingX + gateOpeningMm + POST_WIDTH_MM / 2,
        false,
        fenceTopY,
        postHeight,
      ),
    );
  }

  // One bay's width is the overall length, which is already labelled.
  const bayCentres =
    bays > 1 ? centres.slice(0, -1).map((x) => x + bayWidthMm / 2) : [];

  return {
    width,
    height:
      groundY +
      Math.max(BELOW_GROUND, inGround ? IN_GROUND_POST_DEPTH_MM + 40 : 0),
    groundY,
    fenceTopY,
    fenceHeightMm,
    posts,
    slats,
    sheets: [],
    rails: [],
    sleepers: [],
    basePlates: inGround
      ? []
      : posts.map((post) => ({
          x: post.x + post.width / 2 - PLATE_WIDTH / 2,
          y: groundY - PLATE_HEIGHT,
          width: PLATE_WIDTH,
          height: PLATE_HEIGHT,
        })),
    bays: bayCentres.map((centreX) => ({
      centreX,
      widthMm: bayWidthMm,
      cut: false,
    })),
    fenceSpan: { fromX: firstX, toX: fenceEndX, lengthMm: layout.lengthMm },
    gate,
  };
}

function buildPanelElevation(
  design: PanelDesign,
  layout: PanelRunLayout,
): Elevation {
  const { panels, fenceHeightMm, sleeperHeightMm, gateOpeningMm } = layout;
  const inGround = design.mounting === "in-ground";
  const depthMm = inGround
    ? Math.max(0, layout.postLengthMm - fenceHeightMm)
    : 0;

  const fenceTopY = TOP_MARGIN + (gateOpeningMm ? GATE_LABEL_ROW : 0);
  const groundY = fenceTopY + fenceHeightMm;
  const postHeight = fenceHeightMm + depthMm;

  const spanMm = panels.reduce((sum, panel) => sum + panel.widthMm, 0);
  const gateExtent = gateOpeningMm
    ? GATE_POST_OFFSET_MM + POST_WIDTH_MM + gateOpeningMm
    : 0;
  const naturalWidth =
    LEFT_MARGIN + spanMm + gateExtent + POST_WIDTH_MM / 2 + RIGHT_MARGIN;
  const width = Math.max(naturalWidth, MIN_WIDTH);
  const firstX = LEFT_MARGIN + Math.floor((width - naturalWidth) / 2);
  const fenceEndX = firstX + spanMm;

  const centres = [firstX];
  for (const panel of panels) {
    centres.push(centres[centres.length - 1] + panel.widthMm);
  }
  const posts = centres.map((x, i) =>
    postAt(x, i === 0 && layout.sharesCorner, fenceTopY, postHeight),
  );

  const panelBottomY = groundY - sleeperHeightMm;
  const sheets: Rect[] = [];
  const rails: Rect[] = [];
  const sleepers: Rect[] = [];
  panels.forEach((panel, i) => {
    const x = centres[i] + POST_WIDTH_MM / 2;
    const clearWidth = panel.widthMm - POST_WIDTH_MM;
    const sheetWidth = Math.floor(clearWidth / panel.sheets);
    for (let sheet = 0; sheet < panel.sheets; sheet++) {
      sheets.push({
        x: x + sheet * sheetWidth,
        y: fenceTopY + SHEET_CLEARANCE_MM / 2,
        width: sheetWidth,
        height: layout.sheetHeightMm,
      });
    }
    for (const y of [fenceTopY, panelBottomY - RAIL_HEIGHT_MM]) {
      rails.push({ x, y, width: clearWidth, height: RAIL_HEIGHT_MM });
    }
    if (sleeperHeightMm > 0) {
      sleepers.push({
        x,
        y: panelBottomY,
        width: clearWidth,
        height: sleeperHeightMm,
      });
    }
  });

  let gate: ElevationGate | undefined;
  if (gateOpeningMm) {
    const nearPostX = fenceEndX + GATE_POST_OFFSET_MM;
    const openingX = nearPostX + POST_WIDTH_MM / 2;
    const widthMm = gateOpeningMm - GATE_ALLOWANCE_MM;
    const leaf = {
      x: openingX + GATE_ALLOWANCE_MM / 2,
      y: fenceTopY,
      width: widthMm,
      height: panelBottomY - fenceTopY,
    };
    gate = {
      widthMm,
      leaf,
      hinges: [0.2, 0.8].map((at) => ({
        x: leaf.x - HINGE_WIDTH / 2,
        y: leaf.y + leaf.height * at - HINGE_HEIGHT / 2,
        width: HINGE_WIDTH,
        height: HINGE_HEIGHT,
      })),
    };
    posts.push(
      postAt(nearPostX, false, fenceTopY, postHeight),
      postAt(
        openingX + gateOpeningMm + POST_WIDTH_MM / 2,
        false,
        fenceTopY,
        postHeight,
      ),
    );
  }

  return {
    width,
    height: groundY + Math.max(PANEL_BELOW_GROUND, depthMm + 40),
    groundY,
    fenceTopY,
    fenceHeightMm,
    posts,
    slats: [],
    sheets,
    rails,
    sleepers,
    basePlates: inGround
      ? []
      : posts.map((post) => ({
          x: post.x + post.width / 2 - PLATE_WIDTH / 2,
          y: groundY - PLATE_HEIGHT,
          width: PLATE_WIDTH,
          height: PLATE_HEIGHT,
        })),
    // One panel's width is the overall length, which is already labelled.
    bays:
      panels.length > 1
        ? panels.map((panel, i) => ({
            centreX: centres[i] + panel.widthMm / 2,
            widthMm: panel.widthMm,
            cut: panel.cutDown,
          }))
        : [],
    fenceSpan: { fromX: firstX, toX: fenceEndX, lengthMm: layout.lengthMm },
    gate,
  };
}

export function describeElevation(layout: FenceLayout, index: number): string {
  const { lengthMm, bays, fenceHeightMm, sharesCorner, gateOpeningMm } = layout;
  const noun = "panels" in layout ? "panel" : "bay";
  const parts = [
    `Run ${index + 1}: ${lengthMm} mm, ${bays} ${bays === 1 ? noun : `${noun}s`}, ${fenceHeightMm} mm high.`,
  ];
  if (sharesCorner) parts.push("Starts at a shared corner post.");
  if (gateOpeningMm) {
    parts.push(`Ends with a ${gateOpeningMm - GATE_ALLOWANCE_MM} mm gate.`);
  }
  return parts.join(" ");
}
