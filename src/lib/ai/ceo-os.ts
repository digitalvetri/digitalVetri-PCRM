/**
 * DigitalVetri OS — the CEO Operating System persona and its generators:
 * daily planner, EOD accountability review, sales coach, cold-call coach,
 * content marketing pack, BNI coach.
 *
 * All generators ground themselves in real CRM data passed by the caller
 * and never fabricate contacts or company facts.
 */
import { z } from "zod";
import { generateJSON } from "@/lib/ai/provider";

// Reused shape: an objection + its consultative response.
const objectionSchema = z.object({
  objection: z.string().catch(""),
  response: z.string().catch(""),
});

export const CEO_OS_SYSTEM = `You are DigitalVetri OS AI — the Chief Executive Operating System for DigitalVetri, an Indian software company (Tamil Nadu, expanding pan-India) selling Custom CRM Development, AI Automation, Website/SaaS/ERP Development, WhatsApp Automation and Mobile Apps to SMBs in Manufacturing, Construction, Healthcare, Education, Logistics, Wholesale Distribution, Real Estate and Professional Services.

You act as CEO coach, sales director, business consultant, marketing strategist, operations manager, BNI mentor, CRM/AI consultant, proposal expert and accountability partner. Your first priority is revenue: every recommendation must increase meetings, qualified leads, proposals, revenue, client satisfaction or growth.

Style: professional, confident, direct, encouraging, data-driven, practical. Never generic — always specific actions with the reason why. Provide scripts where useful. Sell solutions to business problems, never "software". Prioritise: 1) Revenue 2) Client delivery 3) Proposals 4) Meetings 5) Follow-ups 6) Prospecting 7) Marketing.

Hard rules: never fabricate company data or contacts; use only publicly available information; clearly label estimates; recommend human review before outreach; respect anti-spam laws and platform terms; all money in INR.`;

// ---------------------------------------------------------------
// CEO morning briefing — the proactive "chief of staff" analysis the
// AI CEO greets the founder with when they open the app. Grounded in the
// live pipeline snapshot; includes a `spoken` field for clean voice playback.
// ---------------------------------------------------------------

export interface CeoBriefing {
  greeting: string; // short, spoken-friendly opener
  headline: string; // one-line verdict on the business today
  revenue: string; // where revenue stands vs target, plainly
  focus: string; // THE single most important thing today
  risks: string[]; // watch-items (missed follow-ups, expiring proposals, cold prospects)
  actions: { action: string; why: string }[]; // 3 prioritised moves, revenue-first
  spoken: string; // a natural 4-6 sentence narration for text-to-speech
}

const ceoBriefingSchema = z.object({
  greeting: z.string().catch("Good morning."),
  headline: z.string().catch(""),
  revenue: z.string().catch(""),
  focus: z.string().catch(""),
  risks: z.array(z.string()).catch([]),
  actions: z
    .array(z.object({ action: z.string().catch(""), why: z.string().catch("") }))
    .catch([]),
  spoken: z.string().catch(""),
});

export async function generateCeoBriefing(input: {
  context: Record<string, unknown>; // live pipeline snapshot
  funnel?: Record<string, unknown> | null; // target → activity math
  departmentReports?: unknown; // latest shift reports from the department heads
  date: string;
}): Promise<CeoBriefing> {
  return generateJSON(
    `You are the founder's AI CEO giving the morning briefing for ${input.date}. Your department heads (Sales, Marketing, Finance, Operations) have filed their shift reports below. Synthesise them with the live data and brief the founder like a sharp chief of staff — no fluff, revenue-first, specific to THIS data. Where a department flagged something, fold it into your focus/risks/actions.

Live pipeline snapshot (real data — reference actual company names, numbers, counts):
${JSON.stringify(input.context, null, 2)}

Target → activity math (what it takes to hit the monthly target):
${JSON.stringify(input.funnel ?? "no target set", null, 2)}

Your department heads' latest shift reports:
${JSON.stringify(input.departmentReports ?? "no department reports yet", null, 2)}

Produce:
- "greeting": a short, warm spoken opener (e.g. "Good morning — here's where we stand.").
- "headline": one punchy line summarising the state of the business today.
- "revenue": one line on revenue vs target (use the numbers; if no target is set, say so and note pipeline value).
- "focus": the SINGLE most important thing the founder must do today, named specifically (a company, a proposal, a follow-up) — not generic advice.
- "risks": 0-4 concrete watch-items pulled from the data (missed follow-ups, proposals expiring, prospects going cold, empty pipeline). Empty array if genuinely none.
- "actions": exactly 3 prioritised moves for today, revenue-first, each a { "action", "why" }. Reference real names/numbers.
- "spoken": a natural, flowing 4-6 sentence narration of the above for text-to-speech — conversational, no bullet points, no emoji, no markdown. This is what the CEO says out loud.`,
    `{ "greeting": string, "headline": string, "revenue": string, "focus": string, "risks": string[], "actions": [{ "action": string, "why": string }], "spoken": string }`,
    { system: CEO_OS_SYSTEM, temperature: 0.5, maxTokens: 2000 },
    ceoBriefingSchema
  );
}

// ---------------------------------------------------------------
// Daily planner
// ---------------------------------------------------------------

export interface DailyObjectives {
  revenueTarget?: number | null;
  meetings?: number | null;
  coldCalls?: number | null;
  followUps?: number | null;
  proposals?: number | null;
  bniActivity?: string | null;
  clientDeliveries?: string | null;
  blockedTasks?: string | null;
  notes?: string | null;
}

export interface ScheduleBlock {
  time: string; // "06:30"
  activity: string;
  category:
    | "planning"
    | "prospecting"
    | "calls"
    | "meeting"
    | "proposal"
    | "follow-up"
    | "delivery"
    | "bni"
    | "marketing"
    | "review";
  why: string;
}

const scheduleBlockSchema = z.object({
  time: z.string().catch(""),
  activity: z.string().catch(""),
  category: z
    .enum([
      "planning",
      "prospecting",
      "calls",
      "meeting",
      "proposal",
      "follow-up",
      "delivery",
      "bni",
      "marketing",
      "review",
    ])
    .catch("planning"),
  why: z.string().catch(""),
});

const dailyPlanSchema = z.object({
  briefing: z.string().catch(""),
  schedule: z.array(scheduleBlockSchema).catch([]),
});

export async function generateDailyPlan(input: {
  objectives: DailyObjectives;
  context: Record<string, unknown>; // live pipeline snapshot
  date: string;
}): Promise<{ briefing: string; schedule: ScheduleBlock[] }> {
  return generateJSON(
    `Create today's (${input.date}) execution plan for the DigitalVetri founder.

Founder's objectives for today:
${JSON.stringify(input.objectives, null, 2)}

Live pipeline snapshot (real data — use it to pick SPECIFIC prospects/tasks by name):
${JSON.stringify(input.context, null, 2)}

Produce:
1. "briefing": a punchy 3-5 sentence CEO morning briefing — where revenue stands, the single most important thing today, and any risk (missed follow-ups, stale proposals).
2. "schedule": an hourly plan from 06:30 to 19:00 with 30-90 minute blocks. Front-load revenue work (calls, meetings, proposals, follow-ups) before marketing/admin. Reference actual company names from the snapshot where relevant. Each block needs a one-line "why".`,
    `{ "briefing": string, "schedule": [{ "time": "HH:MM", "activity": string, "category": "planning"|"prospecting"|"calls"|"meeting"|"proposal"|"follow-up"|"delivery"|"bni"|"marketing"|"review", "why": string }] }`,
    { system: CEO_OS_SYSTEM, temperature: 0.5, maxTokens: 6000 },
    dailyPlanSchema
  );
}

// ---------------------------------------------------------------
// End-of-day accountability
// ---------------------------------------------------------------

export interface EodAnswers {
  revenueClosed?: number | null;
  meetingsConducted?: number | null;
  proposalsSent?: number | null;
  leadsAdded?: number | null;
  callsCompleted?: number | null;
  followUpsMissed?: number | null;
  biggestLearning?: string | null;
  tomorrowPriority?: string | null;
}

const eodReviewSchema = z.object({
  performanceScore: z.coerce.number().catch(0),
  wins: z.array(z.string()).catch([]),
  gaps: z.array(z.string()).catch([]),
  suggestions: z.array(z.string()).catch([]),
  tomorrowPlan: z.array(z.string()).catch([]),
  summary: z.string().catch(""),
});

export async function generateEodReview(input: {
  answers: EodAnswers;
  objectives: DailyObjectives | null;
  context: Record<string, unknown>;
}): Promise<{
  performanceScore: number;
  wins: string[];
  gaps: string[];
  suggestions: string[];
  tomorrowPlan: string[];
  summary: string;
}> {
  return generateJSON(
    `Run the end-of-day CEO accountability review.

This morning's objectives: ${JSON.stringify(input.objectives ?? "not set")}
Actual results reported: ${JSON.stringify(input.answers)}
Pipeline snapshot: ${JSON.stringify(input.context)}

Score the day 0-100 against the objectives (weight revenue-generating activity heaviest). List concrete wins, gaps, 3-5 specific improvement suggestions, and tomorrow's top 5 priorities in order (revenue first). "summary" is a direct 2-3 sentence coach's verdict — honest but encouraging.`,
    `{ "performanceScore": number, "wins": string[], "gaps": string[], "suggestions": string[], "tomorrowPlan": string[], "summary": string }`,
    { system: CEO_OS_SYSTEM, temperature: 0.4 },
    eodReviewSchema
  );
}

// ---------------------------------------------------------------
// Sales coach (per-lead)
// ---------------------------------------------------------------

export interface SalesCoachPack {
  companySummary: string;
  likelyPainPoints: string[];
  industryInsights: string[];
  suggestedModules: string[];
  buyingProbability: number;
  estimatedBudget: string;
  decisionMakerStrategy: string;
  conversationOpening: string;
  discoveryQuestions: string[];
  objectionHandling: { objection: string; response: string }[];
  closingStrategy: string;
}

const salesCoachSchema = z.object({
  companySummary: z.string().catch(""),
  likelyPainPoints: z.array(z.string()).catch([]),
  industryInsights: z.array(z.string()).catch([]),
  suggestedModules: z.array(z.string()).catch([]),
  buyingProbability: z.coerce.number().catch(0),
  estimatedBudget: z.string().catch(""),
  decisionMakerStrategy: z.string().catch(""),
  conversationOpening: z.string().catch(""),
  discoveryQuestions: z.array(z.string()).catch([]),
  objectionHandling: z.array(objectionSchema).catch([]),
  closingStrategy: z.string().catch(""),
});

export async function generateSalesCoachPack(company: Record<string, unknown>): Promise<SalesCoachPack> {
  return generateJSON(
    `Prepare a complete sales coaching pack for this lead. Ground everything in the data below; where the analysis already provides pain points/modules/budget/probability, build on them rather than inventing new ones. Solve business problems — never pitch "software".

Lead data (company + AI analysis + intelligence):
${JSON.stringify(company, null, 2)}

The conversationOpening must be a natural first line for a call that references their industry/operations, not a generic pitch. Discovery questions: 8-12, specific to their industry. Objections: the 5 most likely for an Indian SMB (price, timing, "we manage with Excel", bad past experience, need to consult partner) with strong consultative responses.`,
    `{ "companySummary": string, "likelyPainPoints": string[], "industryInsights": string[], "suggestedModules": string[], "buyingProbability": number, "estimatedBudget": string, "decisionMakerStrategy": string, "conversationOpening": string, "discoveryQuestions": string[], "objectionHandling": [{ "objection": string, "response": string }], "closingStrategy": string }`,
    { system: CEO_OS_SYSTEM, temperature: 0.5, maxTokens: 6000 },
    salesCoachSchema
  );
}

// ---------------------------------------------------------------
// Cold-call coach
// ---------------------------------------------------------------

export interface ColdCallPack {
  greeting: string;
  introduction: string;
  qualifyingQuestions: string[];
  objections: { objection: string; response: string }[];
  closingStatement: string;
  followUpMessage: string;
  meetingBookingMessage: string;
  ifRejected: string;
}

const coldCallSchema = z.object({
  greeting: z.string().catch(""),
  introduction: z.string().catch(""),
  qualifyingQuestions: z.array(z.string()).catch([]),
  objections: z.array(objectionSchema).catch([]),
  closingStatement: z.string().catch(""),
  followUpMessage: z.string().catch(""),
  meetingBookingMessage: z.string().catch(""),
  ifRejected: z.string().catch(""),
});

export async function generateColdCallPack(input: {
  company?: Record<string, unknown> | null;
  industry?: string | null;
}): Promise<ColdCallPack> {
  return generateJSON(
    `Prepare a cold-call script pack for DigitalVetri${
      input.company ? ` targeting this specific company:\n${JSON.stringify(input.company, null, 2)}` : ` targeting ${input.industry ?? "SMB"} companies in Tamil Nadu`
    }.

Keep it conversational Indian-business English, 30-second intro max, problem-led (not product-led). followUpMessage and meetingBookingMessage are WhatsApp-length texts. ifRejected = an alternative approach to try next (different angle, different channel, or nurture play).`,
    `{ "greeting": string, "introduction": string, "qualifyingQuestions": string[], "objections": [{ "objection": string, "response": string }], "closingStatement": string, "followUpMessage": string, "meetingBookingMessage": string, "ifRejected": string }`,
    { system: CEO_OS_SYSTEM, temperature: 0.6 },
    coldCallSchema
  );
}

// ---------------------------------------------------------------
// Content marketing pack
// ---------------------------------------------------------------

export interface ContentPack {
  linkedinPost: string;
  facebookPost: string;
  caseStudyIdea: string;
  crmTip: string;
  aiAutomationTip: string;
  websiteTip: string;
  seoBlogTopic: string;
  videoScript: string;
}

const contentPackSchema = z.object({
  linkedinPost: z.string().catch(""),
  facebookPost: z.string().catch(""),
  caseStudyIdea: z.string().catch(""),
  crmTip: z.string().catch(""),
  aiAutomationTip: z.string().catch(""),
  websiteTip: z.string().catch(""),
  seoBlogTopic: z.string().catch(""),
  videoScript: z.string().catch(""),
});

export async function generateContentPack(theme?: string | null): Promise<ContentPack> {
  return generateJSON(
    `Generate today's content marketing pack for DigitalVetri${theme ? ` around the theme: "${theme}"` : ""}.

- linkedinPost: 120-180 words, hook first line, insight-driven, ends with a soft CTA, 3-5 hashtags.
- facebookPost: shorter, friendlier, same message adapted.
- caseStudyIdea: one concrete anonymised SMB story worth writing.
- crmTip / aiAutomationTip / websiteTip: one actionable tip each an SMB owner can use today.
- seoBlogTopic: a specific long-tail title targeting Indian SMB buyers.
- videoScript: 60-second reel script with hook / 3 points / CTA structure.`,
    `{ "linkedinPost": string, "facebookPost": string, "caseStudyIdea": string, "crmTip": string, "aiAutomationTip": string, "websiteTip": string, "seoBlogTopic": string, "videoScript": string }`,
    { system: CEO_OS_SYSTEM, temperature: 0.75, maxTokens: 5000 },
    contentPackSchema
  );
}

// ---------------------------------------------------------------
// BNI coach
// ---------------------------------------------------------------

export interface BniPack {
  sixtySecondPresentation: string;
  referralRequest: string;
  featurePresentationIdea: string;
  oneToOneStrategy: string;
  weeklyGoals: string[];
  networkingTips: string[];
}

const bniPackSchema = z.object({
  sixtySecondPresentation: z.string().catch(""),
  referralRequest: z.string().catch(""),
  featurePresentationIdea: z.string().catch(""),
  oneToOneStrategy: z.string().catch(""),
  weeklyGoals: z.array(z.string()).catch([]),
  networkingTips: z.array(z.string()).catch([]),
});

export async function generateBniPack(focus?: string | null): Promise<BniPack> {
  return generateJSON(
    `Prepare this week's BNI pack for the DigitalVetri founder${focus ? `, focused on: "${focus}"` : ""}.

- sixtySecondPresentation: a word-for-word 60-second weekly presentation (memorable hook, one specific client problem solved, one crystal-clear referral ask).
- referralRequest: the specific referral ask ("who do you know who...") naming target industry + role.
- featurePresentationIdea: a 10-minute feature presentation concept with 3 talking points.
- oneToOneStrategy: how to pick and run this week's one-to-ones for maximum referral flow.
- weeklyGoals: 4-6 measurable BNI goals.
- networkingTips: 3 practical tips.`,
    `{ "sixtySecondPresentation": string, "referralRequest": string, "featurePresentationIdea": string, "oneToOneStrategy": string, "weeklyGoals": string[], "networkingTips": string[] }`,
    { system: CEO_OS_SYSTEM, temperature: 0.65 },
    bniPackSchema
  );
}
