import type { PricedLine } from "@/engine/pricing";
import { formatCents } from "@/lib/format";
import styles from "./BomTable.module.scss";

interface BomTableProps {
  lines: PricedLine[];
  finish: string;
}

export function BomTable({ lines, finish }: BomTableProps) {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>
        <span className={styles.title}>Bill of materials</span>
        <span className={styles.note}>{finish}. Prices ex GST.</span>
      </caption>
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col" className={styles.number}>
            Qty
          </th>
          <th scope="col" className={styles.number}>
            Unit
          </th>
          <th scope="col" className={styles.number}>
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.sku}>
            <th scope="row">
              {line.name}
              {line.contractPrice && (
                <span className={styles.contract}>Contract price</span>
              )}
            </th>
            <td className={styles.number}>{line.qty}</td>
            <td className={styles.number}>
              {formatCents(line.unitPriceCents)}
            </td>
            <td className={styles.number}>
              {formatCents(line.lineTotalCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
