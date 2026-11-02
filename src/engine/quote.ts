import * as z from "zod/mini";
import { calculate } from "./calculate";
import { COLOURS } from "./catalogue";
import { ACCOUNT_PRICES, type PriceContext, type PricedBom } from "./pricing";
import type { Design } from "./types";

const MAX_RUNS = 50;
const MAX_LINES = 20;
const MAX_ACCOUNT_CODE_LENGTH = 50;

const cents = z.int().check(z.gte(0));

// Shared by the browser and the server, shaped for an ERP to consume.
export const QuoteSchema = z.object({
  source: z.literal("slat-calculator"),
  createdAt: z.iso.datetime({ offset: true }),
  customer: z.object({
    tier: z.enum(["retail", "trade"]),
    accountCode: z.optional(
      z.string().check(z.maxLength(MAX_ACCOUNT_CODE_LENGTH)),
    ),
  }),
  design: z.object({
    system: z.literal("slat"),
    fenceHeightMm: z.int(),
    gapMm: z.literal([5, 9, 20]),
    slatCount: z.int(),
    colour: z.enum(COLOURS.map((c) => c.id)),
    mounting: z.enum(["in-ground", "base-plate"]),
    runs: z
      .array(
        z.object({
          lengthMm: z.int(),
          startsAtCorner: z.boolean(),
          gate: z.optional(z.object({ widthMm: z.int() })),
        }),
      )
      .check(z.minLength(1), z.maxLength(MAX_RUNS)),
  }),
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

export function buildQuote(
  design: Design,
  ctx: PriceContext,
  now: Date = new Date(),
): Quote {
  const result = calculate(design, ctx);
  if (!result.ok) throw new RangeError(result.error);

  return {
    source: "slat-calculator",
    createdAt: now.toISOString(),
    customer: { tier: ctx.tier, accountCode: ctx.accountCode },
    design: {
      system: design.system,
      fenceHeightMm: result.layouts[0].fenceHeightMm,
      gapMm: design.gapMm,
      slatCount: design.slatCount,
      colour: design.colour,
      mounting: design.mounting,
      runs: design.runs.map(({ lengthMm, startsAtCorner, gate }) => ({
        lengthMm,
        startsAtCorner,
        gate,
      })),
    },
    lines: toQuoteLines(result.priced),
    totals: result.priced.totals,
  };
}

// Recalculates from the design, so a tampered request can't set its own prices.
export function verifyQuote({ customer, design, lines, totals }: Quote) {
  const { accountCode } = customer;
  if (accountCode !== undefined && !ACCOUNT_PRICES[accountCode]) return false;

  const result = calculate(
    {
      system: design.system,
      targetHeightMm: design.fenceHeightMm,
      gapMm: design.gapMm,
      slatCount: design.slatCount,
      colour: design.colour,
      mounting: design.mounting,
      runs: design.runs.map((run, i) => ({ ...run, id: `run-${i + 1}` })),
    },
    customer,
  );
  if (!result.ok) return false;
  if (result.layouts[0].fenceHeightMm !== design.fenceHeightMm) return false;

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
