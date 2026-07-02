/**
 * India-time (IST, UTC+05:30) day/month boundaries.
 *
 * The business operates in India but the server runs in UTC, so a naive
 * `new Date(); setHours(0,0,0,0)` rolls the day at 05:30 IST and misattributes
 * IST-evening activity (18:30–24:00 IST) to the next day/month. These helpers
 * compute the correct UTC instant for an IST wall-clock boundary. Every
 * "today / overdue / this month" cutoff should use them.
 *
 * Each takes an explicit `at` (default now) so the logic is unit-testable.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30
const DAY_MS = 24 * 60 * 60 * 1000;

function istParts(at: Date): { year: number; month: number; day: number } {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** UTC instant of IST 00:00:00 of the day containing `at`. */
export function istStartOfDay(at: Date = new Date()): Date {
  const { year, month, day } = istParts(at);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** UTC instant of IST 23:59:59.999 of the day containing `at`. */
export function istEndOfDay(at: Date = new Date()): Date {
  return new Date(istStartOfDay(at).getTime() + DAY_MS - 1);
}

/** UTC instant of IST 00:00:00 on the 1st of the month containing `at`. */
export function istStartOfMonth(at: Date = new Date()): Date {
  const { year, month } = istParts(at);
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/** UTC instant of the last millisecond of the IST month containing `at`. */
export function istEndOfMonth(at: Date = new Date()): Date {
  const { year, month } = istParts(at);
  return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS - 1);
}

/** yyyy-MM key of the IST month containing `at` — for bucketing month charts. */
export function istMonthKey(at: Date): string {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * yyyy-MM-dd for an `<input type="date">`, rendered in IST so a value stored as
 * IST midnight round-trips to the same calendar day (naive toISOString would
 * show the previous day for IST-midnight instants).
 */
export function istDateInputValue(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Parse a value from an `<input type="date">` ("yyyy-mm-dd") as IST local
 * midnight rather than UTC midnight (which would shift it 5.5h earlier). Full
 * datetime strings are parsed as-is. Returns null for unparseable input.
 */
export function parseISTDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0) - IST_OFFSET_MS);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
