import { COLOURS } from "@/engine/catalogue";
import { PANEL_COLOURS } from "@/engine/panelCatalogue";
import type { Design } from "@/engine/types";

export interface FenceColours {
  infillHex: string;
  frameHex: string;
  finish: string;
}

export function fenceColours(design: Design): FenceColours {
  if (design.system === "slat") {
    const colour = COLOURS.find((c) => c.id === design.colour);
    return {
      infillHex: colour?.hex ?? "",
      frameHex: colour?.hex ?? "",
      finish: `${colour?.name} finish`,
    };
  }
  const infill = PANEL_COLOURS.find((c) => c.id === design.colour);
  const frame =
    PANEL_COLOURS.find((c) => c.id === design.frameColour) ?? infill;
  return {
    infillHex: infill?.hex ?? "",
    frameHex: frame?.hex ?? "",
    finish:
      frame === infill
        ? `${infill?.name} finish`
        : `${infill?.name} infill with ${frame?.name} frame`,
  };
}
