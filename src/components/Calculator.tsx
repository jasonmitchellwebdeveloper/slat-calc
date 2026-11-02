"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import { COLOURS } from "@/engine/catalogue";
import { calculate } from "@/engine/calculate";
import { DEMO_ACCOUNT_CODE, type PriceContext } from "@/engine/pricing";
import type { Design, Mounting } from "@/engine/types";
import { BomTable } from "./BomTable";
import styles from "./Calculator.module.scss";
import { CopyLinkButton } from "./CopyLinkButton";
import { CutList } from "./CutList";
import { designReducer } from "./designReducer";
import { designSearch, readDesignFromSearch } from "./designUrl";
import { Elevation } from "./Elevation";
import { HeightPicker } from "./HeightPicker";
import { OptionGroup, type Option } from "./OptionGroup";
import { PriceSummary } from "./PriceSummary";
import { RunBuilder } from "./RunBuilder";
import { SummaryBar } from "./SummaryBar";
import type { Unit } from "./validation";

const URL_SYNC_DELAY_MS = 300;

type PriceList = "retail" | "trade" | "account";

const PRICE_CONTEXTS: Record<PriceList, PriceContext> = {
  retail: { tier: "retail" },
  trade: { tier: "trade" },
  account: { tier: "trade", accountCode: DEMO_ACCOUNT_CODE },
};

const PRICE_LIST_OPTIONS: Option<PriceList>[] = [
  { value: "retail", label: "Retail" },
  { value: "trade", label: "Trade" },
  { value: "account", label: `Demo account (${DEMO_ACCOUNT_CODE})` },
];

const UNIT_OPTIONS: Option<Unit>[] = [
  { value: "m", label: "Metres" },
  { value: "mm", label: "Millimetres" },
];

const COLOUR_OPTIONS: Option<string>[] = COLOURS.map((colour) => ({
  value: colour.id,
  label: colour.name,
  swatch: colour.hex,
}));

const MOUNTING_OPTIONS: Option<Mounting>[] = [
  { value: "in-ground", label: "In-ground" },
  { value: "base-plate", label: "Base plate" },
];

// The page is prerendered without a query string, so a shared link can only be
// read in the browser. This hydrates cleanly, then swaps in the linked design.
let firstSearch: string | undefined;
const getBrowserSearch = () => (firstSearch ??= window.location.search);
const getServerSearch = () => "";
const subscribeToNothing = () => () => {};

export function Calculator() {
  const search = useSyncExternalStore(
    subscribeToNothing,
    getBrowserSearch,
    getServerSearch,
  );
  const { design, linkInvalid } = useMemo(
    () => readDesignFromSearch(search),
    [search],
  );
  // The key resets every field's typed text when the linked design arrives.
  return (
    <CalculatorForm
      key={search}
      startDesign={design}
      linkInvalid={linkInvalid}
    />
  );
}

interface CalculatorFormProps {
  startDesign: Design;
  linkInvalid: boolean;
}

function CalculatorForm({ startDesign, linkInvalid }: CalculatorFormProps) {
  const [design, dispatch] = useReducer(designReducer, startDesign);
  const [priceList, setPriceList] = useState<PriceList>("retail");
  const [unit, setUnit] = useState<Unit>("m");
  const pricing = PRICE_CONTEXTS[priceList];
  const result = useMemo(() => calculate(design, pricing), [design, pricing]);

  // While a field is half-typed the last valid figures stay on screen, dimmed.
  // Removing them would shrink the page and move the field being typed in.
  const [lastValidDesign, setLastValidDesign] = useState(design);
  if (result.ok && design !== lastValidDesign) setLastValidDesign(design);
  const shown = useMemo(
    () => (result.ok ? result : calculate(lastValidDesign, pricing)),
    [result, lastValidDesign, pricing],
  );
  const colour = COLOURS.find((c) => c.id === lastValidDesign.colour);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Only valid designs reach the address bar, so a copied URL always loads.
  useEffect(() => {
    if (lastValidDesign === startDesign) return;
    const timer = setTimeout(() => {
      const { pathname, hash } = window.location;
      const url = `${pathname}${designSearch(lastValidDesign)}${hash}`;
      window.history.replaceState(null, "", url);
    }, URL_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [lastValidDesign, startDesign]);

  return (
    <>
      <div className={styles.layout}>
        {linkInvalid && (
          <p className={styles.linkNotice} role="alert">
            That design link couldn&apos;t be read, so this is the starting
            design instead.
          </p>
        )}
        {shown.ok && (
          <section
            className={`${styles.card} ${styles.preview}`}
            aria-labelledby="step-preview"
          >
            <h2 id="step-preview">Preview</h2>
            <Elevation
              design={lastValidDesign}
              layouts={shown.layouts}
              selectedRunId={selectedRunId}
              colourHex={colour?.hex ?? ""}
              stale={!result.ok}
              onSelectRun={setSelectedRunId}
            />
          </section>
        )}
        <div className={`${styles.column} ${styles.form}`}>
          <div className={styles.card}>
            <OptionGroup
              legend="Enter measurements in"
              name="unit"
              columns="row"
              options={UNIT_OPTIONS}
              value={unit}
              onChange={setUnit}
            />
          </div>
          <section className={styles.card} aria-labelledby="step-height">
            <h2 id="step-height">Height</h2>
            <HeightPicker
              design={design}
              options={result.heightOptions}
              unit={unit}
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
            <RunBuilder
              runs={design.runs}
              unit={unit}
              dispatch={dispatch}
              onSelectRun={setSelectedRunId}
            />
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
        <div className={`${styles.column} ${styles.output}`}>
          <section
            id="results"
            className={styles.card}
            aria-labelledby="step-results"
          >
            <h2 id="step-results">Results</h2>
            <div className={styles.results}>
              <OptionGroup
                legend="Price list"
                name="price-list"
                options={PRICE_LIST_OPTIONS}
                value={priceList}
                onChange={setPriceList}
              />
              <CopyLinkButton design={lastValidDesign} disabled={!result.ok} />
              {!result.ok && (
                <p className={styles.notice}>
                  Check your entries. These figures are from your last valid
                  design.
                </p>
              )}
              {shown.ok && (
                <div
                  className={result.ok ? styles.figures : styles.staleFigures}
                  inert={!result.ok}
                >
                  <PriceSummary priced={shown.priced} />
                  <BomTable
                    lines={shown.priced.lines}
                    colourName={colour?.name ?? ""}
                  />
                  <CutList plans={shown.cutPlans} />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      <SummaryBar
        totalCents={result.ok ? result.priced.totals.incGstCents : null}
      />
    </>
  );
}
