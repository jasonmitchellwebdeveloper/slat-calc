import * as z from "zod/mini";
import { COLOURS } from "./catalogue";

const MAX_RUNS = 50;

// Shape only. Whether a design can be built is calculate()'s job.
export const designSchema = z.object({
  system: z.literal("slat"),
  targetHeightMm: z.int(),
  gapMm: z.literal([5, 9, 20]),
  slatCount: z.int(),
  colour: z.enum(COLOURS.map((c) => c.id)),
  mounting: z.enum(["in-ground", "base-plate"]),
  runs: z
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
    ),
});
