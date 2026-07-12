import Link from "next/link";
import { Users, BadgeCheck, Handshake, Trophy, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs, CLIENT_TABS } from "@/components/shared/module-tabs";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { ProspectsTable } from "@/components/prospects/prospects-table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prospects" };

export default async function ProspectsPage() {
  const [prospects, qualified, negotiation, won] = await Promise.all([
    prisma.prospect.findMany({
      include: {
        company: {
          include: {
            analysis: true,
            decisionMakers: { where: { isPrimary: true }, take: 1 },
          },
        },
        assignedTo: true,
      },
      orderBy: [
        { nextFollowUpDate: { sort: "asc", nulls: "last" } },
        { company: { analysis: { leadScore: "desc" } } },
      ],
    }),
    prisma.prospect.count({ where: { status: "QUALIFIED" } }),
    prisma.prospect.count({ where: { status: "NEGOTIATION" } }),
    prisma.prospect.count({ where: { status: "WON" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        description="Qualified companies moving through your sales pipeline."
      >
        <Button asChild variant="outline">
          <Link href="/api/prospects/export">
            <Download className="h-4 w-4" /> Export
          </Link>
        </Button>
      </PageHeader>

      <ModuleTabs items={CLIENT_TABS} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard index={0} label="Total Prospects" value={prospects.length} icon={Users} accent="primary" />
        <StatCard index={1} label="Qualified" value={qualified} icon={BadgeCheck} accent="cyan" />
        <StatCard index={2} label="In Negotiation" value={negotiation} icon={Handshake} accent="warning" />
        <StatCard index={3} label="Won" value={won} icon={Trophy} accent="success" />
      </div>

      <EstimateNote />

      <ProspectsTable prospects={prospects} />
    </div>
  );
}
