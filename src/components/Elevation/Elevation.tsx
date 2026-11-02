import dynamic from "next/dynamic";
import { useState } from "react";
import type { FenceLayout } from "@/engine/calculate";
import type { Design } from "@/engine/types";
import { ElevationDrawing } from "../ElevationDrawing/ElevationDrawing";
import { describeElevation } from "../ElevationDrawing/elevationGeometry";
import { OptionGroup, type Option } from "../OptionGroup/OptionGroup";
import { SceneUnavailable } from "../SceneUnavailable/SceneUnavailable";
import styles from "./Elevation.module.scss";

interface ElevationProps {
  design: Design;
  layouts: FenceLayout[];
  selectedRunId: string | null;
  colourHex: string;
  frameHex: string;
  stale: boolean;
  onSelectRun: (id: string) => void;
}

type View = "2d" | "3d";

const VIEW_OPTIONS: Option<View>[] = [
  { value: "2d", label: "2D plan" },
  { value: "3d", label: "3D view" },
];

// three.js is large, so it's only downloaded for people who open the 3D view.
const FenceScene = dynamic(
  () =>
    import("../FenceScene/FenceScene")
      .then((scene) => scene.FenceScene)
      .catch(() => SceneUnavailable),
  { ssr: false, loading: SceneLoading },
);

function SceneLoading() {
  return <div className={styles.loading}>Loading 3D view…</div>;
}

export function Elevation({
  design,
  layouts,
  selectedRunId,
  colourHex,
  frameHex,
  stale,
  onSelectRun,
}: ElevationProps) {
  const index = Math.max(
    0,
    layouts.findIndex((layout) => layout.runId === selectedRunId),
  );
  const layout = layouts[index];
  const hasCuts = "panels" in layout && layout.panels.some((p) => p.cutDown);
  const [view, setView] = useState<View>("2d");

  return (
    <div className={styles.elevation}>
      <OptionGroup
        legend="View"
        name="preview-view"
        columns="half"
        value={view}
        options={VIEW_OPTIONS}
        onChange={setView}
      />
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
      {view === "2d" ? (
        <>
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
              frameHex={frameHex}
            />
          </div>
          <p className={styles.note}>
            Drawn to scale from the quote.
            {hasCuts && " Panels marked cut are trimmed to fit."}
            {layout.sharesCorner &&
              " The hollow post is shared with the previous run."}
          </p>
        </>
      ) : (
        <>
          <div className={stale ? styles.stale : undefined}>
            <FenceScene
              design={design}
              layout={layout}
              colourHex={colourHex}
              frameHex={frameHex}
              label={describeElevation(layout, index)}
            />
          </div>
          <p className={styles.note}>
            Drag sideways to rotate. Measurements are on the 2D plan.
            {layout.sharesCorner &&
              " The see-through post is shared with the previous run."}
          </p>
        </>
      )}
    </div>
  );
}
