import { useState } from "react";
import type { PriceContext } from "@/engine/pricing";
import { buildQuote, QuoteSchema, type Quote } from "@/engine/quote";
import type { Design } from "@/engine/types";
import { Button } from "../Button/Button";
import styles from "./QuoteRequest.module.scss";

interface QuoteRequestProps {
  design: Design;
  pricing: PriceContext;
  disabled: boolean;
}

interface SentQuote {
  ref: string;
  payload: Quote;
  design: Design;
  pricing: PriceContext;
}

type Status = "idle" | "sending" | "failed";

export function QuoteRequest({ design, pricing, disabled }: QuoteRequestProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [sent, setSent] = useState<SentQuote | null>(null);
  // A reference only stands for the design and prices it was issued against.
  const current =
    sent && sent.design === design && sent.pricing === pricing ? sent : null;

  async function submit() {
    setStatus("sending");
    try {
      const payload = QuoteSchema.parse(buildQuote(design, pricing));
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Quote failed: ${response.status}`);
      const { quoteRef } = await response.json();
      setSent({ ref: quoteRef, payload, design, pricing });
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className={styles.request}>
      <Button
        variant="primary"
        disabled={disabled || status === "sending"}
        onClick={submit}
      >
        {status === "sending" ? "Sending…" : "Request quote"}
      </Button>
      {/* Always rendered, so screen readers announce the message when it fills. */}
      <div role="status">
        {status === "failed" && (
          <p className={styles.failed}>
            Couldn&apos;t send your quote. Check your connection and try again.
          </p>
        )}
        {current && status !== "failed" && (
          <p className={styles.sent}>
            Quote {current.ref} received. This is a demo, so no order is placed.
          </p>
        )}
      </div>
      {current && (
        <details className={styles.payload}>
          <summary>View payload</summary>
          <pre tabIndex={0}>{JSON.stringify(current.payload, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
