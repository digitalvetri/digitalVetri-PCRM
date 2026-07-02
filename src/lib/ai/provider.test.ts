import { describe, it, expect } from "vitest";
import { parseJsonLoose } from "@/lib/ai/provider";

describe("parseJsonLoose", () => {
  it("parses plain JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose("```\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("ignores leading prose and trailing commentary around the payload", () => {
    expect(parseJsonLoose('Here is your result: {"a":1} — hope that helps!')).toEqual({ a: 1 });
  });

  it("handles arrays", () => {
    expect(parseJsonLoose("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("throws when there is no JSON payload", () => {
    expect(() => parseJsonLoose("no json here")).toThrow();
  });

  it("throws on malformed JSON rather than returning garbage", () => {
    expect(() => parseJsonLoose('{"a": }')).toThrow();
  });
});
