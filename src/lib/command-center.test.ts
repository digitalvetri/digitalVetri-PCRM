import { describe, it, expect } from "vitest";
import { targetFunnel, DEFAULT_FUNNEL } from "./command-center";

describe("targetFunnel", () => {
  it("returns null when there is no positive target", () => {
    expect(targetFunnel(null, 0)).toBeNull();
    expect(targetFunnel(0, 0)).toBeNull();
    expect(targetFunnel(-100, 0)).toBeNull();
  });

  it("computes a finite funnel from the default assumptions", () => {
    const f = targetFunnel(10_00_000, 0)!;
    expect(f.remaining).toBe(10_00_000);
    expect(Number.isFinite(f.deals)).toBe(true);
    expect(Number.isFinite(f.leads)).toBe(true);
    expect(f.leads).toBeGreaterThanOrEqual(f.meetings);
    expect(f.meetings).toBeGreaterThanOrEqual(f.proposals);
  });

  it("never yields Infinity/NaN when a conversion rate is zero", () => {
    const zeroRates = { ...DEFAULT_FUNNEL, winRate: 0, meetingToProposal: 0, outreachToMeeting: 0 };
    const f = targetFunnel(10_00_000, 0, zeroRates)!;
    for (const v of [f.deals, f.proposals, f.meetings, f.outreach, f.leads]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("treats target already met as zero remaining work", () => {
    const f = targetFunnel(10_00_000, 12_00_000)!;
    expect(f.remaining).toBe(0);
    expect(f.deals).toBe(0);
    expect(f.leads).toBe(0);
  });
});
