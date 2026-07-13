import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { executeAddCompany, executeRecordPayment } from "@/lib/ai/command";
import { executeCreateTask, executeCreateNote, executeScheduleMeeting, executeCreateFollowup } from "@/lib/ai/actions";
import { formatINR } from "@/lib/utils";

const schema = z.object({
  action: z.enum(["add_company", "record_payment", "create_task", "create_note", "schedule_meeting", "create_followup"]),
  params: z.record(z.unknown()),
  lang: z.enum(["en", "ta"]).optional(),
});

export const maxDuration = 60;

/** POST /api/assistant/execute — actually perform the action (permission-gated). */
export async function POST(req: Request) {
  return withApi(async () => {
    const { action, params, lang } = schema.parse(await req.json());
    const ta = lang === "ta";
    const p = params as Record<string, string | number | null | undefined>;

    if (action === "add_company") {
      const user = await requireUser("companies.create");
      enforceRateLimit(`ai:exec:${user.id}`, 20, 60_000);
      const c = await executeAddCompany({
        name: String(p.name ?? ""),
        industry: p.industry as string | null,
        city: p.city as string | null,
        state: p.state as string | null,
        phone: p.phone as string | null,
        email: p.email as string | null,
        website: p.website as string | null,
      });
      return { say: ta ? `${c.name} கிளையண்ட்டில் சேமிக்கப்பட்டது.` : `Saved ${c.name} to your clients.`, href: "/companies", label: "Open Clients" };
    }

    if (action === "record_payment") {
      const user = await requireUser("prospects.edit");
      enforceRateLimit(`ai:exec:${user.id}`, 20, 60_000);
      const r = await executeRecordPayment({ companyId: String(p.companyId), amount: Number(p.amount), note: p.note as string | null, userId: user.id });
      return { say: ta ? `${r.company} இடமிருந்து ${formatINR(r.amount)} பதிவு செய்யப்பட்டது.` : `Recorded ${formatINR(r.amount)} received from ${r.company}.`, href: "/reports", label: "Open Reports" };
    }

    if (action === "create_task") {
      const user = await requireUser("tasks.manage");
      enforceRateLimit(`ai:exec:${user.id}`, 30, 60_000);
      const t = await executeCreateTask(user.id, { title: String(p.title ?? ""), dueDate: p.dueDate as string | null, priority: p.priority as string | null });
      return { say: ta ? `பணி “${t.title}” உருவாக்கப்பட்டது.` : `Task “${t.title}” created.`, href: "/tasks", label: "Open Tasks" };
    }

    if (action === "create_note") {
      const user = await requireUser("companies.edit");
      enforceRateLimit(`ai:exec:${user.id}`, 30, 60_000);
      const n = await executeCreateNote(user.id, { companyId: String(p.companyId), content: String(p.content ?? "") });
      return { say: ta ? `${n.company} க்கு குறிப்பு சேர்க்கப்பட்டது.` : `Note added to ${n.company}.`, href: "/companies", label: "Open Clients" };
    }

    if (action === "schedule_meeting") {
      const user = await requireUser("meetings.manage");
      enforceRateLimit(`ai:exec:${user.id}`, 30, 60_000);
      const m = await executeScheduleMeeting(user.id, { companyId: String(p.companyId), title: p.title as string | null, scheduledAt: String(p.scheduledAt) });
      return { say: ta ? `${m.company} உடன் கூட்டம் நிர்ணயிக்கப்பட்டது.` : `Meeting with ${m.company} scheduled.`, href: "/meetings", label: "Open Meetings" };
    }

    // create_followup
    const user = await requireUser("prospects.edit");
    enforceRateLimit(`ai:exec:${user.id}`, 30, 60_000);
    const f = await executeCreateFollowup(user.id, { prospectId: String(p.prospectId), dueAt: String(p.dueAt), channel: p.channel as string | null, notes: p.notes as string | null });
    return { say: ta ? `${f.company} க்கு பின்தொடர்தல் வைக்கப்பட்டது.` : `Follow-up set for ${f.company}.`, href: "/follow-ups", label: "Open Follow-ups" };
  });
}
