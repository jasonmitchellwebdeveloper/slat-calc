import * as z from "zod/mini";
import { calculate } from "./calculate";
import { COLOURS } from "./catalogue";
import { PANEL_COLOURS } from "./panelCatalogue";
import { ACCOUNT_PRICES, type PriceContext, type PricedBom } from "./pricing";
import type { Design } from "./types";

const MAX_RUNS = 50;
const MAX_LINES = 20;
const MAX_ACCOUNT_CODE_LENGTH = 50;

const cents = z.int().check(z.gte(0));
const mounting = z.enum(["in-ground", "base-plate"]);
const panelColour = z.enum(PANEL_COLOURS.map((c) => c.id));
const runs = z
  .array(
    z.object({
      lengthMm: z.int(),
      startsAtCorner: z.boolean(),
      gate: z.optional(z.object({ widthMm: z.int() })),
    }),
  )
  .check(z.minLength(1), z.maxLength(MAX_RUNS));

// Shared by the browser and the server, shaped for an ERP to consume.
export const QuoteSchema = z.object({
  source: z.literal("fence-calculator"),
  createdAt: z.iso.datetime({ offset: true }),
  customer: z.object({
    tier: z.enum(["retail", "trade"]),
    accountCode: z.optional(
      z.string().check(z.maxLength(MAX_ACCOUNT_CODE_LENGTH)),
    ),
  }),
  design: z.discriminatedUnion("system", [
    z.object({
      system: z.literal("slat"),
      fenceHeightMm: z.int(),
      gapMm: z.literal([5, 9, 20]),
      slatCount: z.int(),
      colour: z.enum(COLOURS.map((c) => c.id)),
      mounting,
      runs,
    }),
    z.object({
      system: z.literal("panel"),
      fenceHeightMm: z.int(),
      sleeperType: z.enum([
        "none",
        "aluminium",
        "dressed-timber",
        "undressed-timber",
      ]),
      sleepers: z.literal([0, 1, 2]),
      postLengthMm: z.nullable(z.int()),
      profile: z.enum(["sawtooth", "trimline"]),
      colour: panelColour,
      frameColour: panelColour,
      concrete: z.enum(["post-mix", "rapid-set", "none"]),
      mounting,
      runs,
    }),
  ]),
  lines: z
    .array(
      z.object({
        sku: z.string(),
        qty: z.int().check(z.gte(1)),
        unitPriceCents: cents,
        lineTotalCents: cents,
      }),
    )
    .check(z.minLength(1), z.maxLength(MAX_LINES)),
  totals: z.object({
    exGstCents: cents,
    gstCents: cents,
    incGstCents: cents,
  }),
});

export type Quote = z.infer<typeof QuoteSchema>;

function toQuoteLines(priced: PricedBom): Quote["lines"] {
  return priced.lines.map(({ sku, qty, unitPriceCents, lineTotalCents }) => ({
    sku,
    qty,
    unitPriceCents,
    lineTotalCents,
  }));
}

function toQuoteDesign(design: Design, fenceHeightMm: number): Quote["design"] {
  const runs = design.runs.map(({ lengthMm, startsAtCorner, gate }) => ({
    lengthMm,
    startsAtCorner,
    gate,
  }));
  if (design.system === "slat") {
    const { system, gapMm, slatCount, colour, mounting } = design;
    return {
      system,
      fenceHeightMm,
      gapMm,
      slatCount,
      colour,
      mounting,
      runs,
    };
  }
  // An ERP needs the colour itself, not a note that it follows another field.
  return {
    ...design,
    frameColour: design.frameColour ?? design.colour,
    runs,
  };
}

export function buildQuote(
  design: Design,
  ctx: PriceContext,
  now: Date = new Date(),
): Quote {
  const result = calculate(design, ctx);
  if (!result.ok) throw new RangeError(result.error);

  return {
    source: "fence-calculator",
    createdAt: now.toISOString(),
    customer: { tier: ctx.tier, accountCode: ctx.accountCode },
    design: toQuoteDesign(design, result.layouts[0].fenceHeightMm),
    lines: toQuoteLines(result.priced),
    totals: result.priced.totals,
  };
}

function fromQuoteDesign(design: Quote["design"]): Design {
  const runs = design.runs.map((run, i) => ({ ...run, id: `run-${i + 1}` }));
  if (design.system === "panel") return { ...design, runs };
  const { fenceHeightMm, ...slat } = design;
  return { ...slat, targetHeightMm: fenceHeightMm, runs };
}

// Recalculates from the design, so a tampered request can't set its own prices.
export function verifyQuote({ customer, design, lines, totals }: Quote) {
  const { accountCode } = customer;
  if (accountCode !== undefined && !ACCOUNT_PRICES[accountCode]) return false;

  const result = calculate(fromQuoteDesign(design), customer);
  if (!result.ok) return false;
  if (
    design.system === "slat" &&
    result.layouts[0].fenceHeightMm !== design.fenceHeightMm
  ) {
    return false;
  }

  const expected = toQuoteLines(result.priced);
  const { exGstCents, gstCents, incGstCents } = result.priced.totals;
  return (
    totals.exGstCents === exGstCents &&
    totals.gstCents === gstCents &&
    totals.incGstCents === incGstCents &&
    lines.length === expected.length &&
    expected.every(
      (line, i) =>
        lines[i].sku === line.sku &&
        lines[i].qty === line.qty &&
        lines[i].unitPriceCents === line.unitPriceCents &&
        lines[i].lineTotalCents === line.lineTotalCents,
    )
  );
}

export function createQuoteRef(now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  })
    .format(now)
    .replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `Q-${date}-${suffix}`;
}
