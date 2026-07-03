/**
 * Best-effort contact extraction from a business's public website text, so
 * discovered leads come with something to actually reach out on. Tuned for
 * Indian businesses (mobile format). Returns nulls when nothing usable is found.
 */
export function extractContacts(text: string): { email: string | null; phone: string | null } {
  return { email: extractEmail(text), phone: extractIndianPhone(text) };
}

function extractEmail(text: string): string | null {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  for (const raw of matches) {
    const e = raw.toLowerCase();
    // Skip asset filenames and common non-contact/placeholder addresses.
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e)) continue;
    if (/(example|sentry|wixpress|godaddy|yourdomain|placeholder|@sentry|no-?reply)/.test(e)) continue;
    return e;
  }
  return null;
}

function extractIndianPhone(text: string): string | null {
  // Indian mobile: 10 digits starting 6–9, tolerating +91/0 prefixes and
  // space/dash separators (e.g. "+91 98765 43210", "09876543210").
  const m = text.match(/(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91${digits}` : null;
}
