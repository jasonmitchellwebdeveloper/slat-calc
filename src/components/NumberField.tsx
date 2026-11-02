import { useState } from "react";
import styles from "./NumberField.module.scss";
import { parseWholeNumber, type Validate } from "./validation";

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number;
  validate: Validate;
  onChange: (value: number) => void;
}

// Keeps the raw text so a half-typed value stays on screen. An error appears
// on blur and clears as soon as the value is valid, not on every keystroke.
export function NumberField({
  id,
  label,
  hint,
  value,
  validate,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [blurred, setBlurred] = useState(false);
  const error = blurred ? validate(value) : undefined;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onBlur={() => setBlurred(true)}
        onChange={(event) => {
          const parsed = parseWholeNumber(event.target.value);
          setText(event.target.value);
          if (!validate(parsed)) setBlurred(false);
          onChange(parsed);
        }}
      />
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
