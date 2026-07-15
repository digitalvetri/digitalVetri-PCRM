import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { answerEmployeeQuestion } from "@/lib/ai/employee-assistant";

const schema = z.object({
  question: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).optional(),
});

/** POST /api/me/assistant — ask Vetri about your own workspace (privacy-scoped). */
export async function POST(req: Request) {
  return withApi(async () => {
    const me = await requireUser();
    const b = schema.parse(await req.json());
    const answer = await answerEmployeeQuestion(me.id, me.name, b.question, b.history);
    return { answer };
  });
}
