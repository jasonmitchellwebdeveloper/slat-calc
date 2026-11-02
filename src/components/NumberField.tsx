import { useRef, useState } from "react";
import styles from "./NumberField.module.scss";
import {
  formatLength,
  parseLengthMm,
  type Unit,
  type Validate,
} from "./validation";

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number; // always mm
  unit: Unit;
  validate: Validate;
  onChange: (value: number) => void;
}

// Keeps the raw text so a half-typed value stays on screen. An error appears
// on blur and clears as soon as the value is valid, not on every keystroke.
// Focusing selects the value, so typing replaces it without deleting first.
// Give it a key that includes the unit, so switching rewrites the text from the
// design.
export function NumberField({
  id,
  label,
  hint,
  value,
  unit,
  validate,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(formatLength(value, unit));
  // A value that's already invalid when switching units shows its error at once.
  const [blurred, setBlurred] = useState(Boolean(validate(value, unit)));
  const error = blurred ? validate(value, unit) : undefined;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const justFocused = useRef(false);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} <span className={styles.visuallyHidden}>({unit})</span>
      </label>
      <div className={styles.control}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode={unit === "m" ? "decimal" : "numeric"}
          autoComplete="off"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onFocus={(event) => {
            justFocused.current = true;
            event.target.select();
          }}
          // Finishing a tap can clear the selection, so the tap that focused the
          // field selects again. Later taps place the cursor as normal.
          onClick={(event) => {
            if (justFocused.current) event.currentTarget.select();
            justFocused.current = false;
          }}
          onBlur={() => {
            justFocused.current = false;
            setBlurred(true);
          }}
          onChange={(event) => {
            const parsed = parseLengthMm(event.target.value, unit);
            justFocused.current = false;
            setText(event.target.value);
            if (!validate(parsed, unit)) setBlurred(false);
            onChange(parsed);
          }}
        />
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      </div>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
