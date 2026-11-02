import * as z from "zod/mini";
import { COLOURS } from "./catalogue";
import { PANEL_COLOURS } from "./panelCatalogue";

const MAX_RUNS = 50;

const mounting = z.enum(["in-ground", "base-plate"]);
const runs = z
  .array(
    z.object({
      id: z.string().check(z.regex(/^run-\d{1,6}$/)),
      lengthMm: z.int(),
      startsAtCorner: z.boolean(),
      gate: z.optional(z.object({ widthMm: z.int() })),
    }),
  )
  .check(
    z.minLength(1),
    z.maxLength(MAX_RUNS),
    z.refine((runs) => new Set(runs.map((r) => r.id)).size === runs.length),
  );
const panelColour = z.enum(PANEL_COLOURS.map((c) => c.id));

// Shape only. Whether a design can be built is calculate()'s job.
export const designSchema = z.discriminatedUnion("system", [
  z.object({
    system: z.literal("slat"),
    targetHeightMm: z.int(),
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
    frameColour: z.nullable(panelColour),
    concrete: z.enum(["post-mix", "rapid-set", "none"]),
    mounting,
    runs,
  }),
]);
