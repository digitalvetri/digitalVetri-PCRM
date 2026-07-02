import { Building2, BadgeCheck, Crown, Gauge } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { CompaniesTable } from "@/components/companies/companies-table";
import { ImportDialog } from "@/components/companies/import-dialog";
import { AddCompanyDialog } from "@/components/companies/add-company-dialog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const [companies, total, analysed, topGrades, scoreAgg] = await Promise.all([
    prisma.company.findMany({
      include: {
        analysis: true,
        decisionMakers: { where: { isPrimary: true }, take: 1 },
        prospect: true,
      },
      orderBy: [{ analysis: { leadScore: "desc" } }, { createdAt: "desc" }],
    }),
    prisma.company.count(),
    prisma.companyAnalysis.count(),
    prisma.companyAnalysis.count({ where: { leadGrade: { in: ["A_PLUS", "A"] } } }),
    prisma.companyAnalysis.aggregate({ _avg: { leadScore: true } }),
  ]);

  // Distinct filter options derived from the loaded set.
  const industries = Array.from(
    new Set(companies.map((c) => c.industry).filter((v): v is string => Boolean(v)))
  ).sort();
  const cities = Array.from(
    new Set(companies.map((c) => c.city).filter((v): v is string => Boolean(v)))
  ).sort();

  const avgScore = Math.round(scoreAgg._avg.leadScore ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Import, analyse and prioritise companies with AI-driven lead intelligence."
      >
        <ImportDialog />
        <AddCompanyDialog industries={industries} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard index={0} label="Total Companies" value={total} icon={Building2} accent="primary" />
        <StatCard index={1} label="Analysed" value={analysed} icon={BadgeCheck} accent="cyan" />
        <StatCard index={2} label="A+ / A Leads" value={topGrades} icon={Crown} accent="success" />
        <StatCard index={3} label="Avg Lead Score" value={avgScore} icon={Gauge} accent="violet" />
      </div>

      <EstimateNote />

      <CompaniesTable companies={companies} industries={industries} cities={cities} />
    </div>
  );
}
