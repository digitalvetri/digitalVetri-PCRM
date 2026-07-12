import { prisma } from "@/lib/prisma";
import { isPlacesConfigured } from "@/lib/places";
import { getAutomationConfig } from "@/lib/automation";
import { getCommandCenterSnapshot } from "@/lib/command-center";
import { getRecurringSnapshot } from "@/lib/recurring";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyModule } from "@/components/command-center/company-module";
import type { DiscoveredLeadItem } from "@/components/command-center/lead-radar";
import type { VetriProvider } from "@/components/command-center/vetri-hud";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Company" };

export default async function AiCompanyPage() {
  const [automation, snapshot, recurring, rawLeads, agentRunsRaw, outreachRaw, companies, prospects, leadCount, noteCount] =
    await Promise.all([
      getAutomationConfig(),
      getCommandCenterSnapshot(),
      getRecurringSnapshot(),
      prisma.discoveredLead.findMany({
        where: { status: { in: ["NEW", "QUALIFIED"] } },
        orderBy: [{ totalScore: "desc" }, { createdAt: "desc" }],
        take: 40,
      }),
      prisma.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.outreachDraft.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.company.count(),
      prisma.prospect.count(),
      prisma.discoveredLead.count(),
      prisma.note.count(),
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

  // Which AI providers are wired up (key present on the server).
  const providers: VetriProvider[] = [
    { name: "Groq", connected: Boolean(process.env.GROQ_API_KEY) },
    { name: "Gemini", connected: Boolean(process.env.GEMINI_API_KEY) },
    { name: "OpenAI", connected: Boolean(process.env.OPENAI_API_KEY) },
    { name: "Claude", connected: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) },
  ];

  const vitals = {
    monthlyTarget: snapshot.monthlyTarget,
    revenueClosed: snapshot.revenueClosedThisMonth,
    achievementPct: snapshot.achievementPct,
    pipelineValue: snapshot.pipelineValue,
    mrr: recurring.mrr,
    meetingsToday: snapshot.meetingsToday,
    followUpsPending: snapshot.followUpsPending,
    missedFollowUps: snapshot.missedFollowUps,
    openTasks: snapshot.openTasks,
  };

  const counts = { companies, prospects, leads: leadCount, notes: noteCount };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Company"
        description="Vetri — your AI CEO and department heads, working the pipeline around the clock."
      />
      <CompanyModule
        leads={leads}
        outreachDrafts={outreachDrafts}
        automation={automation}
        agentRuns={agentRuns}
        placesConfigured={isPlacesConfigured()}
        vitals={vitals}
        providers={providers}
        counts={counts}
      />
    </div>
  );
}
