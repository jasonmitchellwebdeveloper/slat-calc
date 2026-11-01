import { describe, expect, it } from "vitest";
import { formatCents } from "../format";

describe("formatCents", () => {
  it("formats whole-cent amounts as Australian dollars", () => {
    expect(formatCents(152185)).toBe("$1,521.85");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
  });
});
