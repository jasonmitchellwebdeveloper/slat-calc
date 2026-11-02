import type { FenceLayout } from "@/engine/calculate";
import type { Design } from "@/engine/types";
import { ElevationDrawing } from "../ElevationDrawing/ElevationDrawing";
import styles from "./PrintPlan.module.scss";

interface PrintPlanProps {
  design: Design;
  layouts: FenceLayout[];
  finish: string;
  infillHex: string;
  frameHex: string;
  priceListName: string;
}

const MOUNTING_NAMES = {
  "in-ground": "In-ground",
  "base-plate": "Base plate",
};

// The screen shows one run at a time. A printed plan shows them all.
function summarise(design: Design, layout: FenceLayout): string {
  if (design.system === "slat") {
    return `${layout.fenceHeightMm} mm high, ${design.slatCount} slats, ${design.gapMm} mm gap.`;
  }
  const post = "panels" in layout ? `, ${layout.postLengthMm} mm posts` : "";
  return `${design.fenceHeightMm} mm ${design.profile} panels, ${design.sleepers} ${design.sleepers === 1 ? "sleeper" : "sleepers"}${post}.`;
}

export function PrintPlan({
  design,
  layouts,
  finish,
  infillHex,
  frameHex,
  priceListName,
}: PrintPlanProps) {
  return (
    <section className={styles.plan} aria-labelledby="print-plan">
      <h2 id="print-plan">Fence plan</h2>
      <p>
        {summarise(design, layouts[0])} {finish}.{" "}
        {MOUNTING_NAMES[design.mounting]} mounting. {priceListName} prices.
      </p>
      {layouts.map((layout, index) => (
        <div key={layout.runId} className={styles.run}>
          <h3>
            Run {index + 1}
            {layout.sharesCorner && ", starts at a shared corner post (hollow)"}
          </h3>
          <ElevationDrawing
            design={design}
            layout={layout}
            index={index}
            colourHex={infillHex}
            frameHex={frameHex}
          />
        </div>
      ))}
    </section>
  );
}
