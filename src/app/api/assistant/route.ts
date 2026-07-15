import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, roleCan } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askAssistant, interpretVoice, VETRI_ROUTES } from "@/lib/ai/assistant";
import { matchCompanies } from "@/lib/ai/command";
import { matchProspects, matchEmployee, matchPendingLeave } from "@/lib/ai/actions";
import { getVetriHrContext } from "@/lib/hr";
import { formatINR } from "@/lib/utils";

const schema = z.object({
  question: z.string().min(1).max(500),
  // Voice path: one unified interpret call (understands commands + answers).
  fast: z.boolean().optional(),
  lang: z.enum(["en", "ta"]).optional(),
  // Recent conversation for a natural, remembered back-and-forth.
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(12)
    .optional(),
});

export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`ai:assistant:${user.id}`, 40, 60_000);
    const { question, fast, lang = "en", history = [] } = schema.parse(await req.json());

    // Give Vetri the team/HR brain — but only for admins/managers (privacy).
    const isHrManager = roleCan(user.role, "hr.manage");
    const hr = isHrManager ? await getVetriHrContext() : undefined;

    if (!fast) return askAssistant(question, lang, hr);

    const ta = lang === "ta";
    const r = await interpretVoice(question, lang, history, hr);

    // ---- HR voice actions (admins/managers only) ----
    if (isHrManager && r.intent === "assign_task" && r.employee?.trim() && r.title?.trim()) {
      const emps = await matchEmployee(r.employee);
      if (emps.length === 1) {
        const due = r.dueDate ? (ta ? ` (${r.dueDate})` : ` (due ${r.dueDate})`) : "";
        return {
          kind: "confirm",
          action: "assign_task",
          params: { employeeId: emps[0].id, employeeName: emps[0].name, title: r.title.trim(), dueDate: r.dueDate, priority: r.priority },
          title: `${r.title.trim()} → ${emps[0].name}`,
          say: ta ? `${emps[0].name}க்கு பணி “${r.title.trim()}”${due} ஒதுக்கவா? சேமிக்க தட்டவும்.` : `Assign “${r.title.trim()}”${due} to ${emps[0].name}? Tap Save.`,
        };
      }
      return { kind: "clarify", say: emps.length ? (ta ? "எந்த ஊழியர்?" : `I found a few — ${emps.map((e) => e.name).join(", ")}. Which one?`) : (ta ? `"${r.employee}" ஊழியர் கிடைக்கவில்லை.` : `I couldn't find an employee called "${r.employee}".`) };
    }

    if (isHrManager && r.intent === "review_leave" && r.employee?.trim()) {
      const approve = (r.decision ?? "").toLowerCase().startsWith("appro") || (r.decision ?? "").toLowerCase().includes("accept");
      const leaves = await matchPendingLeave(r.employee);
      if (leaves.length === 1) {
        const l = leaves[0];
        return {
          kind: "confirm",
          action: "review_leave",
          params: { leaveId: l.id, employeeName: l.employeeName, decision: approve ? "APPROVED" : "REJECTED" },
          title: `${approve ? "Approve" : "Reject"} — ${l.employeeName} (${l.type})`,
          say: ta ? `${l.employeeName} இன் விடுப்பை ${approve ? "அனுமதிக்கவா" : "நிராகரிக்கவா"}? சேமிக்க தட்டவும்.` : `${approve ? "Approve" : "Reject"} ${l.employeeName}'s ${l.type.toLowerCase()} leave? Tap Save.`,
        };
      }
      return { kind: "clarify", say: leaves.length ? (ta ? "எந்த விடுப்பு விண்ணப்பம்?" : "Which leave request exactly?") : (ta ? `${r.employee}க்கு நிலுவையில் விடுப்பு இல்லை.` : `No pending leave found for "${r.employee}".`) };
    }

    if (isHrManager && r.intent === "post_chat" && r.message?.trim()) {
      return {
        kind: "confirm",
        action: "post_chat",
        params: { message: r.message.trim() },
        title: r.message.trim(),
        say: ta ? `இதை டீம் சாட்டில் இடவா? சேமிக்க தட்டவும்.` : `Post this to Team Chat? Tap Save.`,
      };
    }

    if (isHrManager && r.intent === "announce" && (r.title?.trim() || r.message?.trim())) {
      const title = r.title?.trim() || "Announcement";
      const body = r.message?.trim() || r.title?.trim() || "";
      return {
        kind: "confirm",
        action: "announce",
        params: { title, body },
        title,
        say: ta ? `“${title}” அறிவிப்பை வெளியிடவா? சேமிக்க தட்டவும்.` : `Publish the announcement “${title}”? Tap Save.`,
      };
    }

    // Navigate — map to a real route; unknown destination falls back to an answer.
    if (r.intent === "navigate" && r.destination && VETRI_ROUTES[r.destination]) {
      const route = VETRI_ROUTES[r.destination];
      return { kind: "navigate", href: route.href, label: route.label, say: r.reply || (ta ? `${route.label} திறக்கிறேன்.` : `Opening ${route.label}.`) };
    }

    if (r.intent === "add_company" && r.name?.trim()) {
      const where = r.city ? (ta ? ` (${r.city})` : ` in ${r.city}`) : "";
      return {
        kind: "confirm",
        action: "add_company",
        params: { name: r.name.trim(), industry: r.industry, city: r.city, state: r.state, phone: r.phone, email: r.email, website: r.website },
        title: `${r.name.trim()}${where}`,
        say: ta ? `${r.name.trim()}${where} ஐ சேர்க்கவா? சேமிக்க தட்டவும்.` : `Add ${r.name.trim()}${where} as a client? Tap Save to confirm.`,
      };
    }

    if (r.intent === "record_payment" && r.amount && r.amount > 0 && r.company?.trim()) {
      const matches = await matchCompanies(r.company);
      if (matches.length === 1) {
        const m = matches[0];
        const amt = formatINR(r.amount);
        return {
          kind: "confirm",
          action: "record_payment",
          params: { companyId: m.id, companyName: m.name, amount: r.amount, note: r.note },
          title: `${amt} — ${m.name}`,
          say: ta ? `${m.name} இடமிருந்து ${amt} பதிவு செய்யவா? சேமிக்க தட்டவும்.` : `Record ${amt} received from ${m.name}? Tap Save to confirm.`,
        };
      }
      if (matches.length > 1) {
        const names = matches.map((m) => m.name + (m.city ? ` (${m.city})` : "")).join(", ");
        return { kind: "clarify", say: (ta ? "பல கிளையண்ட்கள்: " : "I found a few: ") + names + (ta ? ". எது?" : ". Which one exactly?") };
      }
      return { kind: "clarify", say: ta ? `"${r.company}" கிடைக்கவில்லை. முதலில் சேர்க்கவா?` : `I couldn't find "${r.company}". Add them first?` };
    }

    if (r.intent === "create_task" && r.title?.trim()) {
      const due = r.dueDate ? (ta ? ` (${r.dueDate})` : ` (due ${r.dueDate})` ) : "";
      return {
        kind: "confirm",
        action: "create_task",
        params: { title: r.title.trim(), dueDate: r.dueDate, priority: r.priority },
        title: r.title.trim(),
        say: ta ? `பணி “${r.title.trim()}”${due} உருவாக்கவா?` : `Create task “${r.title.trim()}”${due}? Tap Save.`,
      };
    }

    if (r.intent === "create_note" && r.company?.trim() && r.note?.trim()) {
      const m = await matchCompanies(r.company);
      if (m.length === 1) {
        return {
          kind: "confirm",
          action: "create_note",
          params: { companyId: m[0].id, companyName: m[0].name, content: r.note.trim() },
          title: m[0].name,
          say: ta ? `${m[0].name} க்கு குறிப்பு சேர்க்கவா?` : `Add this note to ${m[0].name}? Tap Save.`,
        };
      }
      return { kind: "clarify", say: m.length ? (ta ? "எந்த கிளையண்ட்?" : "Which client exactly?") : (ta ? `"${r.company}" கிடைக்கவில்லை.` : `I couldn't find "${r.company}".`) };
    }

    if (r.intent === "schedule_meeting" && r.company?.trim() && r.dueDate) {
      const m = await matchCompanies(r.company);
      if (m.length === 1) {
        return {
          kind: "confirm",
          action: "schedule_meeting",
          params: { companyId: m[0].id, companyName: m[0].name, title: r.title, scheduledAt: r.dueDate },
          title: `${m[0].name} · ${r.dueDate}`,
          say: ta ? `${m[0].name} உடன் ${r.dueDate} அன்று கூட்டம் நிர்ணயிக்கவா?` : `Schedule a meeting with ${m[0].name} on ${r.dueDate}? Tap Save.`,
        };
      }
      return { kind: "clarify", say: m.length ? (ta ? "எந்த கிளையண்ட்?" : "Which client exactly?") : (ta ? `"${r.company}" கிடைக்கவில்லை.` : `I couldn't find "${r.company}".`) };
    }

    if (r.intent === "create_followup" && r.company?.trim() && r.dueDate) {
      const p = await matchProspects(r.company);
      if (p.length === 1) {
        return {
          kind: "confirm",
          action: "create_followup",
          params: { prospectId: p[0].id, companyName: p[0].companyName, dueAt: r.dueDate, channel: r.channel, notes: r.note },
          title: `${p[0].companyName} · ${r.dueDate}`,
          say: ta ? `${p[0].companyName} க்கு ${r.dueDate} அன்று பின்தொடர்தல் வைக்கவா?` : `Set a follow-up for ${p[0].companyName} on ${r.dueDate}? Tap Save.`,
        };
      }
      return { kind: "clarify", say: p.length ? (ta ? "எந்த டீல்?" : "Which deal exactly?") : (ta ? `"${r.company}" க்கு செயலில் உள்ள டீல் இல்லை.` : `No active deal found for "${r.company}".`) };
    }

    // Answer (or an under-specified command → just reply).
    return { kind: "answer", answer: r.reply || (ta ? "மன்னிக்கவும், மீண்டும் சொல்லுங்கள்." : "Sorry, could you say that again?") };
  });
}
