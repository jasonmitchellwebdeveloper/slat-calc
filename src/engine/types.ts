// All lengths are integer millimetres. All prices are integer cents ex GST.

export type GapMm = 5 | 9 | 20;
export type Tier = "retail" | "trade";
export type Mounting = "in-ground" | "base-plate";

export interface Run {
  id: string;
  lengthMm: number; // fence length, excluding any gate
  startsAtCorner: boolean; // shares its first post with the previous run
  gate?: { widthMm: number }; // MVP: one gate at the end of the run
}

export interface SlatDesign {
  system: "slat";
  targetHeightMm: number;
  gapMm: GapMm;
  slatCount: number; // chosen from the height solver
  colour: string;
  mounting: Mounting;
  runs: Run[];
}

export type PanelProfile = "sawtooth" | "trimline";
export type ConcreteType = "post-mix" | "rapid-set" | "none";

export interface PanelDesign {
  system: "panel";
  fenceHeightMm: number; // of the panel, not counting sleepers
  sleepers: number; // rows under each panel
  postLengthMm: number | null; // null uses the recommended length
  profile: PanelProfile;
  colour: string; // infill sheets
  frameColour: string; // posts and rails
  concrete: ConcreteType;
  mounting: Mounting;
  runs: Run[];
}

export type Design = SlatDesign;

export interface Product {
  sku: string;
  name: string;
  stockLengthMm?: number; // set for anything that gets cut
  priceCents: Record<Tier, number>;
}

export interface Colour {
  id: string;
  name: string;
  hex: string;
}
