import { findProduct } from "@/engine/catalogue";
import type { SkuCutPlan } from "@/engine/cutting";
import { describeCutPattern, describeCutPlan } from "@/lib/format";
import styles from "./CutList.module.scss";

interface CutListProps {
  plans: SkuCutPlan[];
}

export function CutList({ plans }: CutListProps) {
  return (
    <div className={styles.cutList}>
      <h3>Cut list</h3>
      {plans.map((plan) => (
        <div key={plan.sku} className={styles.plan}>
          <h4>{findProduct(plan.sku)?.name}</h4>
          <p className={styles.summary}>{describeCutPlan(plan)}</p>
          {plan.savedLengths > 0 && (
            <p className={styles.saved}>
              Mixing cut lengths saves {plan.savedLengths} of{" "}
              {plan.unmixedLengths} stock lengths.
            </p>
          )}
          <ul className={styles.patterns}>
            {plan.patterns.map((pattern) => {
              const text = describeCutPattern(pattern);
              return <li key={text}>{text}</li>;
            })}
          </ul>
        </div>
      ))}
      <p className={styles.note}>
        Waste counts offcuts, not metal lost to the saw.
      </p>
    </div>
  );
}
