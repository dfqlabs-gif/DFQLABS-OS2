export type PhoneValidationStatus = "MISSING" | "INVALID" | "VALID_NIGERIAN_MOBILE" | "MANUALLY_CONFIRMED";

export interface PhoneValidationResult {
  raw: string;
  normalized?: string;
  status: PhoneValidationStatus;
  isMobile: boolean;
  isValid: boolean;
}

export function validateNigerianMobilePhone(rawPhone?: string): PhoneValidationResult {
  if (!rawPhone || !rawPhone.trim()) {
    return { raw: rawPhone || "", status: "MISSING", isMobile: false, isValid: false };
  }

  const raw = rawPhone.trim();
  const digits = raw.replace(/\D/g, "");

  let national = "";
  if (digits.startsWith("234") && digits.length === 13) {
    national = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length === 11) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  }

  // Reject dummy repeating numbers or numbers with identical subscriber digits (e.g., 8000000000, 8011111111)
  const isDummy =
    /^([0-9])\1{9}$/.test(national) ||
    /^(?:70|80|81|90|91)(\d)\1{7}$/.test(national);

  const isMobilePrefix = /^(?:70|80|81|90|91)\d{8}$/.test(national);

  if (national && isMobilePrefix && !isDummy) {
    const normalized = `+234${national}`;
    return {
      raw,
      normalized,
      status: "VALID_NIGERIAN_MOBILE",
      isMobile: true,
      isValid: true
    };
  }

  return {
    raw,
    status: "INVALID",
    isMobile: false,
    isValid: false
  };
}

export function normalizePhone(rawPhone: string): string {
  const result = validateNigerianMobilePhone(rawPhone);
  if (result.isValid && result.normalized) {
    return result.normalized;
  }
  // Fallback for non-Nigerian or existing raw formats if needed in legacy contexts
  if (!rawPhone) return "";
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return rawPhone.trim();
  return rawPhone.startsWith("+") ? `+${digits}` : rawPhone.trim();
}
