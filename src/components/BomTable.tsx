import type { PricedLine } from "@/engine/pricing";
import styles from "./BomTable.module.scss";
import { formatCents } from "./format";

interface BomTableProps {
  lines: PricedLine[];
  colourName: string;
}

export function BomTable({ lines, colourName }: BomTableProps) {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>
        <span className={styles.title}>Bill of materials</span>
        <span className={styles.note}>{colourName} finish. Prices ex GST.</span>
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
