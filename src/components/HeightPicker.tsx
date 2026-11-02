import type { Dispatch } from "react";
import { MAX_FENCE_HEIGHT_MM } from "@/engine/catalogue";
import { MIN_FENCE_HEIGHT_MM, type HeightOption } from "@/engine/height";
import type { Design } from "@/engine/types";
import type { DesignAction } from "./designReducer";
import styles from "./HeightPicker.module.scss";
import { NumberField } from "./NumberField";
import { OptionGroup } from "./OptionGroup";
import { targetHeightError } from "./validation";

interface HeightPickerProps {
  design: Design;
  options: HeightOption[];
  dispatch: Dispatch<DesignAction>;
}

function optionKey(option: Pick<HeightOption, "gapMm" | "slatCount">): string {
  return `${option.gapMm}-${option.slatCount}`;
}

export function HeightPicker({ design, options, dispatch }: HeightPickerProps) {
  return (
    <div className={styles.picker}>
      <NumberField
        id="target-height"
        label="Target height (mm)"
        hint={`${MIN_FENCE_HEIGHT_MM} to ${MAX_FENCE_HEIGHT_MM} mm, including ground clearance`}
        value={design.targetHeightMm}
        validate={targetHeightError}
        onChange={(mm) => dispatch({ type: "setTargetHeight", mm })}
      />
      {/* Holds its height so the page doesn't jump mid-typing. */}
      <div className={styles.options}>
        {options.length > 0 ? (
          <OptionGroup
            legend="Closest builds"
            name="height"
            value={optionKey(design)}
            options={options.map((option) => ({
              value: optionKey(option),
              label: `${option.fenceHeightMm} mm, ${option.slatCount} slats, ${option.gapMm} mm gap`,
            }))}
            onChange={(key) => {
              const option = options.find((o) => optionKey(o) === key);
              if (!option) return;
              dispatch({
                type: "selectHeight",
                gapMm: option.gapMm,
                slatCount: option.slatCount,
              });
            }}
          />
        ) : (
          <p className={styles.empty}>
            Enter a height in range to see the closest builds.
          </p>
        )}
      </div>
    </div>
  );
}
