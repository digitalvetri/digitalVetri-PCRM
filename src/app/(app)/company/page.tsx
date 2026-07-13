import { prisma } from "@/lib/prisma";
import { getCommandCenterSnapshot } from "@/lib/command-center";
import { getRecurringSnapshot } from "@/lib/recurring";
import { CompanyModule } from "@/components/command-center/company-module";
import type { VetriProvider } from "@/components/command-center/vetri-hud";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Company" };

export default async function AiCompanyPage() {
  const [snapshot, recurring, companies, prospects, leadCount, noteCount] = await Promise.all([
    getCommandCenterSnapshot(),
    getRecurringSnapshot(),
    prisma.company.count(),
    prisma.prospect.count(),
    prisma.discoveredLead.count(),
    prisma.note.count(),
  ]);

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

  return <CompanyModule vitals={vitals} providers={providers} counts={counts} />;
}
