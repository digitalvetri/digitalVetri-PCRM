import { CRM_MODULES, INDUSTRIES, SERVICES } from "@/lib/constants";

/**
 * Shared system prompt establishing the AI persona and the ethical /
 * accuracy constraints that apply to every generation.
 */
export const ANALYST_SYSTEM = `You are the DigitalVetri Sales Intelligence Analyst, an expert B2B sales research assistant for an Indian technology company. DigitalVetri is a full-stack digital growth partner offering: Custom CRM & ERP development, Website & SaaS/web-app development, Mobile app development, Digital Marketing (SEO, social media, paid ads), AI Automation & chatbots, WhatsApp Business automation, and business software/dashboards.

Core rules:
- Recommend the RIGHT offering(s) from the full portfolio for each company — not only CRM. A business with a weak website and no online presence may need Website Development + Digital Marketing before (or alongside) a CRM.
- Use ONLY publicly available business information. Never fabricate private data (private financials, personal contact details, internal documents).
- Clearly treat employee counts, revenue, scores and budgets as ESTIMATES, never as verified facts.
- Be specific and grounded. When you infer, base it on the industry, company size and provided public context.
- All monetary values are in Indian Rupees (INR). Use realistic Indian SME/mid-market pricing.
- Output must strictly follow the requested JSON shape with no commentary or markdown fences.`;

export const KNOWN_INDUSTRIES = INDUSTRIES.join(", ");
export const KNOWN_MODULES = CRM_MODULES.join(", ");
export const KNOWN_SERVICES = SERVICES.join(", ");

/** Prompt to enrich/normalise raw company info collected from public sources. */
export function companyEnrichmentPrompt(input: {
  name: string;
  website?: string | null;
  publicText?: string | null;
  hints?: Record<string, unknown>;
}): string {
  return `Analyse this company using the public information provided and general knowledge of its industry. Fill in every field with your best estimate; mark anything uncertain as an estimate.

Company name: ${input.name}
Website: ${input.website ?? "unknown"}
Known hints: ${JSON.stringify(input.hints ?? {})}

Public website / listing text (may be truncated):
"""
${(input.publicText ?? "No public text available.").slice(0, 12000)}
"""

Pick industry from this list where possible: ${KNOWN_INDUSTRIES}.`;
}

export const COMPANY_ENRICHMENT_SCHEMA = `{
  "industry": string,
  "subIndustry": string,
  "city": string,
  "state": string,
  "country": string,
  "employeeEstimate": number,
  "revenueEstimate": string (e.g. "₹5-10 Cr"),
  "products": string[],
  "services": string[],
  "technologyStack": string[],
  "manufacturingType": string | null,
  "departments": string[],
  "socialMedia": { "linkedin"?: string, "facebook"?: string, "instagram"?: string, "twitter"?: string, "youtube"?: string },
  "phone": string | null,
  "publicEmail": string | null,
  "address": string | null,
  "gstNumber": string | null,
  "linkedinPresence": boolean,
  "decisionMakers": [{ "name": string, "designation": string, "source": string }],
  "confidenceNote": string
}`;

/** Full AI company analysis (scores, pain points, budget, grade). */
export function companyAnalysisPrompt(company: Record<string, unknown>): string {
  return `Perform a complete sales-intelligence analysis of this company as a prospect for DigitalVetri's full service portfolio: ${KNOWN_SERVICES}.

Company data:
${JSON.stringify(company, null, 2)}

Score each dimension 0-100. Consider industry fit, company size, likely technology gap, digital maturity (website quality, online presence, marketing footprint), growth signals, process complexity and buying potential. Predict concrete pain points tied to their industry and operations. In "suggestedModules", recommend the most relevant DigitalVetri OFFERINGS for this company drawn from the full portfolio above (e.g. Website Development, Digital Marketing, Custom CRM) — and, where a custom CRM/ERP fits, name specific modules from: ${KNOWN_MODULES}. Estimate a realistic budget range and buying probability for the Indian SME/mid-market.`;
}

export const COMPANY_ANALYSIS_SCHEMA = `{
  "businessSummary": string (2-4 sentences),
  "digitalMaturityScore": number,
  "automationScore": number,
  "crmOpportunityScore": number,
  "erpOpportunityScore": number,
  "aiOpportunityScore": number,
  "buyingProbability": number,
  "expectedBudget": string (e.g. "₹8-15 Lakh"),
  "painPoints": [{ "area": string, "prediction": string, "reasoning": string }],
  "suggestedModules": string[],
  "scoringFactors": {
    "industryFit": number, "employeeScale": number, "revenueScale": number,
    "technologyGap": number, "websiteQuality": number, "digitalPresence": number,
    "growthSignals": number, "departmentComplexity": number, "processComplexity": number,
    "automationNeed": number, "buyingPotential": number
  }
}`;

/** Industry-based lead intelligence (challenges + why). */
export function leadIntelligencePrompt(company: Record<string, unknown>): string {
  return `Predict the operational challenges this company most likely faces, based on its industry, size and profile. For EACH category, give a likelihood (0-100), specific details and the reasoning behind the prediction. Be concrete and industry-specific.

Company:
${JSON.stringify(company, null, 2)}`;
}

export const LEAD_INTELLIGENCE_SCHEMA = `{
  "businessChallenges": { "likelihood": number, "details": string, "reasoning": string },
  "manualProcesses": { "likelihood": number, "details": string, "reasoning": string },
  "excelUsage": { "likelihood": number, "details": string, "reasoning": string },
  "approvalBottlenecks": { "likelihood": number, "details": string, "reasoning": string },
  "inventoryProblems": { "likelihood": number, "details": string, "reasoning": string },
  "salesProblems": { "likelihood": number, "details": string, "reasoning": string },
  "productionDelays": { "likelihood": number, "details": string, "reasoning": string },
  "communicationProblems": { "likelihood": number, "details": string, "reasoning": string },
  "reportingProblems": { "likelihood": number, "details": string, "reasoning": string },
  "customerManagementIssues": { "likelihood": number, "details": string, "reasoning": string },
  "overallInsight": string
}`;

/** CRM recommendation with hours, timeline, cost, ROI. */
export function crmRecommendationPrompt(company: Record<string, unknown>, analysis: Record<string, unknown>): string {
  return `Produce a delivery and commercial recommendation for this company across DigitalVetri's relevant offerings: ${KNOWN_SERVICES}. Recommend the mix of services that best fits this company (e.g. Website Development + Digital Marketing for a business with weak online presence; Custom CRM/ERP for operations-heavy firms; AI/WhatsApp automation for lead-heavy sales teams). Use realistic Indian pricing — software services blended rate ≈ ₹1,200-1,800/hour; typical SME website ₹40k-1.5L; monthly digital-marketing retainers ₹15k-60k.

In "recommendedModules", each item's "module" is the recommended OFFERING (a service from the portfolio, or a specific CRM/ERP module from: ${KNOWN_MODULES}).

Company:
${JSON.stringify(company, null, 2)}

Prior analysis:
${JSON.stringify(analysis, null, 2)}

Estimate development/engagement hours, timeline, team size, total cost (INR), expected ROI and realistic annual savings/uplift with a breakdown by area.`;
}

export const CRM_RECOMMENDATION_SCHEMA = `{
  "recommendedModules": [{ "module": string, "reason": string, "priority": "HIGH"|"MEDIUM"|"LOW" }],
  "estimatedHours": number,
  "estimatedTimeline": string (e.g. "14-18 weeks"),
  "estimatedTeamSize": number,
  "estimatedCost": number (INR total),
  "costRange": string (e.g. "₹8,00,000 - ₹12,00,000"),
  "expectedRoi": string (e.g. "3.2x in 18 months"),
  "annualSavings": number (INR),
  "savingsBreakdown": [{ "area": string, "amount": number, "explanation": string }]
}`;
