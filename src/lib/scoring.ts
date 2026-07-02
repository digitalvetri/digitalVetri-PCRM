/**
 * AI Lead Scoring - composite score out of 100.
 *
 * The AI analysis provides per-factor sub-scores; this module combines
 * them with deterministic weights so scoring stays explainable and
 * consistent across providers. All scores are ESTIMATES.
 */

export interface ScoringFactors {
  industryFit: number; // 0-100 how well the industry matches our ICP
  employeeScale: number; // 0-100 company size sweet spot
  revenueScale: number; // 0-100
  technologyGap: number; // 0-100 higher = more legacy/manual = more opportunity
  websiteQuality: number; // 0-100
  digitalPresence: number; // 0-100
  growthSignals: number; // 0-100
  departmentComplexity: number; // 0-100
  processComplexity: number; // 0-100
  automationNeed: number; // 0-100
  buyingPotential: number; // 0-100
}

export const SCORING_WEIGHTS: Record<keyof ScoringFactors, number> = {
  industryFit: 0.12,
  employeeScale: 0.1,
  revenueScale: 0.1,
  technologyGap: 0.1,
  websiteQuality: 0.05,
  digitalPresence: 0.08,
  growthSignals: 0.08,
  departmentComplexity: 0.08,
  processComplexity: 0.09,
  automationNeed: 0.1,
  buyingPotential: 0.1,
};

export function computeLeadScore(factors: ScoringFactors): number {
  let score = 0;
  for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
    const v = factors[key as keyof ScoringFactors];
    score += Math.max(0, Math.min(100, v ?? 0)) * weight;
  }
  return Math.round(score);
}

export function gradeFromScore(score: number): "A_PLUS" | "A" | "B" | "C" {
  if (score >= 85) return "A_PLUS";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  return "C";
}

export function priorityFromScore(score: number): "URGENT" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 85) return "URGENT";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

/** Sweet spot: 26-250 employees scores highest for custom CRM/ERP work. */
export function employeeScaleScore(employees: number | null | undefined): number {
  if (!employees) return 40;
  if (employees < 10) return 30;
  if (employees < 26) return 55;
  if (employees <= 100) return 90;
  if (employees <= 250) return 100;
  if (employees <= 500) return 80;
  return 60;
}
