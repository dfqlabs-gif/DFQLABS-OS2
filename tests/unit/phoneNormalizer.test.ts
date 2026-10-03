import { describe, expect, it } from "vitest";
import { normalizePhone } from "../../src/server/utils/phoneNormalizer.js";

describe("phoneNormalizer", () => {
  it("normalizes standard Nigerian 11-digit numbers starting with 0", () => {
    expect(normalizePhone("08012345678")).toBe("+2348012345678");
    expect(normalizePhone("07098765432")).toBe("+2347098765432");
  });

  it("normalizes numbers already starting with 234 without plus", () => {
    expect(normalizePhone("2348012345678")).toBe("+2348012345678");
  });

  it("normalizes numbers with spaces, dashes, or plus", () => {
    expect(normalizePhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("+234-801-234-5678")).toBe("+2348012345678");
  });
});
