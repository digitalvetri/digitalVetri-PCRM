import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getCommandCenterSnapshot, targetFunnel } from "@/lib/command-center";
import { formatINR } from "@/lib/utils";
import { isPlacesConfigured, discoverPlaces } from "@/lib/places";
import { assessLead } from "@/lib/ai/lead-discovery";
import { draftOutreachForLead } from "@/lib/ai/outreach";
import { sendWhatsAppViaApi, isWhatsAppApiConfigured } from "@/lib/whatsapp";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export interface Watchlist {
  industry: string;
  city: string;
}

export interface AutomationConfig {
  enabled: boolean;
  watchlists: Watchlist[];
  digestChannel: "none" | "whatsapp" | "email";
  digestTo: string;
  batchSize: number;
  autoDraft: boolean; // draft WhatsApp outreach for the top new leads each run
}

export const DEFAULT_AUTOMATION: AutomationConfig = {
  enabled: false,
  watchlists: [],
  digestChannel: "none",
  digestTo: "",
  batchSize: 5,
  autoDraft: false,
};

export async function getAutomationConfig(): Promise<AutomationConfig> {
  const row = await prisma.appSetting.findUnique({ where: { key: "automation" } });
  if (!row) return DEFAULT_AUTOMATION;
  const v = (row.value ?? {}) as Partial<AutomationConfig>;
  return {
    enabled: Boolean(v.enabled),
    watchlists: Array.isArray(v.watchlists)
      ? v.watchlists
          .filter((w): w is Watchlist => Boolean(w && w.industry && w.city))
          .slice(0, 20)
      : [],
    digestChannel:
      v.digestChannel === "whatsapp" || v.digestChannel === "email" ? v.digestChannel : "none",
    digestTo: typeof v.digestTo === "string" ? v.digestTo : "",
    batchSize: typeof v.batchSize === "number" ? Math.min(12, Math.max(1, v.batchSize)) : 5,
    autoDraft: Boolean(v.autoDraft),
  };
}

export async function setAutomationConfig(cfg: AutomationConfig): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "automation" },
    create: { key: "automation", value: cfg as object },
    update: { value: cfg as object },
  });
}

/** Verify a scheduler request carries the CRON_SECRET (Bearer header or ?secret=). */
export function assertCron(req: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(500, "CRON_SECRET is not configured on the server.");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = new URL(req.url).searchParams.get("secret");
  if (bearer !== secret && query !== secret) throw new ApiError(401, "Unauthorized cron request.");
}

/** Build the morning briefing text from the live pipeline snapshot. */
export async function buildDigest(leadsFoundToday: number): Promise<string> {
  const s = await getCommandCenterSnapshot();
  const funnel = targetFunnel(s.monthlyTarget, s.revenueClosedThisMonth);
  const L: string[] = ["☀️ DigitalVetri — Morning Briefing", ""];

  if (s.monthlyTarget) {
    L.push(
      `💰 Target ${formatINR(s.monthlyTarget, true)} · closed ${formatINR(s.revenueClosedThisMonth, true)} (${s.achievementPct ?? 0}%)`
    );
    if (funnel && funnel.remaining > 0) {
      L.push(`   To hit it: ~${funnel.leads} leads · ${funnel.meetings} meetings · ${funnel.deals} deals to close.`);
    }
  }
  L.push(`📈 Pipeline: ${formatINR(s.pipelineValue, true)}`);
  L.push(`🔎 New leads found overnight: ${leadsFoundToday}`);
  L.push(
    `📅 Meetings today: ${s.meetingsToday} · Follow-ups pending: ${s.followUpsPending}${
      s.missedFollowUps ? ` · ⚠️ ${s.missedFollowUps} missed` : ""
    }`
  );

  if (s.highPriorityLeads.length) {
    L.push("", "🏆 Top priority leads:");
    for (const l of s.highPriorityLeads.slice(0, 5)) L.push(`   • ${l.name} (${l.grade} · ${l.score})`);
  }
  if (s.proposalDeadlines.length) {
    L.push("", "📄 Proposals expiring soon:");
    for (const p of s.proposalDeadlines.slice(0, 3)) L.push(`   • ${p.company} — ${formatINR(p.value, true)}`);
  }

  L.push("", "Open the Command Center to act. — Your AI agent");
  return L.join("\n");
}

export interface DailyAgentResult {
  leadsFound: number;
  sent: boolean;
  notes: string[];
  runId: string;
}

/**
 * The daily autonomous run: bounded, idempotent lead discovery from one rotating
 * watchlist + the morning briefing (always logged in-app, sent if configured).
 * Shared by the cron endpoint (scheduler) and the "Run now" button (UI).
 */
export async function runDailyAgent(): Promise<DailyAgentResult> {
  const cfg = await getAutomationConfig();
  let leadsFound = 0;
  const notes: string[] = [];
  const createdLeads: {
    id: string;
    name: string;
    industry: string | null;
    city: string | null;
    signals: string[];
    recommendedService: string | null;
    phone: string | null;
    email: string | null;
    totalScore: number;
  }[] = [];

  if (cfg.enabled && cfg.watchlists.length > 0) {
    if (!isPlacesConfigured()) {
      notes.push("Discovery skipped — GOOGLE_PLACES_API_KEY not set (no data source).");
    } else {
      const wl = cfg.watchlists[new Date().getDate() % cfg.watchlists.length];
      try {
        const found = await discoverPlaces(`${wl.industry} in ${wl.city}`, cfg.batchSize);
        for (const b of found.slice(0, cfg.batchSize)) {
          const [dupLead, dupCo] = await Promise.all([
            prisma.discoveredLead.findFirst({ where: { name: { equals: b.name, mode: "insensitive" } } }),
            prisma.company.findFirst({ where: { name: { equals: b.name, mode: "insensitive" } } }),
          ]);
          if (dupLead || dupCo) continue;
          try {
            const a = await assessLead({ ...b, industry: wl.industry, city: b.city ?? wl.city });
            const created = await prisma.discoveredLead.create({
              data: {
                name: b.name,
                website: b.website ?? undefined,
                phone: b.phone ?? undefined,
                city: b.city ?? wl.city,
                industry: wl.industry,
                source: "PLACES",
                signals: a.signals,
                recommendedService: a.recommendedService,
                summary: a.summary,
                needScore: a.needScore,
                fitScore: a.fitScore,
                totalScore: a.totalScore,
                status: a.totalScore >= 60 ? "QUALIFIED" : "NEW",
              },
            });
            leadsFound += 1;
            createdLeads.push({
              id: created.id,
              name: created.name,
              industry: created.industry,
              city: created.city,
              signals: a.signals,
              recommendedService: a.recommendedService,
              phone: created.phone,
              email: created.email,
              totalScore: a.totalScore,
            });
          } catch (err) {
            console.error("[agent] assess failed", b.name, err);
          }
        }
        notes.push(`Discovered ${leadsFound} new lead(s) for “${wl.industry} in ${wl.city}”.`);
      } catch (err) {
        console.error("[agent] discovery failed", err);
        notes.push("Discovery failed (Places error).");
      }
    }
  }

  // Opt-in: draft WhatsApp outreach for the top few new leads (bounded to keep
  // AI cost proportional — off by default).
  if (cfg.autoDraft && createdLeads.length > 0) {
    const top = [...createdLeads].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
    let drafted = 0;
    for (const l of top) {
      try {
        const d = await draftOutreachForLead(l, "WHATSAPP");
        await prisma.outreachDraft.create({
          data: { discoveredLeadId: l.id, leadName: l.name, channel: "WHATSAPP", toContact: d.toContact, body: d.body },
        });
        drafted += 1;
      } catch (err) {
        console.error("[agent] auto-draft failed", l.name, err);
      }
    }
    if (drafted) notes.push(`Auto-drafted ${drafted} WhatsApp message(s) for the top new leads.`);
  }

  const digest = await buildDigest(leadsFound);

  let sent = false;
  try {
    if (cfg.digestChannel === "whatsapp" && cfg.digestTo && isWhatsAppApiConfigured()) {
      await sendWhatsAppViaApi(cfg.digestTo, digest);
      sent = true;
    } else if (cfg.digestChannel === "email" && cfg.digestTo && isEmailConfigured()) {
      await sendEmail({ to: cfg.digestTo, subject: "DigitalVetri — Morning Briefing", text: digest });
      sent = true;
    } else if (cfg.digestChannel !== "none") {
      notes.push("Digest channel set but its credentials aren’t configured — logged in-app only.");
    }
  } catch (err) {
    notes.push(`Digest send failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  const runLog = await prisma.agentRun.create({
    data: { type: "daily", status: "SUCCESS", summary: digest, leadsFound, sent, data: { notes } },
  });

  return { leadsFound, sent, notes, runId: runLog.id };
}
