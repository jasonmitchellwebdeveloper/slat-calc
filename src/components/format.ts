const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export function formatCents(cents: number): string {
  return AUD.format(cents / 100);
}
