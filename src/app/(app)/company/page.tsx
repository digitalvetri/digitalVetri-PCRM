import { prisma } from "@/lib/prisma";
import { isPlacesConfigured } from "@/lib/places";
import { getAutomationConfig } from "@/lib/automation";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyModule } from "@/components/command-center/company-module";
import type { DiscoveredLeadItem } from "@/components/command-center/lead-radar";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Company" };

export default async function AiCompanyPage() {
  const [automation, rawLeads, agentRunsRaw, outreachRaw] = await Promise.all([
    getAutomationConfig(),
    prisma.discoveredLead.findMany({
      where: { status: { in: ["NEW", "QUALIFIED"] } },
      orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.outreachDraft.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const leads: DiscoveredLeadItem[] = rawLeads.map((l) => ({
    id: l.id,
    name: l.name,
    website: l.website,
    phone: l.phone,
    email: l.email,
    city: l.city,
    industry: l.industry,
    signals: (l.signals ?? []) as string[],
    recommendedService: l.recommendedService,
    summary: l.summary,
    needScore: l.needScore,
    fitScore: l.fitScore,
    totalScore: l.totalScore,
    status: l.status,
    source: l.source,
    utmCampaign: l.utmCampaign,
  }));

  const outreachDrafts = outreachRaw.map((d) => ({
    id: d.id,
    leadName: d.leadName,
    channel: d.channel as "EMAIL" | "WHATSAPP",
    toContact: d.toContact,
    subject: d.subject,
    body: d.body,
    createdAt: d.createdAt.toISOString(),
  }));

  const agentRuns = agentRunsRaw.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    leadsFound: r.leadsFound,
    sent: r.sent,
    summary: r.summary,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Company"
        description="Your AI CEO and department heads — working the pipeline around the clock and reporting up."
      />
      <CompanyModule
        leads={leads}
        outreachDrafts={outreachDrafts}
        automation={automation}
        agentRuns={agentRuns}
        placesConfigured={isPlacesConfigured()}
      />
    </div>
  );
}
