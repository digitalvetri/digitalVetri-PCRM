/**
 * Seed script — populates realistic demo data so the platform is explorable
 * without running live AI calls. All scores/revenue/employee figures here are
 * illustrative ESTIMATES, consistent with how the app labels them.
 *
 * Run: npm run db:seed
 */
import { PrismaClient, type LeadGrade, type Priority } from "@prisma/client";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

function grade(score: number): LeadGrade {
  if (score >= 85) return "A_PLUS";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  return "C";
}
function priority(score: number): Priority {
  if (score >= 85) return "URGENT";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

const COMPANIES = [
  {
    name: "Sri Vari Precision Engineering",
    industry: "Manufacturing",
    subIndustry: "CNC Machining & Precision Parts",
    city: "Coimbatore",
    state: "Tamil Nadu",
    employees: 145,
    revenue: "₹25-50 Cr",
    website: "https://srivariprecision.example.com",
    manufacturingType: "Discrete - Precision Components",
    leadScore: 91,
    crm: 88,
    automation: 82,
    erp: 90,
    ai: 74,
    digital: 42,
    products: ["Precision machined parts", "Automotive components", "Aerospace fittings"],
    departments: ["Production", "Quality", "Stores", "Dispatch", "Sales", "Accounts", "HR"],
    tech: ["Tally ERP", "Excel", "WhatsApp"],
  },
  {
    name: "Anand Textiles Mills",
    industry: "Textiles & Apparel",
    subIndustry: "Spinning & Weaving",
    city: "Tiruppur",
    state: "Tamil Nadu",
    employees: 320,
    revenue: "₹50-100 Cr",
    website: "https://anandtextiles.example.com",
    manufacturingType: "Process - Textile",
    leadScore: 86,
    crm: 80,
    automation: 88,
    erp: 84,
    ai: 70,
    digital: 38,
    products: ["Cotton yarn", "Knitted fabric", "Garments"],
    departments: ["Production", "Quality", "Inventory", "Export", "HR", "Payroll", "Accounts"],
    tech: ["Legacy ERP", "Excel", "Email"],
  },
  {
    name: "MediCare Diagnostics",
    industry: "Healthcare",
    subIndustry: "Diagnostic Labs",
    city: "Chennai",
    state: "Tamil Nadu",
    employees: 78,
    revenue: "₹10-25 Cr",
    website: "https://medicarediagnostics.example.com",
    manufacturingType: null,
    leadScore: 73,
    crm: 76,
    automation: 68,
    erp: 55,
    ai: 72,
    digital: 58,
    products: ["Pathology tests", "Radiology", "Health packages"],
    departments: ["Reception", "Lab", "Reports", "Billing", "Home Collection"],
    tech: ["LIMS", "Excel", "WhatsApp", "Website"],
  },
  {
    name: "BuildStrong Constructions",
    industry: "Construction",
    subIndustry: "Commercial & Residential",
    city: "Madurai",
    state: "Tamil Nadu",
    employees: 210,
    revenue: "₹50-100 Cr",
    website: "https://buildstrong.example.com",
    manufacturingType: null,
    leadScore: 68,
    crm: 64,
    automation: 72,
    erp: 78,
    ai: 55,
    digital: 34,
    products: ["Residential projects", "Commercial complexes", "Infrastructure"],
    departments: ["Projects", "Procurement", "Stores", "Accounts", "HR", "Sales"],
    tech: ["Excel", "Tally", "WhatsApp"],
  },
  {
    name: "SwiftLine Logistics",
    industry: "Logistics",
    subIndustry: "Freight & Warehousing",
    city: "Bengaluru",
    state: "Karnataka",
    employees: 165,
    revenue: "₹25-50 Cr",
    website: "https://swiftlinelogistics.example.com",
    manufacturingType: null,
    leadScore: 79,
    crm: 82,
    automation: 85,
    erp: 70,
    ai: 66,
    digital: 48,
    products: ["Freight forwarding", "Warehousing", "Last-mile delivery"],
    departments: ["Operations", "Fleet", "Warehouse", "Billing", "Customer Service"],
    tech: ["Excel", "Custom app", "WhatsApp", "GPS tracking"],
  },
  {
    name: "Green Valley Foods",
    industry: "Food & Beverage",
    subIndustry: "Packaged Foods",
    city: "Salem",
    state: "Tamil Nadu",
    employees: 96,
    revenue: "₹10-25 Cr",
    website: "https://greenvalleyfoods.example.com",
    manufacturingType: "Process - Food Processing",
    leadScore: 64,
    crm: 60,
    automation: 70,
    erp: 66,
    ai: 52,
    digital: 44,
    products: ["Snacks", "Spices", "Ready-to-cook"],
    departments: ["Production", "Quality", "Packaging", "Sales", "Distribution", "Accounts"],
    tech: ["Tally", "Excel"],
  },
  {
    name: "EduSmart Academy Group",
    industry: "Education",
    subIndustry: "K-12 & Coaching",
    city: "Kochi",
    state: "Kerala",
    employees: 54,
    revenue: "₹5-10 Cr",
    website: "https://edusmart.example.com",
    manufacturingType: null,
    leadScore: 58,
    crm: 66,
    automation: 60,
    erp: 40,
    ai: 62,
    digital: 55,
    products: ["School management", "Coaching classes", "Online courses"],
    departments: ["Admissions", "Academics", "Accounts", "Administration"],
    tech: ["Excel", "WhatsApp", "Website", "Google Workspace"],
  },
  {
    name: "Precision Pumps & Valves",
    industry: "Manufacturing",
    subIndustry: "Industrial Pumps",
    city: "Coimbatore",
    state: "Tamil Nadu",
    employees: 188,
    revenue: "₹25-50 Cr",
    website: "https://precisionpumps.example.com",
    manufacturingType: "Discrete - Assembly",
    leadScore: 88,
    crm: 90,
    automation: 80,
    erp: 86,
    ai: 68,
    digital: 40,
    products: ["Centrifugal pumps", "Industrial valves", "Spare parts"],
    departments: ["Production", "Quality", "Service", "AMC", "Sales", "Dispatch", "Stores", "Accounts"],
    tech: ["Tally ERP", "Excel", "WhatsApp"],
  },
];

const PAIN_POINTS: Record<string, { area: string; prediction: string; reasoning: string }[]> = {
  Manufacturing: [
    { area: "Production Tracking", prediction: "Manual, Excel-based job tracking causing delays and poor visibility", reasoning: "Discrete manufacturers of this size typically outgrow spreadsheets but haven't moved to shop-floor systems." },
    { area: "Inventory", prediction: "Frequent stockouts and excess inventory of raw material", reasoning: "Multiple departments and no real-time inventory usually means reconciliation happens monthly, not live." },
    { area: "Quality", prediction: "Paper-based quality checks with no traceability", reasoning: "A dedicated Quality department without a QMS points to manual inspection records." },
  ],
  default: [
    { area: "Reporting", prediction: "Management reports compiled manually in Excel, often outdated", reasoning: "Several departments feeding data separately makes consolidated reporting slow and error-prone." },
    { area: "Communication", prediction: "Approvals and updates scattered across WhatsApp and email", reasoning: "No workflow system means approvals rely on informal channels." },
  ],
};

async function main() {
  console.log("🌱 Seeding DigitalVetri demo data…");

  // Demo users (Clerk IDs are placeholders; the first real Clerk sign-in
  // becomes ADMIN via getCurrentUser()).
  const admin = await prisma.user.upsert({
    where: { email: "info@digitalvetri.com" },
    update: {},
    create: { clerkId: "seed_admin", email: "info@digitalvetri.com", name: "DigitalVetri Admin", role: "ADMIN" },
  });
  const manager = await prisma.user.upsert({
    where: { email: "manager@digitalvetri.com" },
    update: {},
    create: { clerkId: "seed_manager", email: "manager@digitalvetri.com", name: "Ravi Kumar", role: "MANAGER" },
  });
  const sales = await prisma.user.upsert({
    where: { email: "sales@digitalvetri.com" },
    update: {},
    create: { clerkId: "seed_sales", email: "sales@digitalvetri.com", name: "Priya Nair", role: "SALES" },
  });

  await prisma.counter.upsert({ where: { name: "prospect" }, update: {}, create: { name: "prospect", value: 0 } });
  await prisma.counter.upsert({ where: { name: "proposal" }, update: {}, create: { name: "proposal", value: 0 } });

  let prospectSeq = 0;

  for (const [i, c] of COMPANIES.entries()) {
    const company = await prisma.company.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: {
        name: c.name,
        slug: slugify(c.name),
        domain: c.website.replace(/^https?:\/\//, "").replace(/^www\./, ""),
        website: c.website,
        industry: c.industry,
        subIndustry: c.subIndustry,
        city: c.city,
        state: c.state,
        country: "India",
        employeeEstimate: c.employees,
        employeeConfidence: "ESTIMATED",
        revenueEstimate: c.revenue,
        revenueConfidence: "ESTIMATED",
        products: c.products,
        services: [],
        technologyStack: c.tech,
        manufacturingType: c.manufacturingType,
        departments: c.departments,
        googleRating: 3.8 + (i % 5) * 0.2,
        googleReviews: 40 + i * 17,
        linkedinPresence: true,
        linkedinUrl: `https://www.linkedin.com/company/${slugify(c.name)}`,
        phone: `+91 9${(400000000 + i * 1234567).toString().slice(0, 9)}`,
        publicEmail: `contact@${slugify(c.name)}.example.com`,
        address: `${c.city}, ${c.state}, India`,
        importSource: i % 2 === 0 ? "GOOGLE_MAPS" : "WEBSITE",
        analyzedAt: new Date(),
        socialMedia: { linkedin: `https://www.linkedin.com/company/${slugify(c.name)}` },
        decisionMakers: {
          create: [
            { name: ["Suresh", "Anand", "Mohan", "Karthik"][i % 4] + " " + ["Kumar", "Raj", "Nair", "Menon"][i % 4], designation: "Managing Director", isPrimary: true, source: "Company website / public LinkedIn" },
            { name: ["Deepa", "Latha", "Vidya"][i % 3] + " " + ["S", "R", "K"][i % 3], designation: "Operations Head", isPrimary: false, source: "Public LinkedIn" },
          ],
        },
      },
    });

    await prisma.companyAnalysis.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        businessSummary: `${c.name} is a ${c.subIndustry} company in ${c.city} with an estimated ${c.employees} employees. Strong operational footprint with clear digitisation gaps across ${c.departments.slice(0, 3).join(", ")}, making it a strong candidate for a custom CRM/ERP and automation.`,
        digitalMaturityScore: c.digital,
        automationScore: c.automation,
        crmOpportunityScore: c.crm,
        erpOpportunityScore: c.erp,
        aiOpportunityScore: c.ai,
        leadScore: c.leadScore,
        leadGrade: grade(c.leadScore),
        priority: priority(c.leadScore),
        painPoints: PAIN_POINTS[c.industry] ?? PAIN_POINTS.default,
        suggestedModules: ["Sales CRM", "Quotation", "Inventory", "Reports", "Analytics", "Management Dashboard", "WhatsApp Automation", "Approval Workflow"],
        expectedBudget: c.leadScore >= 85 ? "₹12-20 Lakh" : c.leadScore >= 70 ? "₹8-15 Lakh" : "₹5-9 Lakh",
        buyingProbability: Math.max(30, c.leadScore - 10),
        aiProvider: "seed",
      },
    });

    await prisma.leadIntelligence.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        businessChallenges: { likelihood: 82, details: "Scaling operations faster than systems can support.", reasoning: `${c.employees} staff across ${c.departments.length} departments strains manual coordination.` },
        manualProcesses: { likelihood: 88, details: "Core processes run on paper and Excel.", reasoning: "Tech stack is limited to Tally/Excel/WhatsApp." },
        excelUsage: { likelihood: 90, details: "Heavy reliance on disconnected spreadsheets.", reasoning: "Common for this industry and size band in India." },
        approvalBottlenecks: { likelihood: 70, details: "Approvals via calls/WhatsApp, no audit trail.", reasoning: "No workflow system detected." },
        inventoryProblems: { likelihood: c.industry === "Manufacturing" ? 85 : 55, details: "Stock reconciliation lags actual usage.", reasoning: "Manual stores management." },
        salesProblems: { likelihood: 76, details: "Leads and follow-ups tracked ad-hoc.", reasoning: "No CRM in the stack." },
        productionDelays: { likelihood: c.manufacturingType ? 80 : 40, details: "Job status visibility is poor.", reasoning: "Shop-floor tracking is manual." },
        communicationProblems: { likelihood: 72, details: "Information silos between departments.", reasoning: "Reliance on informal channels." },
        reportingProblems: { likelihood: 84, details: "MIS compiled manually, often stale.", reasoning: "Multiple data sources, no consolidation." },
        customerManagementIssues: { likelihood: 68, details: "Customer history scattered across staff.", reasoning: "No central customer database." },
        overallInsight: `${c.name} shows strong indicators for a phased CRM+automation rollout, starting with sales, inventory and reporting.`,
        aiProvider: "seed",
      },
    });

    await prisma.crmRecommendation.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        recommendedModules: [
          { module: "Sales CRM", reason: "Centralise leads & follow-ups", priority: "HIGH" },
          { module: "Inventory", reason: "Real-time stock control", priority: "HIGH" },
          { module: "Quotation", reason: "Faster, accurate quotes", priority: "MEDIUM" },
          { module: "Reports", reason: "Live MIS dashboards", priority: "HIGH" },
          { module: "WhatsApp Automation", reason: "Automate customer comms", priority: "MEDIUM" },
        ],
        estimatedHours: 900 + i * 120,
        estimatedTimeline: c.leadScore >= 85 ? "16-20 weeks" : "12-16 weeks",
        estimatedTeamSize: 4 + (i % 3),
        estimatedCost: 800000 + i * 250000,
        costRange: `₹${(8 + i * 2).toFixed(0)},00,000 - ₹${(12 + i * 2).toFixed(0)},00,000`,
        expectedRoi: "3.2x in 18 months",
        annualSavings: 1200000 + i * 180000,
        savingsBreakdown: [
          { area: "Reduced manual effort", amount: 600000 + i * 60000, explanation: "Automating reporting and data entry." },
          { area: "Inventory optimisation", amount: 400000 + i * 50000, explanation: "Lower carrying costs & fewer stockouts." },
          { area: "Faster sales cycle", amount: 200000 + i * 40000, explanation: "Quicker quotes and follow-ups." },
        ],
        aiProvider: "seed",
      },
    });

    // Turn the top 5 into prospects at various pipeline stages
    if (i < 5) {
      prospectSeq++;
      const statuses = ["QUALIFIED", "CONTACTED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION"] as const;
      const status = statuses[i];
      const value = 800000 + i * 300000;
      const seedProspectId = `DV-P-${String(prospectSeq).padStart(4, "0")}`;
      await prisma.prospect.upsert({
        where: { prospectId: seedProspectId },
        update: {},
        create: {
          prospectId: seedProspectId,
          companyId: company.id,
          status,
          assignedToId: [sales.id, manager.id, sales.id, manager.id, sales.id][i],
          lastContactDate: new Date(Date.now() - (i + 1) * 3 * 86400000),
          nextFollowUpDate: new Date(Date.now() + (i % 3) * 86400000),
          proposalValue: value,
          expectedCloseDate: new Date(Date.now() + (30 + i * 15) * 86400000),
          probability: [40, 55, 65, 75, 85][i],
        },
      });
    }

    await prisma.activity.create({
      data: {
        type: "COMPANY_ANALYZED",
        companyId: company.id,
        userId: admin.id,
        message: `AI analysis completed for ${c.name} (lead score ${c.leadScore})`,
      },
    });
  }
  await prisma.counter.update({ where: { name: "prospect" }, data: { value: prospectSeq } });

  // A couple of tasks & follow-ups
  const firstProspect = await prisma.prospect.findFirst({ include: { company: true } });
  if (firstProspect) {
    await prisma.followUp.create({
      data: { prospectId: firstProspect.id, userId: sales.id, dueAt: new Date(), channel: "CALL", notes: "Discuss inventory module scope." },
    });
    await prisma.task.create({
      data: { title: `Prepare demo for ${firstProspect.company.name}`, createdById: manager.id, assignedToId: sales.id, priority: "HIGH", status: "IN_PROGRESS", dueDate: new Date(Date.now() + 2 * 86400000), prospectId: firstProspect.id },
    });
  }

  console.log(`✅ Seeded ${COMPANIES.length} companies, ${prospectSeq} prospects, 3 users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
