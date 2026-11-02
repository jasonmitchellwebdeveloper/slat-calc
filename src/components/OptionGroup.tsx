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
  columns?: 1 | 2;
  onChange: (value: T) => void;
}

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
      <div className={columns === 2 ? styles.twoColumns : styles.oneColumn}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
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
    </fieldset>
  );
}
