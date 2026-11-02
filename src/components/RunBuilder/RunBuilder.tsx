import { useRef, type Dispatch } from "react";
import { flushSync } from "react-dom";
import {
  MAX_GATE_WIDTH_MM,
  MAX_RUN_MM,
  MIN_GATE_WIDTH_MM,
  MIN_RUN_MM,
} from "@/engine/catalogue";
import {
  MAX_PANEL_RUN_MM,
  MIN_PANEL_RUN_MM,
  PANEL_GATE_WIDTH_MM,
} from "@/engine/panelCatalogue";
import type { Design, Run } from "@/engine/types";
import type { DesignAction } from "@/lib/designReducer";
import {
  gateWidthError,
  panelRunLengthError,
  rangeText,
  runLengthError,
  type Unit,
} from "@/lib/validation";
import { NumberField } from "../NumberField/NumberField";
import styles from "./RunBuilder.module.scss";

interface RunBuilderProps {
  runs: Run[];
  system: Design["system"];
  unit: Unit;
  dispatch: Dispatch<DesignAction>;
  onSelectRun: (id: string) => void;
}

export function RunBuilder({
  runs,
  system,
  unit,
  dispatch,
  onSelectRun,
}: RunBuilderProps) {
  const isPanel = system === "panel";
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  // flushSync so the new run exists before focus moves into it.
  function addRun() {
    flushSync(() => dispatch({ type: "addRun" }));
    listRef.current
      ?.querySelector<HTMLInputElement>("li:last-child input")
      ?.focus();
  }

  // The focused button is about to disappear, so give focus a new home.
  function removeRun(id: string) {
    flushSync(() => dispatch({ type: "removeRun", id }));
    addRef.current?.focus();
  }

  return (
    <div className={styles.builder}>
      <ol ref={listRef} className={styles.runs}>
        {runs.map((run, index) => {
          const name = `Run ${index + 1}`;
          const headingId = `${run.id}-heading`;
          return (
            // The preview follows the run being edited. Click as well as focus,
            // because Safari doesn't focus checkboxes when they're tapped.
            <li
              key={run.id}
              onFocus={() => onSelectRun(run.id)}
              onClick={() => onSelectRun(run.id)}
            >
              <div
                className={styles.run}
                role="group"
                aria-labelledby={headingId}
              >
                <div className={styles.runHeader}>
                  <h3 id={headingId}>{name}</h3>
                  {runs.length > 1 && (
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Remove ${name}`}
                      onClick={() => removeRun(run.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <NumberField
                  key={`length-${system}-${unit}`}
                  id={`${run.id}-length`}
                  label="Fence length"
                  hint={`${isPanel ? rangeText(MIN_PANEL_RUN_MM, MAX_PANEL_RUN_MM, unit) : rangeText(MIN_RUN_MM, MAX_RUN_MM, unit)}, not including any gate`}
                  value={run.lengthMm}
                  unit={unit}
                  validate={isPanel ? panelRunLengthError : runLengthError}
                  onChange={(mm) =>
                    dispatch({ type: "setRunLength", id: run.id, mm })
                  }
                />
                {index > 0 && (
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={run.startsAtCorner}
                      onChange={(event) =>
                        dispatch({
                          type: "setCorner",
                          id: run.id,
                          startsAtCorner: event.target.checked,
                        })
                      }
                    />
                    Starts at a corner
                  </label>
                )}
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={Boolean(run.gate)}
                    onChange={(event) =>
                      dispatch({
                        type: "setGate",
                        id: run.id,
                        hasGate: event.target.checked,
                      })
                    }
                  />
                  Add gate at the end
                </label>
                {run.gate && isPanel && (
                  <p className={styles.gateNote}>
                    Single gate, {PANEL_GATE_WIDTH_MM} mm wide.
                  </p>
                )}
                {run.gate && !isPanel && (
                  <NumberField
                    key={`gate-${unit}`}
                    id={`${run.id}-gate`}
                    label="Gate width"
                    hint={rangeText(MIN_GATE_WIDTH_MM, MAX_GATE_WIDTH_MM, unit)}
                    value={run.gate.widthMm}
                    unit={unit}
                    validate={gateWidthError}
                    onChange={(mm) =>
                      dispatch({ type: "setGateWidth", id: run.id, mm })
                    }
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <button
        ref={addRef}
        type="button"
        className={styles.add}
        onClick={addRun}
      >
        Add run
      </button>
    </div>
  );
}
