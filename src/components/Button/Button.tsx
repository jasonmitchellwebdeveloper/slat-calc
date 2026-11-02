import type { ComponentProps } from "react";
import styles from "./Button.module.scss";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "secondary", ...props }: ButtonProps) {
  return <button type="button" className={styles[variant]} {...props} />;
}
