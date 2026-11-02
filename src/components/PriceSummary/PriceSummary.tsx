import type { PricedBom } from "@/engine/pricing";
import { formatCents } from "@/lib/format";
import styles from "./PriceSummary.module.scss";

interface PriceSummaryProps {
  priced: PricedBom;
}

export function PriceSummary({ priced }: PriceSummaryProps) {
  const { totals, savingCents } = priced;
  return (
    <dl className={styles.summary}>
      <div className={styles.row}>
        <dt>Subtotal ex GST</dt>
        <dd>{formatCents(totals.exGstCents)}</dd>
      </div>
      <div className={styles.row}>
        <dt>GST</dt>
        <dd>{formatCents(totals.gstCents)}</dd>
      </div>
      <div className={`${styles.row} ${styles.total}`}>
        <dt>Total inc GST</dt>
        <dd>{formatCents(totals.incGstCents)}</dd>
      </div>
      {savingCents > 0 && (
        <div className={`${styles.row} ${styles.saving}`}>
          <dt>Saving against retail, ex GST</dt>
          <dd>{formatCents(savingCents)}</dd>
        </div>
      )}
    </dl>
  );
}
