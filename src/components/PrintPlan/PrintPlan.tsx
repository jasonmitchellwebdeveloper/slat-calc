import type { RunLayout } from "@/engine/bom";
import type { Colour, Design } from "@/engine/types";
import { ElevationDrawing } from "../ElevationDrawing/ElevationDrawing";
import styles from "./PrintPlan.module.scss";

interface PrintPlanProps {
  design: Design;
  layouts: RunLayout[];
  colour?: Colour;
  priceListName: string;
}

const MOUNTING_NAMES = {
  "in-ground": "In-ground",
  "base-plate": "Base plate",
};

// The screen shows one run at a time. A printed plan shows them all.
export function PrintPlan({
  design,
  layouts,
  colour,
  priceListName,
}: PrintPlanProps) {
  return (
    <section className={styles.plan} aria-labelledby="print-plan">
      <h2 id="print-plan">Fence plan</h2>
      <p>
        {layouts[0].fenceHeightMm} mm high, {design.slatCount} slats,{" "}
        {design.gapMm} mm gap. {colour?.name} finish.{" "}
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
            colourHex={colour?.hex ?? ""}
          />
        </div>
      ))}
    </section>
  );
}
