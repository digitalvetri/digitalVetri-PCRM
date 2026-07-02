import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createCompanyShell } from "@/lib/import";
import { nextId } from "@/lib/counters";
import { logActivity } from "@/lib/activity";
import type { ImportSource } from "@prisma/client";

/**
 * POST /api/leads/[id]/promote — graduate a discovered lead into the pipeline:
 * creates a Company + a QUALIFIED Prospect (carrying the discovery insight as a
 * note), and marks the lead PROMOTED.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("prospects.edit");
    const { id } = await params;

    const lead = await prisma.discoveredLead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.status === "PROMOTED" && lead.promotedCompanyId) {
      return { companyId: lead.promotedCompanyId, alreadyPromoted: true };
    }

    const importSource: ImportSource = lead.source === "PLACES" ? "GOOGLE_MAPS" : "MANUAL";
    const company = await createCompanyShell(
      {
        name: lead.name,
        website: lead.website,
        phone: lead.phone,
        publicEmail: lead.email,
        city: lead.city,
        state: lead.state,
        industry: lead.industry,
      },
      importSource,
      { discoveredLeadId: lead.id, recommendedService: lead.recommendedService }
    );

    const prospectId = await nextId("prospect", "DV-P");
    await prisma.prospect.create({
      data: { prospectId, companyId: company.id, status: "QUALIFIED", assignedToId: user.id },
    });

    const noteBody = `Discovered lead → recommended: ${lead.recommendedService ?? "—"}. ${lead.summary ?? ""}`.trim();
    if (noteBody) {
      await prisma.note.create({ data: { companyId: company.id, authorId: user.id, content: noteBody } });
    }

    await prisma.discoveredLead.update({
      where: { id },
      data: { status: "PROMOTED", promotedCompanyId: company.id },
    });

    await logActivity({
      type: "PROSPECT_CREATED",
      message: `${user.name} promoted lead “${lead.name}” to a prospect (${prospectId})`,
      userId: user.id,
      companyId: company.id,
    });

    return { companyId: company.id, prospectId, ok: true };
  });
}
