import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { calculate } from "@/engine/calculate";
import { designSchema } from "@/engine/designSchema";
import type { Design } from "@/engine/types";
import { initialDesign } from "./designReducer";

const PARAM = "d";
const MAX_ENCODED_LENGTH = 4000; // far more than 50 runs need

export function designSearch(design: Design): string {
  const encoded = compressToEncodedURIComponent(JSON.stringify(design));
  return `?${PARAM}=${encoded}`;
}

// A link is untrusted input. Anything the form couldn't have produced is null.
function decodeDesign(encoded: string): Design | null {
  if (encoded.length > MAX_ENCODED_LENGTH) return null;

  let json: unknown;
  try {
    json = JSON.parse(decompressFromEncodedURIComponent(encoded));
  } catch {
    return null;
  }

  // Links from before there was a choice of fence type are all slat designs.
  const parsed = designSchema.safeParse(
    json && typeof json === "object" ? { system: "slat", ...json } : json,
  );
  if (!parsed.success) return null;

  const design: Design = {
    ...parsed.data,
    runs: parsed.data.runs.map((run, index) =>
      index === 0 ? { ...run, startsAtCorner: false } : run,
    ),
  };
  const result = calculate(design, { tier: "retail" });
  if (!result.ok) return null;
  if (design.system === "panel") return design;
  const offered = result.heightOptions.some(
    (o) => o.gapMm === design.gapMm && o.slatCount === design.slatCount,
  );
  return offered ? design : null;
}

export function readDesignFromSearch(search: string): {
  design: Design;
  linkInvalid: boolean;
} {
  const encoded = new URLSearchParams(search).get(PARAM);
  if (encoded === null) return { design: initialDesign, linkInvalid: false };

  const design = decodeDesign(encoded);
  return design
    ? { design, linkInvalid: false }
    : { design: initialDesign, linkInvalid: true };
}
