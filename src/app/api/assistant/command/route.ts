import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { interpretCommand, matchCompanies } from "@/lib/ai/command";
import { formatINR } from "@/lib/utils";

const schema = z.object({
  message: z.string().min(1).max(500),
  lang: z.enum(["en", "ta"]).optional(),
});

export const maxDuration = 60;

/**
 * POST /api/assistant/command — interpret a spoken/typed command and return a
 * readback for the user to confirm (Save tap). NEVER writes here.
 */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`ai:command:${user.id}`, 30, 60_000);
    const { message, lang = "en" } = schema.parse(await req.json());
    const ta = lang === "ta";
    const c = await interpretCommand(message, lang);

    if (c.intent === "add_company") {
      if (!c.name?.trim()) {
        return { kind: "clarify", say: ta ? "நிறுவனத்தின் பெயர் என்ன?" : "What's the company's name?" };
      }
      const where = c.city ? (ta ? ` (${c.city})` : ` in ${c.city}`) : "";
      return {
        kind: "confirm",
        action: "add_company",
        params: {
          name: c.name.trim(),
          industry: c.industry,
          city: c.city,
          state: c.state,
          phone: c.phone,
          email: c.email,
          website: c.website,
        },
        title: `${c.name.trim()}${where}`,
        say: ta ? `${c.name.trim()}${where} ஐ கிளையண்ட்டாக சேர்க்கவா? சேமிக்க தட்டவும்.` : `Add ${c.name.trim()}${where} as a client? Tap Save to confirm.`,
      };
    }

    if (c.intent === "record_payment") {
      if (!c.amount || c.amount <= 0) {
        return { kind: "clarify", say: ta ? "எவ்வளவு பணம் வந்தது?" : "How much was the payment?" };
      }
      if (!c.company?.trim()) {
        return { kind: "clarify", say: ta ? "எந்த நிறுவனத்திடம் இருந்து?" : "From which client?" };
      }
      const matches = await matchCompanies(c.company);
      if (matches.length === 0) {
        return {
          kind: "clarify",
          say: ta
            ? `"${c.company}" என்ற கிளையண்ட் இல்லை. முதலில் அவர்களை சேர்க்கவா?`
            : `I couldn't find a client called "${c.company}". Add them first?`,
        };
      }
      if (matches.length > 1) {
        const names = matches.map((m) => m.name + (m.city ? ` (${m.city})` : "")).join(", ");
        return { kind: "clarify", say: (ta ? "பல கிளையண்ட்கள் உள்ளன: " : "I found a few: ") + names + (ta ? ". எது?" : ". Which one exactly?") };
      }
      const m = matches[0];
      const amt = formatINR(c.amount);
      return {
        kind: "confirm",
        action: "record_payment",
        params: { companyId: m.id, companyName: m.name, amount: c.amount, note: c.note },
        title: `${amt} — ${m.name}`,
        say: ta ? `${m.name} இடமிருந்து ${amt} பதிவு செய்யவா? சேமிக்க தட்டவும்.` : `Record ${amt} received from ${m.name}? Tap Save to confirm.`,
      };
    }

    return { kind: "chat" };
  });
}
