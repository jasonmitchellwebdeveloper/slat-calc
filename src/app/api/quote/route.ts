import { createQuoteRef, QuoteSchema, verifyQuote } from "@/engine/quote";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = QuoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_quote", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // A real integration would take the tier and account from the login session,
  // not the request. This demo has no accounts, so it trusts what's sent.
  if (!verifyQuote(parsed.data)) {
    return Response.json({ error: "price_mismatch" }, { status: 422 });
  }

  // TODO: forward to commercebuild / Sage here
  return Response.json({ quoteRef: createQuoteRef(), status: "received" });
}
