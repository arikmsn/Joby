// Normalizes Israeli phone numbers to local format (e.g. "0502463555")
// so the same real-world number can be matched regardless of how it was
// stored (with/without "+972" country code, with/without leading "0").
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return "0" + digits.slice(3);
  if (digits.startsWith("0")) return digits;
  return "0" + digits;
}

// Returns the set of phone string variants that could represent the same
// real-world number across the formats seen in the database.
export function phoneVariants(phone: string): string[] {
  const local = normalizePhone(phone);
  const intl = "+972" + local.slice(1);
  const intlNoPlus = "972" + local.slice(1);
  return Array.from(new Set([phone, local, intl, intlNoPlus]));
}
