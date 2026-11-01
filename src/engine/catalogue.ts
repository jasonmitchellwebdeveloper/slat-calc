import type { Colour, GapMm, Product } from "./types";

// Illustrative specs and prices only. Not any supplier's real catalogue.

export const SLAT_FACE_MM = 65;
export const POST_WIDTH_MM = 50;
export const CHANNEL_CLEARANCE_MM = 2; // each side of a slat
export const GROUND_CLEARANCE_MM = 50;
export const GATE_ALLOWANCE_MM = 40; // hinge plus latch
export const MAX_BAY_MM = 1930;
export const MIN_RUN_MM = 300;
export const MAX_RUN_MM = 50000;
export const MAX_FENCE_HEIGHT_MM = 2100;
export const IN_GROUND_POST_DEPTH_MM = 600;
export const SAW_KERF_MM = 3;

export const GAP_OPTIONS: GapMm[] = [5, 9, 20];

export const PRODUCTS = {
  slat: {
    sku: "DEMO-SLAT-6516-5800",
    name: "Slat 65 x 16 mm, 5800 mm",
    stockLengthMm: 5800,
    priceCents: { retail: 3950, trade: 3450 },
  },
  post2400: {
    sku: "DEMO-POST-5050-2400",
    name: "Post 50 x 50 mm, 2400 mm",
    stockLengthMm: 2400,
    priceCents: { retail: 4800, trade: 4200 },
  },
  post3000: {
    sku: "DEMO-POST-5050-3000",
    name: "Post 50 x 50 mm, 3000 mm",
    stockLengthMm: 3000,
    priceCents: { retail: 5900, trade: 5200 },
  },
  channel: {
    sku: "DEMO-CHANNEL-5800",
    name: "Side channel, 5800 mm",
    stockLengthMm: 5800,
    priceCents: { retail: 2850, trade: 2450 },
  },
  cap: {
    sku: "DEMO-CAP-5050",
    name: "Post cap 50 x 50 mm",
    priceCents: { retail: 450, trade: 380 },
  },
  basePlate: {
    sku: "DEMO-BASEPLATE-5050",
    name: "Base plate 50 x 50 mm",
    priceCents: { retail: 1850, trade: 1600 },
  },
  gateKit: {
    sku: "DEMO-GATEKIT",
    name: "Gate kit: frame, hinges, latch",
    priceCents: { retail: 18500, trade: 16200 },
  },
  fixings: {
    sku: "DEMO-FIXINGS",
    name: "Fixings pack",
    priceCents: { retail: 1200, trade: 990 },
  },
} satisfies Record<string, Product>;

// Shortest first, so the BOM can pick the first length that fits.
export const POST_PRODUCTS: Product[] = [PRODUCTS.post2400, PRODUCTS.post3000];

export const COLOURS: Colour[] = [
  { id: "satin-black", name: "Satin Black", hex: "#23262a" },
  { id: "charcoal", name: "Charcoal", hex: "#4a4f54" },
  { id: "pearl-white", name: "Pearl White", hex: "#eef0ee" },
  { id: "woodgrain", name: "Woodgrain", hex: "#8a5a3a" },
];
