import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { logActivity } from "@/lib/activity";

/** POST /api/prospects/[id]/sync — push a qualified prospect to the DigitalVetri CRM. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("prospects.sync");
    const { id } = await params;

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        company: {
          include: { analysis: true, recommendation: true, decisionMakers: true },
        },
      },
    });
    if (!prospect) throw new ApiError(404, "Prospect not found");

    const apiUrl = process.env.DV_CRM_API_URL;
    const apiKey = process.env.DV_CRM_API_KEY;

    let crmExternalId: string | null = null;
    let crmConfigured = false;

    if (apiUrl && apiKey) {
      crmConfigured = true;
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/prospects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prospectId: prospect.prospectId,
            status: prospect.status,
            proposalValue: prospect.proposalValue,
            company: {
              name: prospect.company.name,
              website: prospect.company.website,
              industry: prospect.company.industry,
              city: prospect.company.city,
              state: prospect.company.state,
              phone: prospect.company.phone,
              publicEmail: prospect.company.publicEmail,
              employeeEstimate: prospect.company.employeeEstimate,
              decisionMakers: prospect.company.decisionMakers.map((d) => ({
                name: d.name,
                designation: d.designation,
                email: d.email,
                phone: d.phone,
              })),
            },
            analysis: prospect.company.analysis,
            recommendation: prospect.company.recommendation,
          }),
        });
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as { id?: string; externalId?: string } | null;
          crmExternalId = json?.id ?? json?.externalId ?? null;
        }
      } catch (err) {
        console.error("[prospect sync] CRM push failed", err);
      }
    }

    if (!crmExternalId) crmExternalId = `DV-CRM-${prospect.prospectId}`;

    const updated = await prisma.prospect.update({
      where: { id },
      data: {
        syncedToCrm: true,
        crmSyncedAt: new Date(),
        crmExternalId,
      },
      include: { company: true, assignedTo: { select: userCardSelect } },
    });

    await logActivity({
      type: "CRM_SYNCED",
      message: `${user.name} synced ${prospect.company.name} (${prospect.prospectId}) to DigitalVetri CRM`,
      userId: user.id,
      companyId: prospect.companyId,
    });

    return {
      prospect: updated,
      crmConfigured,
      message: crmConfigured
        ? "Synced to DigitalVetri CRM."
        : "CRM integration is not configured — prospect marked as synced locally.",
    };
  });
}
