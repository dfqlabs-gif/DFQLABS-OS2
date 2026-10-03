export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return "";
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return rawPhone.trim();

  if (digits.startsWith("234") && digits.length === 13) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }

  if (digits.length === 10 && !digits.startsWith("0")) {
    return `+234${digits}`;
  }

  if (!rawPhone.startsWith("+") && digits.length > 8) {
    return `+${digits}`;
  }

  return rawPhone.startsWith("+") ? `+${digits}` : rawPhone.trim();
}
