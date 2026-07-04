import { describe, it, expect } from "vitest";
import { toMonthly } from "./recurring";

describe("toMonthly — normalizes recurring amounts to MRR", () => {
  it("passes monthly through unchanged", () => {
    expect(toMonthly(5000, "MONTHLY")).toBe(5000);
    expect(toMonthly(5000, null)).toBe(5000); // unset cycle treated as monthly
  });
  it("divides quarterly by 3 and yearly by 12", () => {
    expect(toMonthly(9000, "QUARTERLY")).toBe(3000);
    expect(toMonthly(60000, "YEARLY")).toBe(5000);
  });
  it("is zero for a zero/missing amount", () => {
    expect(toMonthly(0, "MONTHLY")).toBe(0);
  });
});
