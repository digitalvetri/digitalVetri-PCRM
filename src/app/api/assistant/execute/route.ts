import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { executeAddCompany, executeRecordPayment } from "@/lib/ai/command";
import { formatINR } from "@/lib/utils";

const addCompany = z.object({
  action: z.literal("add_company"),
  params: z.object({
    name: z.string().min(1),
    industry: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
  }),
  lang: z.enum(["en", "ta"]).optional(),
});

const recordPayment = z.object({
  action: z.literal("record_payment"),
  params: z.object({
    companyId: z.string().min(1),
    companyName: z.string().optional(),
    amount: z.number().positive(),
    note: z.string().nullable().optional(),
  }),
  lang: z.enum(["en", "ta"]).optional(),
});

const schema = z.discriminatedUnion("action", [addCompany, recordPayment]);

export const maxDuration = 60;

/** POST /api/assistant/execute — actually write the record (permission-gated). */
export async function POST(req: Request) {
  return withApi(async () => {
    const body = schema.parse(await req.json());
    const ta = body.lang === "ta";

    if (body.action === "add_company") {
      const user = await requireUser("companies.create");
      enforceRateLimit(`ai:exec:${user.id}`, 20, 60_000);
      const c = await executeAddCompany(body.params);
      return {
        say: ta ? `${c.name} கிளையண்ட்டில் சேமிக்கப்பட்டது.` : `Saved ${c.name} to your clients.`,
        href: `/companies`,
        label: "Open Clients",
      };
    }

    // record_payment
    const user = await requireUser("prospects.edit");
    enforceRateLimit(`ai:exec:${user.id}`, 20, 60_000);
    const r = await executeRecordPayment({
      companyId: body.params.companyId,
      amount: body.params.amount,
      note: body.params.note,
      userId: user.id,
    });
    return {
      say: ta ? `${r.company} இடமிருந்து ${formatINR(r.amount)} பதிவு செய்யப்பட்டது.` : `Recorded ${formatINR(r.amount)} received from ${r.company}.`,
      href: `/reports`,
      label: "Open Reports",
    };
  });
}
