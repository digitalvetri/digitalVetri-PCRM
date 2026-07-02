/**
 * In-memory fixed-window rate limiter for expensive endpoints (AI generation,
 * public scraping). Keyed per user so one account can't exhaust provider quota
 * or run up cost by looping a route.
 *
 * NOTE: state is per-process. This is correct for a single-instance internal
 * deployment; a multi-instance/serverless setup would need a shared store
 * (Redis/Upstash) behind the same `rateLimit` interface.
 */
import { ApiError } from "@/lib/api-error";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Milliseconds until the window resets (0 when not limited). */
  retryAfterMs: number;
}

/**
 * Record a hit against `key` and report whether it's allowed. Fixed window of
 * `windowMs`, at most `limit` hits per window.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
    pruneExpired(now);
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** Throw a 429 ApiError when `key` is over its limit; otherwise record the hit. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    throw new ApiError(429, `Too many requests. Please try again in ${seconds}s.`);
  }
}

/** Drop expired buckets so the map can't grow unbounded. Cheap, only when large. */
function pruneExpired(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/** Test-only: clear all rate-limit state. */
export function __resetRateLimits(): void {
  buckets.clear();
}
