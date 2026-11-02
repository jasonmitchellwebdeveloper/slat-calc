import type { CutPattern, CutPlan } from "@/engine/cutting";

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function formatCents(cents: number): string {
  return AUD.format(cents / 100);
}

function lengthsLabel(count: number): string {
  return `${count} ${count === 1 ? "length" : "lengths"}`;
}

export function describeCutPlan({
  lengths,
  wastePct,
}: Pick<CutPlan, "lengths" | "wastePct">): string {
  return `${lengthsLabel(lengths)}, ${(wastePct * 100).toFixed(1)}% waste`;
}

export function describeCutPattern({
  count,
  cuts,
  offcutMm,
}: CutPattern): string {
  const pieces = cuts.map((c) => `${c.qty} × ${c.lengthMm} mm`).join(" + ");
  const offcut = offcutMm > 0 ? `${offcutMm} mm offcut` : "no offcut";
  return `${lengthsLabel(count)}: ${pieces}, ${offcut}`;
}
