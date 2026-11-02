import type { Colour, PanelProfile, Product } from "./types";

// Illustrative specs and prices only. Not any supplier's real catalogue.

export const PANEL_RAIL_MM = 2400;
export const LONG_PANEL_RAIL_MM = 3180;
export const RUN_END_ALLOWANCE_MM = 100; // across both ends of a run
export const SHEET_COVER_MM = 800;
export const PANEL_SHEETS = 3;
export const LONG_PANEL_SHEETS = 4;
export const LONG_PANEL_FREE_STRETCH_MM = 50; // before it needs the extra sheet
export const PANEL_POST_WIDTH_MM = 50;
export const MIN_PANEL_RUN_MM = 2500;
export const MAX_PANEL_RUN_MM = 100000;
export const PANEL_GATE_WIDTH_MM = 930;
export const SLEEPER_HEIGHT_MM = 150;
export const SHEET_CLEARANCE_MM = 10; // a sheet is this much under its height
export const MIN_PANEL_FENCE_MM = 1200;
export const MAX_PANEL_FENCE_MM = 2100;
export const SCREWS_PER_PANEL = 12;
export const SCREWS_PER_GATE = 16;
export const CONCRETE_BAGS_PER_HOLE = 1.5;

export const PANEL_FENCE_HEIGHTS = [1200, 1500, 1800, 2100];
export const PANEL_POST_LENGTHS = [1800, 2100, 2400, 2700, 3000];

function product(sku: string, name: string, retailCents: number): Product {
  const tradeCents = Math.round((retailCents * 0.87) / 10) * 10;
  return {
    sku: `DEMO-${sku}`,
    name,
    priceCents: { retail: retailCents, trade: tradeCents },
  };
}

export const PANEL_PRODUCTS = {
  rail: product("PANEL-RAIL-2400", "Panel rail, 2400 mm", 1490),
  longRail: product("PANEL-RAIL-3180", "Panel rail, 3180 mm", 1990),
  sleeper: product("SLEEPER-2400", "Aluminium sleeper, 2400 mm", 3250),
  longSleeper: product("SLEEPER-3180", "Aluminium sleeper, 3180 mm", 4250),
  cap: product("POST-CAP-SHS", "Steel post cap", 190),
  screw: product("TEK-SCREW", "Tek screw", 15),
  concretePostMix: product("CONCRETE-POST", "Concrete post mix, 20 kg", 890),
  concreteRapidSet: product(
    "CONCRETE-RAPID",
    "Rapid set concrete, 20 kg",
    1190,
  ),
  basePlate: product("PANEL-BASEPLATE", "Post base plate", 1850),
  gateKit: product("GATE-KIT-SINGLE", "Single gate kit: hinges, latch", 4250),
  gateRail: product("GATE-RAIL-830", "Gate rail, 830 mm", 890),
  gateStile: product("GATE-STILE", "Gate stile, cut to height", 3490),
} satisfies Record<string, Product>;

const SHEET_RETAIL_CENTS: Record<number, number> = {
  1200: 2190,
  1500: 2650,
  1800: 3150,
  2100: 3690,
};
const TRIMLINE_EXTRA_CENTS = 180;
const POST_CENTS_PER_M = { channel: 1190, steel: 1790 };

export const PANEL_SHEET_PRODUCTS: Product[] = PANEL_FENCE_HEIGHTS.flatMap(
  (height) =>
    (["sawtooth", "trimline"] as const).map((profile) =>
      createSheet(profile, height),
    ),
);

function createSheet(profile: PanelProfile, fenceHeightMm: number): Product {
  const sheetMm = fenceHeightMm - SHEET_CLEARANCE_MM;
  const label = profile === "sawtooth" ? "Sawtooth" : "Trimline";
  const extra = profile === "trimline" ? TRIMLINE_EXTRA_CENTS : 0;
  return product(
    `SHEET-${profile.toUpperCase()}-${sheetMm}`,
    `${label} infill sheet, ${sheetMm} mm`,
    SHEET_RETAIL_CENTS[fenceHeightMm] + extra,
  );
}

export const PANEL_POST_PRODUCTS: Product[] = PANEL_POST_LENGTHS.flatMap(
  (length) =>
    (["channel", "steel"] as const).map((kind) => createPost(kind, length)),
);

function createPost(kind: "channel" | "steel", lengthMm: number): Product {
  return product(
    `POST-${kind.toUpperCase()}-${lengthMm}`,
    kind === "channel"
      ? `Channel post, ${lengthMm} mm`
      : `Steel post 50 x 50 mm, ${lengthMm} mm`,
    Math.round((POST_CENTS_PER_M[kind] * lengthMm) / 1000 / 10) * 10,
  );
}

export function panelSheet(
  profile: PanelProfile,
  fenceHeightMm: number,
): Product {
  return createSheet(profile, fenceHeightMm);
}

export function panelPost(
  kind: "channel" | "steel",
  lengthMm: number,
): Product {
  return createPost(kind, lengthMm);
}

export const ALL_PANEL_PRODUCTS: Product[] = [
  ...Object.values(PANEL_PRODUCTS),
  ...PANEL_SHEET_PRODUCTS,
  ...PANEL_POST_PRODUCTS,
];

export const PANEL_COLOURS: Colour[] = [
  { id: "off-white", name: "Off White", hex: "#e9e7df" },
  { id: "mist-grey", name: "Mist Grey", hex: "#b4b6b2" },
  { id: "slate-grey", name: "Slate Grey", hex: "#6f7478" },
  { id: "deep-charcoal", name: "Deep Charcoal", hex: "#33363a" },
  { id: "forest-green", name: "Forest Green", hex: "#3f5245" },
  { id: "terracotta", name: "Terracotta", hex: "#8e4f3a" },
];
