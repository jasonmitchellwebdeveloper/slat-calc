import type { RunLayout } from "@/engine/bom";
import {
  POST_WIDTH_MM,
  SLAT_FACE_MM,
  SLAT_THICKNESS_MM,
} from "@/engine/catalogue";
import type { Design } from "@/engine/types";
import {
  buildElevation,
  type Rect,
} from "../ElevationDrawing/elevationGeometry";

// A box in mm, by its centre. x runs along the fence, y is height above the
// ground, and z is through the fence.
export interface Box {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export interface FencePost extends Box {
  shared: boolean; // belongs to the previous run, so isn't counted in this one
}

export interface FenceGate {
  widthMm: number;
  leaf: Box;
  frame: Box[];
  hinges: Box[];
}

export interface FenceModel {
  spanMm: number;
  heightMm: number;
  slats: Box[];
  panels: Box[]; // one per bay, covering its slats, for drawing
  slatPeriodMm: number; // slat face plus gap
  slatFaceFraction: number; // share of each period that's slat
  posts: FencePost[];
  basePlates: Box[];
  gate?: FenceGate;
}

const GATE_FRAME_MM = 40;
const HINGE_DEPTH_MM = 30;

// Built from the 2D drawing's geometry, so the two views can't disagree.
export function buildFenceModel(design: Design, layout: RunLayout): FenceModel {
  const drawing = buildElevation(design, layout);
  const { posts, groundY } = drawing;

  const firstPost = posts[0];
  const lastPost = posts[posts.length - 1];
  const fromX = firstPost.x;
  const toX = lastPost.x + lastPost.width;
  const centreX = (fromX + toX) / 2;

  const toBox = (rect: Rect, depth: number): Box => ({
    x: rect.x + rect.width / 2 - centreX,
    y: groundY - rect.y - rect.height / 2,
    z: 0,
    width: rect.width,
    height: rect.height,
    depth,
  });

  let gate: FenceGate | undefined;
  if (drawing.gate) {
    const { leaf: leafRect, hinges, widthMm } = drawing.gate;
    const leaf = toBox(leafRect, GATE_FRAME_MM);
    const { x, y, width, height } = leaf;
    gate = {
      widthMm,
      leaf,
      frame: [
        {
          ...leaf,
          y: y + height / 2 - GATE_FRAME_MM / 2,
          height: GATE_FRAME_MM,
        },
        {
          ...leaf,
          y: y - height / 2 + GATE_FRAME_MM / 2,
          height: GATE_FRAME_MM,
        },
        { ...leaf, x: x - width / 2 + GATE_FRAME_MM / 2, width: GATE_FRAME_MM },
        { ...leaf, x: x + width / 2 - GATE_FRAME_MM / 2, width: GATE_FRAME_MM },
      ],
      hinges: hinges.map((hinge) => toBox(hinge, HINGE_DEPTH_MM)),
    };
  }

  const slats = drawing.slats.map((slat) => toBox(slat, SLAT_THICKNESS_MM));
  const lowestSlat = Math.min(...slats.map((s) => s.y - s.height / 2));
  const panelHeight = layout.panelHeightMm;
  const bayCentres = [...new Set(slats.map((slat) => slat.x))];
  const slatPeriodMm = SLAT_FACE_MM + design.gapMm;

  return {
    spanMm: toX - fromX,
    heightMm: drawing.fenceHeightMm,
    slats,
    panels: bayCentres.map((x) => ({
      x,
      y: lowestSlat + panelHeight / 2,
      z: 0,
      width: layout.slatCutMm,
      height: panelHeight,
      depth: SLAT_THICKNESS_MM,
    })),
    slatPeriodMm,
    slatFaceFraction: SLAT_FACE_MM / slatPeriodMm,
    posts: posts.map((post) => ({
      ...toBox(post, POST_WIDTH_MM),
      shared: post.shared,
    })),
    basePlates: drawing.basePlates.map((plate) => toBox(plate, plate.width)),
    gate,
  };
}
