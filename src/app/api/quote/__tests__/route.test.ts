import { describe, expect, it } from "vitest";
import { initialDesign } from "@/lib/designReducer";
import { buildQuote } from "@/engine/quote";
import { POST } from "../route";

const valid = buildQuote(initialDesign, { tier: "retail" });

function post(body: string) {
  return POST(
    new Request("http://localhost/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/quote", () => {
  it("returns a reference for a valid quote", async () => {
    const response = await post(JSON.stringify(valid));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("received");
    expect(body.quoteRef).toMatch(/^Q-\d{8}-[0-9A-F]{4}$/);
  });

  it("returns 400 with the issues for an invalid quote", async () => {
    const response = await post(JSON.stringify({ ...valid, lines: "none" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_quote");
    expect(body.issues[0].path).toEqual(["lines"]);
  });

  it("returns 400 for a body that isn't JSON", async () => {
    const response = await post("{not json");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_json");
  });

  it("returns 422 when the prices don't match the catalogue", async () => {
    const tampered = {
      ...valid,
      totals: { ...valid.totals, incGstCents: 100 },
    };
    const response = await post(JSON.stringify(tampered));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("price_mismatch");
    expect(body.quoteRef).toBeUndefined();
  });
});
