import { describe, it, expect } from "vitest";
import {
  computeLeadScore,
  gradeFromScore,
  priorityFromScore,
  employeeScaleScore,
  type ScoringFactors,
} from "@/lib/scoring";

const factors = (v: number): ScoringFactors => ({
  industryFit: v,
  employeeScale: v,
  revenueScale: v,
  technologyGap: v,
  websiteQuality: v,
  digitalPresence: v,
  growthSignals: v,
  departmentComplexity: v,
  processComplexity: v,
  automationNeed: v,
  buyingPotential: v,
});

describe("computeLeadScore", () => {
  it("returns 0 for all-zero factors and 100 for all-max", () => {
    expect(computeLeadScore(factors(0))).toBe(0);
    expect(computeLeadScore(factors(100))).toBe(100);
  });

  it("clamps out-of-range factor values into 0..100", () => {
    expect(computeLeadScore(factors(200))).toBe(100);
    expect(computeLeadScore(factors(-50))).toBe(0);
  });

  it("weights sum to 1 (a uniform 60 scores 60)", () => {
    expect(computeLeadScore(factors(60))).toBe(60);
  });
});

describe("gradeFromScore", () => {
  it("maps score bands to grades", () => {
    expect(gradeFromScore(90)).toBe("A_PLUS");
    expect(gradeFromScore(85)).toBe("A_PLUS");
    expect(gradeFromScore(84)).toBe("A");
    expect(gradeFromScore(70)).toBe("A");
    expect(gradeFromScore(69)).toBe("B");
    expect(gradeFromScore(50)).toBe("B");
    expect(gradeFromScore(49)).toBe("C");
  });
});

describe("priorityFromScore", () => {
  it("maps score bands to priorities", () => {
    expect(priorityFromScore(85)).toBe("URGENT");
    expect(priorityFromScore(70)).toBe("HIGH");
    expect(priorityFromScore(50)).toBe("MEDIUM");
    expect(priorityFromScore(49)).toBe("LOW");
  });
});

describe("employeeScaleScore", () => {
  it("peaks in the 101-250 sweet spot and handles unknowns", () => {
    expect(employeeScaleScore(null)).toBe(40);
    expect(employeeScaleScore(0)).toBe(40);
    expect(employeeScaleScore(5)).toBe(30);
    expect(employeeScaleScore(50)).toBe(90);
    expect(employeeScaleScore(200)).toBe(100);
    expect(employeeScaleScore(400)).toBe(80);
    expect(employeeScaleScore(5000)).toBe(60);
  });
});
