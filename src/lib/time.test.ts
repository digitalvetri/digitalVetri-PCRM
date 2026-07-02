import { describe, it, expect } from "vitest";
import {
  istStartOfDay,
  istEndOfDay,
  istStartOfMonth,
  istEndOfMonth,
  parseISTDate,
  istMonthKey,
  istDateInputValue,
} from "./time";

describe("IST day/month boundaries", () => {
  // 2026-07-02T20:00:00Z is 2026-07-03 01:30 IST — i.e. already the next IST day.
  const eveningIST = new Date("2026-07-02T20:00:00Z");

  it("rolls the day at IST midnight, not UTC midnight", () => {
    // IST midnight of Jul 3 == Jul 2 18:30 UTC.
    expect(istStartOfDay(eveningIST).toISOString()).toBe("2026-07-02T18:30:00.000Z");
    expect(istEndOfDay(eveningIST).toISOString()).toBe("2026-07-03T18:29:59.999Z");
  });

  it("a UTC-evening instant belongs to the correct IST day", () => {
    const start = istStartOfDay(eveningIST);
    expect(eveningIST >= start).toBe(true);
    expect(eveningIST <= istEndOfDay(eveningIST)).toBe(true);
  });

  it("attributes IST-evening month-end activity to the right month", () => {
    // 2026-06-30 20:00 UTC == 2026-07-01 01:30 IST → belongs to JULY, not June.
    const julyInIST = new Date("2026-06-30T20:00:00Z");
    expect(istStartOfMonth(julyInIST).toISOString()).toBe("2026-06-30T18:30:00.000Z"); // IST Jul 1
    // 2026-06-30 17:00 UTC == 2026-06-30 22:30 IST → still JUNE.
    const juneInIST = new Date("2026-06-30T17:00:00Z");
    expect(istStartOfMonth(juneInIST).toISOString()).toBe("2026-05-31T18:30:00.000Z"); // IST Jun 1
  });

  it("computes IST month end", () => {
    expect(istEndOfMonth(eveningIST).toISOString()).toBe("2026-07-31T18:29:59.999Z");
  });
});

describe("istMonthKey — buckets by IST month", () => {
  it("puts an IST-evening month-boundary instant in the correct month", () => {
    // 2026-07-31 21:30 UTC == 2026-08-01 03:00 IST → August.
    expect(istMonthKey(new Date("2026-07-31T21:30:00Z"))).toBe("2026-08");
    // 2026-07-31 17:00 UTC == 2026-07-31 22:30 IST → July.
    expect(istMonthKey(new Date("2026-07-31T17:00:00Z"))).toBe("2026-07");
  });
});

describe("istDateInputValue — <input type=date> value in IST", () => {
  it("round-trips an IST-midnight instant to the same calendar day", () => {
    // A date stored as Jul 10 IST midnight is Jul 9 18:30 UTC.
    const stored = parseISTDate("2026-07-10")!;
    expect(istDateInputValue(stored)).toBe("2026-07-10");
  });
  it("keeps an IST-evening instant on the same IST day", () => {
    // 2026-07-10 20:00 UTC == 2026-07-11 01:30 IST.
    expect(istDateInputValue(new Date("2026-07-10T20:00:00Z"))).toBe("2026-07-11");
  });
});

describe("parseISTDate", () => {
  it("parses a date-only string as IST midnight (not UTC midnight)", () => {
    // Jul 10 00:00 IST == Jul 9 18:30 UTC.
    expect(parseISTDate("2026-07-10")?.toISOString()).toBe("2026-07-09T18:30:00.000Z");
  });

  it("parses a full datetime string as-is", () => {
    expect(parseISTDate("2026-07-10T05:00:00Z")?.toISOString()).toBe("2026-07-10T05:00:00.000Z");
  });

  it("returns null for unparseable input", () => {
    expect(parseISTDate("not-a-date")).toBeNull();
    expect(parseISTDate("")).toBeNull();
  });
});
