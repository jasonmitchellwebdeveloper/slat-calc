import type { CSSProperties } from "react";
import styles from "./OptionGroup.module.scss";

export interface Option<T extends string> {
  value: T;
  label: string;
  swatch?: string;
}

interface OptionGroupProps<T extends string> {
  legend: string;
  name: string;
  options: Option<T>[];
  value: T;
  columns?: 1 | 2 | "half" | "lead" | "quarter" | "quarterWide" | "row";
  onChange: (value: T) => void;
}

const LAYOUT_CLASSES = {
  1: styles.oneColumn,
  2: styles.twoColumns,
  half: styles.half,
  lead: styles.lead,
  quarter: styles.quarter,
  quarterWide: styles.quarterWide,
  row: styles.row,
};

// Native radios, so arrow keys and screen readers work without extra code.
export function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  columns = 1,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.container}>
        <div className={LAYOUT_CLASSES[columns]}>
          {options.map((option) => (
            <label
              key={option.value}
              className={
                option.swatch
                  ? `${styles.option} ${styles.swatchOption}`
                  : styles.option
              }
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={option.value === value}
                onChange={() => onChange(option.value)}
              />
              {option.swatch && (
                <span
                  className={styles.swatch}
                  style={{ "--swatch": option.swatch } as CSSProperties}
                  aria-hidden="true"
                />
              )}
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
