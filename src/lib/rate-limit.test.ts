import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, enforceRateLimit, __resetRateLimits } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-error";

describe("rateLimit", () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit then blocks within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("user-a", 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("user-a", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    rateLimit("user-a", 1, 60_000);
    expect(rateLimit("user-a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("user-b", 1, 60_000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    expect(rateLimit("user-c", 1, 60_000).ok).toBe(true);
    expect(rateLimit("user-c", 1, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit("user-c", 1, 60_000).ok).toBe(true);
  });

  it("reports decreasing remaining allowance", () => {
    expect(rateLimit("user-d", 3, 60_000).remaining).toBe(2);
    expect(rateLimit("user-d", 3, 60_000).remaining).toBe(1);
    expect(rateLimit("user-d", 3, 60_000).remaining).toBe(0);
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("throws a 429 ApiError once over the limit", () => {
    enforceRateLimit("e-user", 1, 60_000); // first is allowed
    let thrown: unknown;
    try {
      enforceRateLimit("e-user", 1, 60_000);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).status).toBe(429);
  });
});
