import { describe, expect, it } from "vitest";
import { initialDesign, initialPanelDesign } from "../designReducer";
import { fenceColours } from "../fenceColours";

describe("fenceColours", () => {
  it("uses one colour for a slat fence", () => {
    const { infillHex, frameHex, finish } = fenceColours(initialDesign);
    expect(frameHex).toBe(infillHex);
    expect(finish).toBe("Charcoal finish");
  });

  it("uses the infill colour for the frame unless one is chosen", () => {
    const { infillHex, frameHex, finish } = fenceColours(initialPanelDesign);
    expect(frameHex).toBe(infillHex);
    expect(finish).toBe("Mist Grey finish");
  });

  it("names both colours when the frame differs", () => {
    const { infillHex, frameHex, finish } = fenceColours({
      ...initialPanelDesign,
      frameColour: "slate-grey",
    });
    expect(frameHex).not.toBe(infillHex);
    expect(finish).toBe("Mist Grey infill with Slate Grey frame");
  });

  it("names one colour when the frame is chosen to match", () => {
    const { finish } = fenceColours({
      ...initialPanelDesign,
      frameColour: "mist-grey",
    });
    expect(finish).toBe("Mist Grey finish");
  });
});

describe("sleeper colour", () => {
  it("matches the frame for aluminium, and looks like timber otherwise", () => {
    const aluminium = fenceColours({
      ...initialPanelDesign,
      sleeperType: "aluminium",
      sleepers: 1,
    });
    expect(aluminium.sleeperHex).toBe(aluminium.frameHex);
    const timber = fenceColours({
      ...initialPanelDesign,
      sleeperType: "dressed-timber",
      sleepers: 1,
    });
    expect(timber.sleeperHex).not.toBe(timber.frameHex);
  });
});
