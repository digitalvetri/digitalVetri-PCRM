import type { ProspectStatus } from "@prisma/client";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

/** Qualified-or-later statuses eligible for CRM sync. */
const SYNC_STATUSES: ProspectStatus[] = [
  "QUALIFIED",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "MEETING_DONE",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
];

/** POST /api/crm/sync — bulk-sync all qualified+ prospects not yet in the DigitalVetri CRM. */
export async function POST() {
  return withApi(async () => {
    const user = await requireUser("prospects.sync");

    const prospects = await prisma.prospect.findMany({
      where: { status: { in: SYNC_STATUSES }, syncedToCrm: false },
      include: {
        company: {
          include: { analysis: true, recommendation: true, decisionMakers: true },
        },
      },
    });

    // Snapshot skipped BEFORE the sync loop marks candidates as synced —
    // otherwise the ones we sync would double-count here.
    const skipped = await prisma.prospect.count({
      where: {
        OR: [{ syncedToCrm: true }, { status: { notIn: SYNC_STATUSES } }],
      },
    });

    const apiUrl = process.env.DV_CRM_API_URL;
    const apiKey = process.env.DV_CRM_API_KEY;
    const crmConfigured = Boolean(apiUrl && apiKey);

    // Never mark prospects as synced when there's no CRM to push to — doing so
    // would permanently exclude them from the candidate query (syncedToCrm:
    // false) once a real CRM is later configured, so they'd never actually push.
    if (!crmConfigured) {
      return {
        synced: 0,
        skipped,
        failed: 0,
        crmConfigured: false,
        message:
          "CRM integration is not configured. Set DV_CRM_API_URL and DV_CRM_API_KEY, then retry — no prospects were marked as synced.",
      };
    }

    let synced = 0;
    let failed = 0;

    for (const prospect of prospects) {
      let crmExternalId: string | null = null;

      if (crmConfigured) {
        try {
          const res = await fetch(`${apiUrl!.replace(/\/$/, "")}/prospects`, {
            method: "POST",
            // Bound each call so a hung CRM can't stall the whole sync (matches
            // the timeout on our other outbound fetches).
            signal: AbortSignal.timeout(15_000),
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
            const json = (await res.json().catch(() => null)) as
              | { id?: string; externalId?: string }
              | null;
            crmExternalId = json?.id ?? json?.externalId ?? null;
          } else {
            failed++;
            continue;
          }
        } catch (err) {
          console.error("[crm sync-all] push failed", prospect.prospectId, err);
          failed++;
          continue;
        }
      }

      if (!crmExternalId) crmExternalId = `DV-CRM-${prospect.prospectId}`;

      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { syncedToCrm: true, crmSyncedAt: new Date(), crmExternalId },
      });

      await logActivity({
        type: "CRM_SYNCED",
        message: `${user.name} synced ${prospect.company.name} (${prospect.prospectId}) to DigitalVetri CRM`,
        userId: user.id,
        companyId: prospect.companyId,
      });

      synced++;
    }

    return {
      synced,
      skipped,
      failed,
      crmConfigured: true,
      message: `Synced ${synced} prospect(s) to DigitalVetri CRM.`,
    };
  });
}
