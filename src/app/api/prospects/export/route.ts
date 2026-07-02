import type { Prisma } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { buildWorkbook, excelResponse, type ExcelColumn } from "@/lib/excel";
import { enumLabel, formatDate } from "@/lib/utils";
import { gradeParam, optionalIntParam, prospectStatusParam } from "@/lib/query";

/** Same filter logic as the list route, inlined to keep route files self-contained. */
function buildProspectWhere(sp: URLSearchParams): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {};

  const status = prospectStatusParam(sp.get("status"));
  const assignedTo = sp.get("assignedTo");
  if (status) where.status = status;
  if (assignedTo) where.assignedToId = assignedTo;

  const industry = sp.get("industry");
  const grade = gradeParam(sp.get("grade"));
  const search = sp.get("q");
  const minEmp = optionalIntParam(sp.get("minEmployees"));
  const maxEmp = optionalIntParam(sp.get("maxEmployees"));

  const companyWhere: Prisma.CompanyWhereInput = {};
  if (industry) companyWhere.industry = industry;
  if (search) companyWhere.name = { contains: search, mode: "insensitive" };
  if (grade) companyWhere.analysis = { leadGrade: grade };
  if (minEmp !== undefined || maxEmp !== undefined) {
    companyWhere.employeeEstimate = { gte: minEmp, lte: maxEmp };
  }
  if (Object.keys(companyWhere).length > 0) where.company = companyWhere;

  return where;
}

const COLUMNS: ExcelColumn[] = [
  { header: "Prospect ID", key: "prospectId", width: 14 },
  { header: "Company Name", key: "companyName", width: 28 },
  { header: "Industry", key: "industry", width: 20 },
  { header: "Sub Industry", key: "subIndustry", width: 20 },
  { header: "City", key: "city", width: 16 },
  { header: "State", key: "state", width: 16 },
  { header: "Employees", key: "employees", width: 12 },
  { header: "Revenue", key: "revenue", width: 14 },
  { header: "Website", key: "website", width: 26 },
  { header: "LinkedIn", key: "linkedin", width: 26 },
  { header: "Phone", key: "phone", width: 16 },
  { header: "Public Email", key: "publicEmail", width: 24 },
  { header: "Decision Maker", key: "decisionMaker", width: 22 },
  { header: "Designation", key: "designation", width: 20 },
  { header: "CRM Score", key: "crmScore", width: 12 },
  { header: "AI Score", key: "aiScore", width: 12 },
  { header: "Automation Score", key: "automationScore", width: 16 },
  { header: "Digital Score", key: "digitalScore", width: 14 },
  { header: "Lead Score", key: "leadScore", width: 12 },
  { header: "Status", key: "status", width: 18 },
  { header: "Assigned To", key: "assignedTo", width: 20 },
  { header: "Last Contact", key: "lastContact", width: 16 },
  { header: "Next Follow-up", key: "nextFollowUp", width: 16 },
  { header: "Proposal Value", key: "proposalValue", width: 16 },
  { header: "Expected Close Date", key: "expectedCloseDate", width: 18 },
  { header: "Probability", key: "probability", width: 12 },
];

/** GET /api/prospects/export — export the filtered prospect list to XLSX. */
export async function GET(req: Request) {
  return withApi(async () => {
    await requireUser("prospects.export");
    const sp = new URL(req.url).searchParams;
    const where = buildProspectWhere(sp);

    const prospects = await prisma.prospect.findMany({
      where,
      include: {
        company: {
          include: {
            analysis: true,
            decisionMakers: { where: { isPrimary: true }, take: 1 },
          },
        },
        assignedTo: { select: userCardSelect },
      },
      orderBy: [
        { nextFollowUpDate: { sort: "asc", nulls: "last" } },
        { company: { analysis: { leadScore: "desc" } } },
      ],
    });

    const rows = prospects.map((p) => {
      const c = p.company;
      const a = c.analysis;
      const dm = c.decisionMakers[0];
      const social = (c.socialMedia ?? {}) as { linkedin?: string };
      return {
        prospectId: p.prospectId,
        companyName: c.name,
        industry: c.industry ?? "",
        subIndustry: c.subIndustry ?? "",
        city: c.city ?? "",
        state: c.state ?? "",
        employees: c.employeeEstimate ?? "",
        revenue: c.revenueEstimate ?? "",
        website: c.website ?? "",
        linkedin: c.linkedinUrl ?? social.linkedin ?? "",
        phone: c.phone ?? "",
        publicEmail: c.publicEmail ?? "",
        decisionMaker: dm?.name ?? "",
        designation: dm?.designation ?? "",
        crmScore: a?.crmOpportunityScore ?? "",
        aiScore: a?.aiOpportunityScore ?? "",
        automationScore: a?.automationScore ?? "",
        digitalScore: a?.digitalMaturityScore ?? "",
        leadScore: a?.leadScore ?? "",
        status: enumLabel(p.status),
        assignedTo: p.assignedTo?.name ?? "",
        lastContact: p.lastContactDate ? formatDate(p.lastContactDate) : "",
        nextFollowUp: p.nextFollowUpDate ? formatDate(p.nextFollowUpDate) : "",
        proposalValue: p.proposalValue ?? "",
        expectedCloseDate: p.expectedCloseDate ? formatDate(p.expectedCloseDate) : "",
        probability: p.probability != null ? `${p.probability}%` : "",
      };
    });

    const buffer = await buildWorkbook("Prospects", COLUMNS, rows);
    return excelResponse(buffer, "digitalvetri-prospects.xlsx");
  });
}
