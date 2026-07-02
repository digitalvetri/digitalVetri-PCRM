import { PageHeader } from "@/components/shared/page-header";
import {
  LeadIntelViewer,
  type CompanyIntel,
} from "@/components/lead-intel/lead-intel-viewer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface IntelEntry {
  likelihood: number;
  details: string;
  reasoning: string;
}

const CATEGORY_DEFS = [
  { key: "businessChallenges", label: "Business Challenges" },
  { key: "manualProcesses", label: "Manual Processes" },
  { key: "excelUsage", label: "Excel Usage" },
  { key: "approvalBottlenecks", label: "Approval Bottlenecks" },
  { key: "inventoryProblems", label: "Inventory Problems" },
  { key: "salesProblems", label: "Sales Problems" },
  { key: "productionDelays", label: "Production Delays" },
  { key: "communicationProblems", label: "Communication Problems" },
  { key: "reportingProblems", label: "Reporting Problems" },
  { key: "customerManagementIssues", label: "Customer Management Issues" },
] as const;

export default async function LeadIntelligencePage() {
  const [withIntel, withoutIntel] = await Promise.all([
    prisma.company.findMany({
      where: { leadIntelligence: { isNot: null } },
      include: { leadIntelligence: true, analysis: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { leadIntelligence: { is: null } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const companies: CompanyIntel[] = withIntel
    .filter((c) => c.leadIntelligence)
    .map((c) => {
      const li = c.leadIntelligence!;
      return {
        companyId: c.id,
        companyName: c.name,
        overallInsight: li.overallInsight,
        categories: CATEGORY_DEFS.map((def) => {
          const entry = (li[def.key as keyof typeof li] as unknown as IntelEntry | null) ?? {
            likelihood: 0,
            details: "No data.",
            reasoning: "",
          };
          return { key: def.key, label: def.label, entry };
        }),
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Intelligence"
        description="AI-predicted operational challenges by industry."
      />
      <LeadIntelViewer companies={companies} ungeneratedCompanies={withoutIntel} />
    </div>
  );
}
