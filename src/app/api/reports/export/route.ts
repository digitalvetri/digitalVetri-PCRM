import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { buildWorkbook, excelResponse, type ExcelColumn } from "@/lib/excel";
import { enumLabel, formatDate } from "@/lib/utils";

const COLUMNS: ExcelColumn[] = [
  { header: "Prospect ID", key: "prospectId", width: 14 },
  { header: "Company", key: "company", width: 30 },
  { header: "Industry", key: "industry", width: 20 },
  { header: "City", key: "city", width: 16 },
  { header: "Status", key: "status", width: 18 },
  { header: "Proposal Value (₹)", key: "value", width: 18 },
  { header: "Probability", key: "probability", width: 12 },
  { header: "Expected Close", key: "expectedClose", width: 16 },
  { header: "Assigned To", key: "assignedTo", width: 22 },
  { header: "Synced to CRM", key: "synced", width: 14 },
];

/** GET /api/reports/export — full prospects pipeline as a branded XLSX. */
export async function GET() {
  return withApi(async () => {
    await requireUser("reports.view");

    const prospects = await prisma.prospect.findMany({
      include: { company: true, assignedTo: true },
      orderBy: [
        { proposalValue: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
    });

    const rows = prospects.map((p) => ({
      prospectId: p.prospectId,
      company: p.company.name,
      industry: p.company.industry ?? "",
      city: p.company.city ?? "",
      status: enumLabel(p.status),
      value: p.proposalValue ?? "",
      probability: p.probability != null ? `${p.probability}%` : "",
      expectedClose: p.expectedCloseDate ? formatDate(p.expectedCloseDate) : "",
      assignedTo: p.assignedTo?.name ?? "Unassigned",
      synced: p.syncedToCrm ? "Yes" : "No",
    }));

    const buffer = await buildWorkbook("Prospects Pipeline", COLUMNS, rows);
    return excelResponse(buffer, "digitalvetri-report.xlsx");
  });
}
