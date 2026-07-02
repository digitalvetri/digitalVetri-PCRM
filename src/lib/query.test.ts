import { describe, it, expect } from "vitest";
import { intParam, optionalIntParam, enumParam, pagination, TASK_STATUSES } from "./query";

describe("intParam", () => {
  it("returns the default for missing or non-numeric input", () => {
    expect(intParam(null, 1)).toBe(1);
    expect(intParam("abc", 25)).toBe(25);
    expect(intParam("", 25)).toBe(25);
  });
  it("clamps to [1, max]", () => {
    expect(intParam("0", 25)).toBe(1);
    expect(intParam("-5", 25)).toBe(1);
    expect(intParam("500", 25, 100)).toBe(100);
    expect(intParam("30", 25, 100)).toBe(30);
  });
});

describe("optionalIntParam", () => {
  it("is undefined for blank/invalid, numeric otherwise", () => {
    expect(optionalIntParam(null)).toBeUndefined();
    expect(optionalIntParam("")).toBeUndefined();
    expect(optionalIntParam("abc")).toBeUndefined();
    expect(optionalIntParam("50")).toBe(50);
    expect(optionalIntParam("-3")).toBe(0);
  });
});

describe("enumParam", () => {
  it("passes through valid enum values only", () => {
    expect(enumParam("TODO", TASK_STATUSES)).toBe("TODO");
    expect(enumParam("DONE", TASK_STATUSES)).toBe("DONE");
  });
  it("drops invalid values (would otherwise crash Prisma)", () => {
    expect(enumParam("FOO", TASK_STATUSES)).toBeUndefined();
    expect(enumParam(null, TASK_STATUSES)).toBeUndefined();
    expect(enumParam("todo", TASK_STATUSES)).toBeUndefined(); // case-sensitive
  });
});

describe("pagination", () => {
  it("never yields NaN skip/take from malformed input", () => {
    const p = pagination(new URLSearchParams("page=abc&pageSize=xyz"));
    expect(p).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
  });
  it("computes skip and clamps pageSize to the max", () => {
    const p = pagination(new URLSearchParams("page=3&pageSize=500"));
    expect(p).toEqual({ page: 3, pageSize: 100, skip: 200, take: 100 });
  });
});
