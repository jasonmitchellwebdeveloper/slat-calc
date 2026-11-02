import { useRef, type Dispatch } from "react";
import { flushSync } from "react-dom";
import { MAX_GATE_WIDTH_MM, MAX_RUN_MM } from "@/engine/catalogue";
import type { Run } from "@/engine/types";
import type { DesignAction } from "./designReducer";
import { NumberField } from "./NumberField";
import styles from "./RunBuilder.module.scss";
import { gateWidthError, runLengthError } from "./validation";

interface RunBuilderProps {
  runs: Run[];
  dispatch: Dispatch<DesignAction>;
  onSelectRun: (id: string) => void;
}

export function RunBuilder({ runs, dispatch, onSelectRun }: RunBuilderProps) {
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
                  id={`${run.id}-length`}
                  label="Fence length"
                  hint="In metres or mm, e.g. 6 or 6000, not including any gate"
                  value={run.lengthMm}
                  maxMm={MAX_RUN_MM}
                  validate={runLengthError}
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
                {run.gate && (
                  <NumberField
                    id={`${run.id}-gate`}
                    label="Gate width"
                    hint="In metres or mm, e.g. 0.9 or 900"
                    value={run.gate.widthMm}
                    maxMm={MAX_GATE_WIDTH_MM}
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
