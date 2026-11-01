"use client";

import { COLOURS } from "@/engine/catalogue";
import { calculate } from "@/engine/calculate";
import type { PriceContext } from "@/engine/pricing";
import type { Design } from "@/engine/types";
import styles from "./Calculator.module.scss";
import { SummaryBar } from "./SummaryBar";

const INITIAL_DESIGN: Design = {
  targetHeightMm: 1800,
  gapMm: 5,
  slatCount: 25,
  colour: "charcoal",
  mounting: "in-ground",
  runs: [{ id: "run-1", lengthMm: 6000, startsAtCorner: false }],
};

const INITIAL_PRICING: PriceContext = { tier: "retail" };

export function Calculator() {
  const design = INITIAL_DESIGN;
  const result = calculate(design, INITIAL_PRICING);
  const selected = result.heightOptions.find(
    (o) => o.gapMm === design.gapMm && o.slatCount === design.slatCount,
  );
  const colour = COLOURS.find((c) => c.id === design.colour);

  return (
    <>
      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="step-height">
            <h2 id="step-height">Height</h2>
            {selected && (
              <p>
                {selected.fenceHeightMm} mm, {selected.slatCount} slats,{" "}
                {selected.gapMm} mm gap
              </p>
            )}
          </section>
          <section className={styles.card} aria-labelledby="step-colour">
            <h2 id="step-colour">Colour</h2>
            <p>{colour?.name}</p>
          </section>
          <section className={styles.card} aria-labelledby="step-runs">
            <h2 id="step-runs">Runs</h2>
            <p>
              {design.runs.length} run, {design.runs[0].lengthMm} mm
            </p>
          </section>
          <section className={styles.card} aria-labelledby="step-mounting">
            <h2 id="step-mounting">Mounting</h2>
            <p>In-ground</p>
          </section>
        </div>
        <div className={styles.column}>
          <section
            id="results"
            className={styles.card}
            aria-labelledby="step-results"
          >
            <h2 id="step-results">Results</h2>
            {result.ok ? (
              <p>
                {result.layouts[0].bays} bays, {result.layouts[0].posts} posts,{" "}
                {result.cutPlans[0].lengths} slat lengths
              </p>
            ) : (
              <p role="alert">{result.error}</p>
            )}
          </section>
        </div>
      </div>
      <SummaryBar
        totalCents={result.ok ? result.priced.totals.incGstCents : null}
      />
    </>
  );
}
