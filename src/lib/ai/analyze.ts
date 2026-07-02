import { z } from "zod";
import type { Company } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateJSON, activeProvider, type AiProvider } from "@/lib/ai/provider";
import {
  ANALYST_SYSTEM,
  companyAnalysisPrompt,
  COMPANY_ANALYSIS_SCHEMA,
  companyEnrichmentPrompt,
  COMPANY_ENRICHMENT_SCHEMA,
  crmRecommendationPrompt,
  CRM_RECOMMENDATION_SCHEMA,
  leadIntelligencePrompt,
  LEAD_INTELLIGENCE_SCHEMA,
} from "@/lib/ai/prompts";
import {
  computeLeadScore,
  gradeFromScore,
  priorityFromScore,
  employeeScaleScore,
  type ScoringFactors,
} from "@/lib/scoring";

// AI output is untrusted: coerce + default every field so a hallucinated or
// partial response normalizes to safe data instead of crashing persistence.
const enrichmentSchema = z.object({
  industry: z.string().catch("Other"),
  subIndustry: z.string().catch(""),
  city: z.string().catch(""),
  state: z.string().catch(""),
  country: z.string().catch("India"),
  employeeEstimate: z.coerce.number().catch(0),
  revenueEstimate: z.string().catch(""),
  products: z.array(z.string()).catch([]),
  services: z.array(z.string()).catch([]),
  technologyStack: z.array(z.string()).catch([]),
  manufacturingType: z.string().nullable().catch(null),
  departments: z.array(z.string()).catch([]),
  socialMedia: z.record(z.string()).catch({}),
  phone: z.string().nullable().catch(null),
  publicEmail: z.string().nullable().catch(null),
  address: z.string().nullable().catch(null),
  gstNumber: z.string().nullable().catch(null),
  linkedinPresence: z.boolean().catch(false),
  decisionMakers: z
    .array(
      z.object({
        name: z.string().catch(""),
        designation: z.string().catch(""),
        source: z.string().catch(""),
      })
    )
    .catch([]),
  confidenceNote: z.string().catch(""),
});

export type EnrichmentResult = z.infer<typeof enrichmentSchema>;

export async function enrichCompany(
  input: { name: string; website?: string | null; publicText?: string | null; hints?: Record<string, unknown> },
  provider?: AiProvider
): Promise<EnrichmentResult> {
  return generateJSON<EnrichmentResult>(
    companyEnrichmentPrompt(input),
    COMPANY_ENRICHMENT_SCHEMA,
    { system: ANALYST_SYSTEM, provider, temperature: 0.3 },
    enrichmentSchema
  );
}

const DEFAULT_FACTORS: ScoringFactors = {
  industryFit: 50,
  employeeScale: 50,
  revenueScale: 50,
  technologyGap: 50,
  websiteQuality: 50,
  digitalPresence: 50,
  growthSignals: 50,
  departmentComplexity: 50,
  processComplexity: 50,
  automationNeed: 50,
  buyingPotential: 50,
};

const scoringFactorsSchema = z
  .object({
    industryFit: z.coerce.number().catch(50),
    employeeScale: z.coerce.number().catch(50),
    revenueScale: z.coerce.number().catch(50),
    technologyGap: z.coerce.number().catch(50),
    websiteQuality: z.coerce.number().catch(50),
    digitalPresence: z.coerce.number().catch(50),
    growthSignals: z.coerce.number().catch(50),
    departmentComplexity: z.coerce.number().catch(50),
    processComplexity: z.coerce.number().catch(50),
    automationNeed: z.coerce.number().catch(50),
    buyingPotential: z.coerce.number().catch(50),
  })
  .catch(DEFAULT_FACTORS); // entirely-missing scoringFactors → safe defaults

const analysisSchema = z.object({
  businessSummary: z.string().catch(""),
  digitalMaturityScore: z.coerce.number().catch(0),
  automationScore: z.coerce.number().catch(0),
  crmOpportunityScore: z.coerce.number().catch(0),
  erpOpportunityScore: z.coerce.number().catch(0),
  aiOpportunityScore: z.coerce.number().catch(0),
  buyingProbability: z.coerce.number().catch(0),
  expectedBudget: z.string().catch(""),
  painPoints: z
    .array(
      z.object({
        area: z.string().catch(""),
        prediction: z.string().catch(""),
        reasoning: z.string().catch(""),
      })
    )
    .catch([]),
  suggestedModules: z.array(z.string()).catch([]),
  scoringFactors: scoringFactorsSchema,
});

type AnalysisResult = z.infer<typeof analysisSchema>;

/**
 * Run the full AI company analysis, compute the composite lead score with
 * deterministic weights, and persist CompanyAnalysis. Returns the score.
 */
export async function analyzeCompany(company: Company, provider?: AiProvider): Promise<number> {
  const used = provider ?? activeProvider();
  const result = await generateJSON<AnalysisResult>(
    companyAnalysisPrompt(companyToContext(company)),
    COMPANY_ANALYSIS_SCHEMA,
    { system: ANALYST_SYSTEM, provider, temperature: 0.35 },
    analysisSchema
  );

  // Blend the AI's employeeScale hint with our deterministic sweet-spot curve
  const factors: ScoringFactors = {
    ...result.scoringFactors,
    employeeScale: Math.round(
      ((result.scoringFactors.employeeScale ?? 50) + employeeScaleScore(company.employeeEstimate)) / 2
    ),
  };
  const leadScore = computeLeadScore(factors);
  const leadGrade = gradeFromScore(leadScore);
  const priority = priorityFromScore(leadScore);

  await prisma.companyAnalysis.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      businessSummary: result.businessSummary,
      digitalMaturityScore: clamp(result.digitalMaturityScore),
      automationScore: clamp(result.automationScore),
      crmOpportunityScore: clamp(result.crmOpportunityScore),
      erpOpportunityScore: clamp(result.erpOpportunityScore),
      aiOpportunityScore: clamp(result.aiOpportunityScore),
      leadScore,
      leadGrade,
      priority,
      painPoints: result.painPoints,
      suggestedModules: result.suggestedModules,
      expectedBudget: result.expectedBudget,
      buyingProbability: clamp(result.buyingProbability),
      scoreBreakdown: factors as unknown as object,
      aiProvider: used,
    },
    update: {
      businessSummary: result.businessSummary,
      digitalMaturityScore: clamp(result.digitalMaturityScore),
      automationScore: clamp(result.automationScore),
      crmOpportunityScore: clamp(result.crmOpportunityScore),
      erpOpportunityScore: clamp(result.erpOpportunityScore),
      aiOpportunityScore: clamp(result.aiOpportunityScore),
      leadScore,
      leadGrade,
      priority,
      painPoints: result.painPoints,
      suggestedModules: result.suggestedModules,
      expectedBudget: result.expectedBudget,
      buyingProbability: clamp(result.buyingProbability),
      scoreBreakdown: factors as unknown as object,
      aiProvider: used,
    },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { analyzedAt: new Date() },
  });

  return leadScore;
}

const leadEntrySchema = z
  .object({
    likelihood: z.coerce.number().catch(0),
    details: z.string().catch(""),
    reasoning: z.string().catch(""),
  })
  .catch({ likelihood: 0, details: "", reasoning: "" });

const leadIntelSchema = z.object({
  businessChallenges: leadEntrySchema,
  manualProcesses: leadEntrySchema,
  excelUsage: leadEntrySchema,
  approvalBottlenecks: leadEntrySchema,
  inventoryProblems: leadEntrySchema,
  salesProblems: leadEntrySchema,
  productionDelays: leadEntrySchema,
  communicationProblems: leadEntrySchema,
  reportingProblems: leadEntrySchema,
  customerManagementIssues: leadEntrySchema,
  overallInsight: z.string().catch(""),
});

type LeadIntelResult = z.infer<typeof leadIntelSchema>;

export async function generateLeadIntelligence(company: Company, provider?: AiProvider): Promise<void> {
  const used = provider ?? activeProvider();
  const r = await generateJSON<LeadIntelResult>(
    leadIntelligencePrompt(companyToContext(company)),
    LEAD_INTELLIGENCE_SCHEMA,
    { system: ANALYST_SYSTEM, provider, temperature: 0.4 },
    leadIntelSchema
  );
  await prisma.leadIntelligence.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      businessChallenges: r.businessChallenges as object,
      manualProcesses: r.manualProcesses as object,
      excelUsage: r.excelUsage as object,
      approvalBottlenecks: r.approvalBottlenecks as object,
      inventoryProblems: r.inventoryProblems as object,
      salesProblems: r.salesProblems as object,
      productionDelays: r.productionDelays as object,
      communicationProblems: r.communicationProblems as object,
      reportingProblems: r.reportingProblems as object,
      customerManagementIssues: r.customerManagementIssues as object,
      overallInsight: r.overallInsight,
      aiProvider: used,
    },
    update: {
      businessChallenges: r.businessChallenges as object,
      manualProcesses: r.manualProcesses as object,
      excelUsage: r.excelUsage as object,
      approvalBottlenecks: r.approvalBottlenecks as object,
      inventoryProblems: r.inventoryProblems as object,
      salesProblems: r.salesProblems as object,
      productionDelays: r.productionDelays as object,
      communicationProblems: r.communicationProblems as object,
      reportingProblems: r.reportingProblems as object,
      customerManagementIssues: r.customerManagementIssues as object,
      overallInsight: r.overallInsight,
      aiProvider: used,
    },
  });
}

const crmRecSchema = z.object({
  recommendedModules: z
    .array(
      z.object({
        module: z.string().catch(""),
        reason: z.string().catch(""),
        priority: z.string().catch("MEDIUM"),
      })
    )
    .catch([]),
  estimatedHours: z.coerce.number().catch(0),
  estimatedTimeline: z.string().catch(""),
  estimatedTeamSize: z.coerce.number().catch(1),
  estimatedCost: z.coerce.number().catch(0),
  costRange: z.string().catch(""),
  expectedRoi: z.string().catch(""),
  annualSavings: z.coerce.number().catch(0),
  savingsBreakdown: z
    .array(
      z.object({
        area: z.string().catch(""),
        amount: z.coerce.number().catch(0),
        explanation: z.string().catch(""),
      })
    )
    .catch([]),
});

type CrmRecResult = z.infer<typeof crmRecSchema>;

export async function generateCrmRecommendation(company: Company, provider?: AiProvider): Promise<void> {
  const used = provider ?? activeProvider();
  const analysis = await prisma.companyAnalysis.findUnique({ where: { companyId: company.id } });
  const r = await generateJSON<CrmRecResult>(
    crmRecommendationPrompt(companyToContext(company), (analysis as unknown as Record<string, unknown>) ?? {}),
    CRM_RECOMMENDATION_SCHEMA,
    { system: ANALYST_SYSTEM, provider, temperature: 0.35 },
    crmRecSchema
  );
  await prisma.crmRecommendation.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      recommendedModules: r.recommendedModules as object,
      estimatedHours: Math.round(r.estimatedHours),
      estimatedTimeline: r.estimatedTimeline,
      estimatedTeamSize: Math.round(r.estimatedTeamSize),
      estimatedCost: r.estimatedCost,
      costRange: r.costRange,
      expectedRoi: r.expectedRoi,
      annualSavings: r.annualSavings,
      savingsBreakdown: r.savingsBreakdown as object,
      aiProvider: used,
    },
    update: {
      recommendedModules: r.recommendedModules as object,
      estimatedHours: Math.round(r.estimatedHours),
      estimatedTimeline: r.estimatedTimeline,
      estimatedTeamSize: Math.round(r.estimatedTeamSize),
      estimatedCost: r.estimatedCost,
      costRange: r.costRange,
      expectedRoi: r.expectedRoi,
      annualSavings: r.annualSavings,
      savingsBreakdown: r.savingsBreakdown as object,
      aiProvider: used,
    },
  });
}

/** Run enrichment persistence onto a company record (used by import flow). */
export async function applyEnrichment(companyId: string, e: EnrichmentResult): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      industry: e.industry,
      subIndustry: e.subIndustry,
      city: e.city,
      state: e.state,
      country: e.country || "India",
      employeeEstimate: e.employeeEstimate,
      employeeConfidence: "ESTIMATED",
      revenueEstimate: e.revenueEstimate,
      revenueConfidence: "ESTIMATED",
      products: e.products ?? [],
      services: e.services ?? [],
      technologyStack: e.technologyStack ?? [],
      manufacturingType: e.manufacturingType,
      departments: e.departments ?? [],
      socialMedia: e.socialMedia ?? {},
      phone: e.phone ?? undefined,
      publicEmail: e.publicEmail ?? undefined,
      address: e.address ?? undefined,
      gstNumber: e.gstNumber ?? undefined,
      linkedinPresence: e.linkedinPresence ?? false,
      analyzedAt: new Date(),
      decisionMakers: e.decisionMakers?.length
        ? {
            deleteMany: {},
            create: e.decisionMakers.slice(0, 8).map((d, i) => ({
              name: d.name,
              designation: d.designation,
              source: d.source,
              isPrimary: i === 0,
            })),
          }
        : undefined,
    },
  });
}

function companyToContext(c: Company): Record<string, unknown> {
  return {
    name: c.name,
    website: c.website,
    industry: c.industry,
    subIndustry: c.subIndustry,
    city: c.city,
    state: c.state,
    country: c.country,
    employeeEstimate: c.employeeEstimate,
    revenueEstimate: c.revenueEstimate,
    products: c.products,
    services: c.services,
    technologyStack: c.technologyStack,
    manufacturingType: c.manufacturingType,
    departments: c.departments,
    googleRating: c.googleRating,
    linkedinPresence: c.linkedinPresence,
  };
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n ?? 0)));
}
