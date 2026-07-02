import { describe, it, expect } from "vitest";
import { roleCan } from "@/lib/rbac";

describe("roleCan", () => {
  it("grants ADMIN every permission", () => {
    for (const perm of [
      "companies.view",
      "prospects.delete",
      "commandCenter.manage",
      "settings.manage",
      "users.manage",
    ] as const) {
      expect(roleCan("ADMIN", perm)).toBe(true);
    }
  });

  it("excludes read-only VIEWER from every write/manage permission", () => {
    expect(roleCan("VIEWER", "commandCenter.manage")).toBe(false);
    expect(roleCan("VIEWER", "prospects.edit")).toBe(false);
    expect(roleCan("VIEWER", "prospects.delete")).toBe(false);
    expect(roleCan("VIEWER", "prospects.assign")).toBe(false);
    expect(roleCan("VIEWER", "content.generate")).toBe(false);
    expect(roleCan("VIEWER", "settings.manage")).toBe(false);
  });

  it("still lets VIEWER read", () => {
    expect(roleCan("VIEWER", "companies.view")).toBe(true);
    expect(roleCan("VIEWER", "prospects.view")).toBe(true);
    expect(roleCan("VIEWER", "reports.view")).toBe(true);
  });

  it("gives SALES command-center + generation but not manager/admin-only actions", () => {
    expect(roleCan("SALES", "commandCenter.manage")).toBe(true);
    expect(roleCan("SALES", "content.generate")).toBe(true);
    expect(roleCan("SALES", "prospects.edit")).toBe(true);
    expect(roleCan("SALES", "prospects.delete")).toBe(false);
    expect(roleCan("SALES", "prospects.assign")).toBe(false);
    expect(roleCan("SALES", "settings.manage")).toBe(false);
  });

  it("gives MANAGER assignment/deletion but not settings/users", () => {
    expect(roleCan("MANAGER", "prospects.delete")).toBe(true);
    expect(roleCan("MANAGER", "prospects.assign")).toBe(true);
    expect(roleCan("MANAGER", "commandCenter.manage")).toBe(true);
    expect(roleCan("MANAGER", "settings.manage")).toBe(false);
    expect(roleCan("MANAGER", "users.manage")).toBe(false);
  });
});
