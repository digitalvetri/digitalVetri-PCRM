import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { draftOutreachForLead } from "@/lib/ai/outreach";

export const maxDuration = 120;

const schema = z.object({ channel: z.enum(["EMAIL", "WHATSAPP"]) });

/** POST /api/leads/[id]/draft — AI-draft a first-touch message for a lead, queue it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`outreach:draft:${user.id}`, 20, 60_000);
    const { id } = await params;
    const { channel } = schema.parse(await req.json());

    const lead = await prisma.discoveredLead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");

    const d = await draftOutreachForLead(
      {
        name: lead.name,
        industry: lead.industry,
        city: lead.city,
        signals: (lead.signals ?? []) as string[],
        recommendedService: lead.recommendedService,
        phone: lead.phone,
        email: lead.email,
      },
      channel
    );

    const draft = await prisma.outreachDraft.create({
      data: {
        discoveredLeadId: lead.id,
        leadName: lead.name,
        channel,
        toContact: d.toContact,
        subject: d.subject ?? undefined,
        body: d.body,
        createdById: user.id,
      },
    });

    return { draft };
  });
}
