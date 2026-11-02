import type { RunLayout } from "@/engine/bom";
import type { Design } from "@/engine/types";
import { ElevationDrawing } from "../ElevationDrawing/ElevationDrawing";
import { OptionGroup } from "../OptionGroup/OptionGroup";
import styles from "./Elevation.module.scss";

interface ElevationProps {
  design: Design;
  layouts: RunLayout[];
  selectedRunId: string | null;
  colourHex: string;
  stale: boolean;
  onSelectRun: (id: string) => void;
}

export function Elevation({
  design,
  layouts,
  selectedRunId,
  colourHex,
  stale,
  onSelectRun,
}: ElevationProps) {
  const index = Math.max(
    0,
    layouts.findIndex((layout) => layout.runId === selectedRunId),
  );
  const layout = layouts[index];

  return (
    <div className={styles.elevation}>
      {layouts.length > 1 && (
        <OptionGroup
          legend="Run to show"
          name="preview-run"
          columns="row"
          value={layout.runId}
          options={layouts.map((l, i) => ({
            value: l.runId,
            label: `Run ${i + 1}`,
          }))}
          onChange={onSelectRun}
        />
      )}
      <div
        className={stale ? styles.staleScroller : styles.scroller}
        role="group"
        aria-label="Fence drawing. Scrolls sideways on long runs."
        tabIndex={0}
      >
        <ElevationDrawing
          design={design}
          layout={layout}
          index={index}
          colourHex={colourHex}
        />
      </div>
      <p className={styles.note}>
        Drawn to scale from the quote.
        {layout.sharesCorner &&
          " The hollow post is shared with the previous run."}
      </p>
    </div>
  );
}
