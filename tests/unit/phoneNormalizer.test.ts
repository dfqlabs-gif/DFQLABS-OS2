import { describe, expect, it } from "vitest";
import { normalizePhone, validateNigerianMobilePhone } from "../../src/server/utils/phoneNormalizer.js";

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

  it("validates mobile prefixes (070, 080, 081, 090, 091)", () => {
    expect(validateNigerianMobilePhone("08031234567").isValid).toBe(true);
    expect(validateNigerianMobilePhone("09011234567").isValid).toBe(true);
    expect(validateNigerianMobilePhone("07051234567").isValid).toBe(true);
    expect(validateNigerianMobilePhone("08121234567").isValid).toBe(true);
    expect(validateNigerianMobilePhone("09131234567").isValid).toBe(true);
  });

  it("rejects dummy numbers and landlines/invalid prefixes", () => {
    expect(validateNigerianMobilePhone("08000000000").isValid).toBe(false);
    expect(validateNigerianMobilePhone("0123456789").isValid).toBe(false); // Lagos landline
    expect(validateNigerianMobilePhone("12345").isValid).toBe(false);
    expect(validateNigerianMobilePhone("").isValid).toBe(false);
  });
});
