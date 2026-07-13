import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askAssistant, interpretVoice, VETRI_ROUTES } from "@/lib/ai/assistant";
import { matchCompanies } from "@/lib/ai/command";
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

    if (!fast) return askAssistant(question, lang);

    const ta = lang === "ta";
    const r = await interpretVoice(question, lang, history);

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

    // Answer (or an under-specified command → just reply).
    return { kind: "answer", answer: r.reply || (ta ? "மன்னிக்கவும், மீண்டும் சொல்லுங்கள்." : "Sorry, could you say that again?") };
  });
}
