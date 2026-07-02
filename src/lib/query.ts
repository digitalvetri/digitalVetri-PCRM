import { LEAD_GRADES, PROSPECT_STATUSES } from "@/lib/constants";

/**
 * Safe parsers for URL query params on list/export endpoints. Malformed input
 * (`?page=abc`, `?status=FOO`, `?minEmployees=x`) must never reach Prisma —
 * a NaN skip/take or an invalid enum throws PrismaClientValidationError and
 * 500s the whole list. These coerce bad values to safe defaults instead.
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export const FOLLOWUP_STATUSES = ["PENDING", "DONE", "SKIPPED", "RESCHEDULED"] as const;

/** Positive-int param clamped to [1, max]; missing/blank/NaN → `def`.
 *  (Note: Number("") and Number(null) are 0, so blanks are handled explicitly.) */
export function intParam(value: string | null, def: number, max = Number.MAX_SAFE_INTEGER): number {
  if (value === null || value.trim() === "") return def;
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

/** Optional non-negative int (e.g. minEmployees); missing/blank/NaN → undefined. */
export function optionalIntParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
}

/** Return the value only if it is one of `allowed`; otherwise undefined. */
export function enumParam<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Standard page/pageSize → {page, pageSize, skip, take}. */
export function pagination(sp: URLSearchParams, defaultPageSize = 25, maxPageSize = 100) {
  const page = intParam(sp.get("page"), 1);
  const pageSize = intParam(sp.get("pageSize"), defaultPageSize, maxPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export const gradeParam = (v: string | null) => enumParam(v, LEAD_GRADES);
export const prospectStatusParam = (v: string | null) => enumParam(v, PROSPECT_STATUSES);
