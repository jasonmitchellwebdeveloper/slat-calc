import type { FenceLayout } from "@/engine/calculate";
import styles from "./PanelCutList.module.scss";

interface PanelCutListProps {
  layouts: FenceLayout[];
}

// Panels come as kits, so the only cuts are trimming the last one in a run.
export function PanelCutList({ layouts }: PanelCutListProps) {
  const cuts = layouts.flatMap((layout, runIndex) =>
    "panels" in layout
      ? layout.panels.flatMap((panel, panelIndex) =>
          panel.cutDown
            ? [
                {
                  key: `${layout.runId}-${panelIndex}`,
                  text: `Run ${runIndex + 1}, panel ${panelIndex + 1}: cut to ${panel.widthMm} mm, using ${panel.sheets} ${panel.sheets === 1 ? "sheet" : "sheets"}`,
                },
              ]
            : [],
        )
      : [],
  );

  return (
    <div className={styles.cutList}>
      <h3>Cut list</h3>
      {cuts.length === 0 ? (
        <p>No panels need cutting.</p>
      ) : (
        <ul>
          {cuts.map((cut) => (
            <li key={cut.key}>{cut.text}</li>
          ))}
        </ul>
      )}
      <p className={styles.note}>Rails and sheets are trimmed on site.</p>
    </div>
  );
}
