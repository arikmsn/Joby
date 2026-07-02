// ============================================================
// Growth Engine — DTO helpers.
// Repositories/handlers must return DTOs, never raw rows.
// Candidate PII is masked by default; unmasked DTOs exist only
// behind growth:candidates.pii and every use is audit-logged.
// ============================================================

/** "0501234567" → "050-***4567". Never returns the full number. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}-***${digits.slice(-4)}`;
}

/** "dana@example.com" → "d***@example.com" */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Masked candidate shape — the DEFAULT for all list/queue endpoints. */
export interface MaskedCandidateDTO {
  id: string;
  full_name: string;
  phone_masked: string;
  email_masked: string | null;
  city: string | null;
  region_code: string | null;
  has_cv: boolean;
  languages: string[];
  consent_marketing: boolean;
  created_at: string | null;
}

export function toMaskedCandidateDTO(row: {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  region_code: string | null;
  cv_file_ref: string | null;
  languages: string[];
  consent_marketing_at: Date | string | null;
  created_at: Date | string | null;
}): MaskedCandidateDTO {
  return {
    id: row.id,
    full_name: row.full_name,
    phone_masked: maskPhone(row.phone),
    email_masked: maskEmail(row.email),
    city: row.city,
    region_code: row.region_code,
    has_cv: !!row.cv_file_ref,
    languages: row.languages,
    consent_marketing: !!row.consent_marketing_at,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}
