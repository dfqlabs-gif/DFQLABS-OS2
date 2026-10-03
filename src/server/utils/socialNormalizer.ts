export function normalizeSocialIdentifier(input: string): string {
  if (!input) return "";
  let cleaned = input.trim().toLowerCase();

  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^www\./, "");
  cleaned = cleaned.replace(/^(instagram\.com|facebook\.com|linkedin\.com\/in|linkedin\.com\/company)\//, "");
  cleaned = cleaned.replace(/^@/, "");
  cleaned = cleaned.replace(/\/+$/, "");

  return cleaned;
}
