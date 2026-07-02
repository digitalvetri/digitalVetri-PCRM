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

    // Atomically claim the lead so two concurrent promotions (double-click/retry)
    // can't both proceed and create duplicate companies/prospects.
    const claim = await prisma.discoveredLead.updateMany({
      where: { id, status: { not: "PROMOTED" } },
      data: { status: "PROMOTED" },
    });
    if (claim.count === 0) {
      const fresh = await prisma.discoveredLead.findUnique({ where: { id } });
      return { companyId: fresh?.promotedCompanyId ?? null, alreadyPromoted: true };
    }

    try {
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
      const noteBody = `Discovered lead → recommended: ${lead.recommendedService ?? "—"}. ${lead.summary ?? ""}`.trim();

      // Prospect + note + the lead's promotedCompanyId land together or not at all.
      await prisma.$transaction(async (tx) => {
        await tx.prospect.create({
          data: { prospectId, companyId: company.id, status: "QUALIFIED", assignedToId: user.id },
        });
        if (noteBody) {
          await tx.note.create({ data: { companyId: company.id, authorId: user.id, content: noteBody } });
        }
        await tx.discoveredLead.update({ where: { id }, data: { promotedCompanyId: company.id } });
      });

      await logActivity({
        type: "PROSPECT_CREATED",
        message: `${user.name} promoted lead “${lead.name}” to a prospect (${prospectId})`,
        userId: user.id,
        companyId: company.id,
      });

      return { companyId: company.id, prospectId, ok: true };
    } catch (e) {
      // Roll the claim back so a transient failure leaves the lead retryable.
      await prisma.discoveredLead.updateMany({
        where: { id },
        data: { status: lead.status, promotedCompanyId: null },
      });
      throw e;
    }
  });
}
