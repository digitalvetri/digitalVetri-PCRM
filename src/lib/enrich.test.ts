import { describe, it, expect } from "vitest";
import { extractContacts } from "./enrich";

describe("extractContacts", () => {
  it("pulls an email and an Indian mobile from page text", () => {
    const text = "Contact us at info@acme.co.in or call +91 98765 43210 today.";
    expect(extractContacts(text)).toEqual({ email: "info@acme.co.in", phone: "+919876543210" });
  });

  it("normalizes phone variants to +91XXXXXXXXXX", () => {
    expect(extractContacts("Ph: 09876543210").phone).toBe("+919876543210");
    expect(extractContacts("call 9876543210").phone).toBe("+919876543210");
    expect(extractContacts("+91-98765-43210").phone).toBe("+919876543210");
  });

  it("ignores asset filenames and placeholder emails", () => {
    const text = "logo@2x.png hero.jpg noreply@sentry.io real@business.in";
    expect(extractContacts(text).email).toBe("real@business.in");
  });

  it("returns nulls when nothing usable is present", () => {
    expect(extractContacts("Welcome to our site. No contact here.")).toEqual({
      email: null,
      phone: null,
    });
  });

  it("does not treat a random long number as a mobile (must start 6-9)", () => {
    expect(extractContacts("Order #12345678901 shipped").phone).toBeNull();
  });
});
