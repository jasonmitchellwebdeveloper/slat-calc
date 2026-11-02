import { formatCents } from "@/lib/format";
import styles from "./SummaryBar.module.scss";

interface SummaryBarProps {
  totalCents: number | null; // null while the design is invalid
}

export function SummaryBar({ totalCents }: SummaryBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.total} aria-live="polite">
          <span className={styles.label}>Total inc GST</span>
          <span className={styles.amount}>
            {totalCents === null
              ? "Check your design"
              : formatCents(totalCents)}
          </span>
        </div>
        <a className={styles.action} href="#results">
          View quote
        </a>
      </div>
    </div>
  );
}
