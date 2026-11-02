"use client";

import { useMemo, useReducer } from "react";
import { COLOURS } from "@/engine/catalogue";
import { calculate } from "@/engine/calculate";
import type { PriceContext } from "@/engine/pricing";
import type { Mounting } from "@/engine/types";
import styles from "./Calculator.module.scss";
import { designReducer, initialDesign } from "./designReducer";
import { HeightPicker } from "./HeightPicker";
import { OptionGroup, type Option } from "./OptionGroup";
import { RunBuilder } from "./RunBuilder";
import { SummaryBar } from "./SummaryBar";

const INITIAL_PRICING: PriceContext = { tier: "retail" };

const COLOUR_OPTIONS: Option<string>[] = COLOURS.map((colour) => ({
  value: colour.id,
  label: colour.name,
  swatch: colour.hex,
}));

const MOUNTING_OPTIONS: Option<Mounting>[] = [
  { value: "in-ground", label: "In-ground" },
  { value: "base-plate", label: "Base plate" },
];

export function Calculator() {
  const [design, dispatch] = useReducer(designReducer, initialDesign);
  const result = useMemo(() => calculate(design, INITIAL_PRICING), [design]);

  return (
    <>
      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="step-height">
            <h2 id="step-height">Height</h2>
            <HeightPicker
              design={design}
              options={result.heightOptions}
              dispatch={dispatch}
            />
          </section>
          <section className={styles.card} aria-labelledby="step-colour">
            <h2 id="step-colour">Colour</h2>
            <OptionGroup
              legend="Slat and post finish"
              name="colour"
              columns={2}
              options={COLOUR_OPTIONS}
              value={design.colour}
              onChange={(colour) => dispatch({ type: "setColour", colour })}
            />
          </section>
          <section className={styles.card} aria-labelledby="step-runs">
            <h2 id="step-runs">Runs</h2>
            <RunBuilder runs={design.runs} dispatch={dispatch} />
          </section>
          <section className={styles.card} aria-labelledby="step-mounting">
            <h2 id="step-mounting">Mounting</h2>
            <OptionGroup
              legend="How the posts are fixed"
              name="mounting"
              columns={2}
              options={MOUNTING_OPTIONS}
              value={design.mounting}
              onChange={(mounting) =>
                dispatch({ type: "setMounting", mounting })
              }
            />
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
                {result.layouts.reduce((sum, l) => sum + l.bays, 0)} bays,{" "}
                {result.layouts.reduce((sum, l) => sum + l.posts, 0)} posts,{" "}
                {result.cutPlans[0].lengths} slat lengths
              </p>
            ) : (
              <p>Check the highlighted fields to see your quote.</p>
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
