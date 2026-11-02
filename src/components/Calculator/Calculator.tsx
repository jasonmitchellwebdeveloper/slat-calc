"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import { calculate } from "@/engine/calculate";
import { COLOURS } from "@/engine/catalogue";
import { DEMO_ACCOUNT_CODE, type PriceContext } from "@/engine/pricing";
import { PANEL_COLOURS } from "@/engine/panelCatalogue";
import type { Colour, ConcreteType, Design, Mounting } from "@/engine/types";
import { designReducer } from "@/lib/designReducer";
import { designSearch, readDesignFromSearch } from "@/lib/designUrl";
import { fenceColours } from "@/lib/fenceColours";
import type { Unit } from "@/lib/validation";
import { BomTable } from "../BomTable/BomTable";
import { Button } from "../Button/Button";
import { CopyLinkButton } from "../CopyLinkButton/CopyLinkButton";
import { CutList } from "../CutList/CutList";
import { Elevation } from "../Elevation/Elevation";
import { HeightPicker } from "../HeightPicker/HeightPicker";
import { OptionGroup, type Option } from "../OptionGroup/OptionGroup";
import { PanelCutList } from "../PanelCutList/PanelCutList";
import { PanelPicker } from "../PanelPicker/PanelPicker";
import { PriceSummary } from "../PriceSummary/PriceSummary";
import { PrintPlan } from "../PrintPlan/PrintPlan";
import { QuoteRequest } from "../QuoteRequest/QuoteRequest";
import { RunBuilder } from "../RunBuilder/RunBuilder";
import { SummaryBar } from "../SummaryBar/SummaryBar";
import styles from "./Calculator.module.scss";

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
  { value: "mm", label: "Millimetres" },
  { value: "m", label: "Metres" },
];

const PRICE_LIST_NAMES: Record<PriceList, string> = {
  retail: "Retail",
  trade: "Trade",
  account: `Account ${DEMO_ACCOUNT_CODE}`,
};

const toColourOption = (colour: Colour): Option<string> => ({
  value: colour.id,
  label: colour.name,
  swatch: colour.hex,
});
const COLOUR_OPTIONS = COLOURS.map(toColourOption);
const PANEL_COLOUR_OPTIONS = PANEL_COLOURS.map(toColourOption);

const SYSTEM_OPTIONS: Option<Design["system"]>[] = [
  { value: "slat", label: "Aluminium slat" },
  { value: "panel", label: "Steel panel" },
];

const CONCRETE_OPTIONS: Option<ConcreteType>[] = [
  { value: "post-mix", label: "Post mix" },
  { value: "rapid-set", label: "Rapid set" },
  { value: "none", label: "Not required" },
];

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
  const [unit, setUnit] = useState<Unit>("mm");
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
  const colours = fenceColours(lastValidDesign);
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
            className={`${styles.card} ${styles.preview} ${styles.screenOnly}`}
            aria-labelledby="step-preview"
          >
            <h2 id="step-preview">Preview</h2>
            <Elevation
              design={lastValidDesign}
              layouts={shown.layouts}
              selectedRunId={selectedRunId}
              colourHex={colours.infillHex}
              frameHex={colours.frameHex}
              stale={!result.ok}
              onSelectRun={setSelectedRunId}
            />
          </section>
        )}
        <div className={`${styles.column} ${styles.form} ${styles.screenOnly}`}>
          <div className={styles.card}>
            <OptionGroup
              legend="Fence type"
              name="system"
              columns="row"
              options={SYSTEM_OPTIONS}
              value={design.system}
              onChange={(system) => dispatch({ type: "setSystem", system })}
            />
          </div>
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
            <h2 id="step-height">
              {design.system === "slat" ? "Height" : "Panels"}
            </h2>
            {design.system === "slat" ? (
              <HeightPicker
                design={design}
                options={result.heightOptions}
                unit={unit}
                dispatch={dispatch}
              />
            ) : (
              <PanelPicker design={design} dispatch={dispatch} />
            )}
          </section>
          <section className={styles.card} aria-labelledby="step-colour">
            <h2 id="step-colour">Colour</h2>
            <div className={styles.fields}>
              <OptionGroup
                legend={
                  design.system === "slat"
                    ? "Slat and post finish"
                    : "Infill sheets"
                }
                name="colour"
                columns={2}
                options={
                  design.system === "slat"
                    ? COLOUR_OPTIONS
                    : PANEL_COLOUR_OPTIONS
                }
                value={design.colour}
                onChange={(colour) => dispatch({ type: "setColour", colour })}
              />
              {design.system === "panel" && (
                <OptionGroup
                  legend="Posts and rails"
                  name="frame-colour"
                  columns={2}
                  options={PANEL_COLOUR_OPTIONS}
                  value={design.frameColour}
                  onChange={(colour) =>
                    dispatch({ type: "setFrameColour", colour })
                  }
                />
              )}
            </div>
          </section>
          <section className={styles.card} aria-labelledby="step-runs">
            <h2 id="step-runs">Runs</h2>
            <RunBuilder
              runs={design.runs}
              system={design.system}
              unit={unit}
              dispatch={dispatch}
              onSelectRun={setSelectedRunId}
            />
          </section>
          <section className={styles.card} aria-labelledby="step-mounting">
            <h2 id="step-mounting">Mounting</h2>
            <div className={styles.fields}>
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
              {design.system === "panel" && design.mounting === "in-ground" && (
                <OptionGroup
                  legend="Concrete"
                  name="concrete"
                  columns="row"
                  options={CONCRETE_OPTIONS}
                  value={design.concrete}
                  onChange={(concrete) =>
                    dispatch({ type: "setConcrete", concrete })
                  }
                />
              )}
            </div>
          </section>
        </div>
        {shown.ok && (
          <PrintPlan
            design={lastValidDesign}
            layouts={shown.layouts}
            finish={colours.finish}
            infillHex={colours.infillHex}
            frameHex={colours.frameHex}
            priceListName={PRICE_LIST_NAMES[priceList]}
          />
        )}
        <div className={`${styles.column} ${styles.output}`}>
          <section
            id="results"
            className={styles.card}
            aria-labelledby="step-results"
          >
            <h2 id="step-results">Results</h2>
            <div className={styles.results}>
              <div className={styles.screenOnly}>
                <OptionGroup
                  legend="Price list"
                  name="price-list"
                  options={PRICE_LIST_OPTIONS}
                  value={priceList}
                  onChange={setPriceList}
                />
              </div>
              <div className={`${styles.actions} ${styles.screenOnly}`}>
                <QuoteRequest
                  design={lastValidDesign}
                  pricing={pricing}
                  disabled={!result.ok}
                />
                <CopyLinkButton
                  design={lastValidDesign}
                  disabled={!result.ok}
                />
                <Button disabled={!result.ok} onClick={() => window.print()}>
                  Print plan
                </Button>
              </div>
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
                    finish={colours.finish}
                  />
                  {lastValidDesign.system === "slat" ? (
                    <CutList plans={shown.cutPlans} />
                  ) : (
                    <PanelCutList layouts={shown.layouts} />
                  )}
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
