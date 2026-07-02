import { describe, it, expect } from "vitest";
import { formatINR, slugify, enumLabel, initials } from "@/lib/utils";

describe("formatINR", () => {
  it("returns an em dash for null/undefined", () => {
    expect(formatINR(null)).toBe("—");
    expect(formatINR(undefined)).toBe("—");
  });

  it("formats with Indian digit grouping and the rupee sign", () => {
    const out = formatINR(1234567);
    expect(out).toContain("₹");
    expect(out).toContain("12,34,567");
  });

  it("uses compact crore/lakh/thousand tiers when requested", () => {
    expect(formatINR(1_00_00_000, true)).toBe("₹1.00 Cr");
    expect(formatINR(2_50_00_000, true)).toBe("₹2.50 Cr");
    expect(formatINR(1_00_000, true)).toBe("₹1.0 L");
    expect(formatINR(5_000, true)).toBe("₹5K");
    // K bucket keeps one significant decimal instead of rounding to a whole K.
    expect(formatINR(1_500, true)).toBe("₹1.5K");
    expect(formatINR(2_500, true)).toBe("₹2.5K");
  });

  it("falls back to full format below the compact thresholds", () => {
    expect(formatINR(999, true)).toContain("999");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Corp Pvt Ltd")).toBe("acme-corp-pvt-ltd");
  });

  it("strips punctuation and leading/trailing hyphens", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
  });

  it("falls back to 'company' for empty/symbol-only input", () => {
    expect(slugify("")).toBe("company");
    expect(slugify("---")).toBe("company");
    expect(slugify("!@#")).toBe("company");
  });
});

describe("enumLabel", () => {
  it("special-cases A_PLUS", () => {
    expect(enumLabel("A_PLUS")).toBe("A+");
  });

  it("title-cases underscore-delimited enums", () => {
    expect(enumLabel("MEETING_SCHEDULED")).toBe("Meeting Scheduled");
    expect(enumLabel("WON")).toBe("Won");
  });
});

describe("initials", () => {
  it("takes up to two uppercased initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Grace Brewster Hopper")).toBe("GB");
    expect(initials("Cher")).toBe("C");
  });
});
