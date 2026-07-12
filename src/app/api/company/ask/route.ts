import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askDepartment, DEPARTMENTS, DEPT_KEYS, type DeptKey } from "@/lib/ai/departments";
import { askAssistant } from "@/lib/ai/assistant";

const schema = z.object({
  department: z.enum(["ceo", ...DEPT_KEYS] as [string, ...string[]]).default("ceo"),
  question: z.string().min(1).max(500),
});

export const maxDuration = 120;

/** POST /api/company/ask — chat with a department head (or the CEO). */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`company:ask:${user.id}`, 30, 60_000);
    const { department, question } = schema.parse(await req.json());
    if (department === "ceo") {
      const res = await askAssistant(question);
      return { department, answer: res.answer, action: res.action };
    }
    const key = department as DeptKey;
    const answer = await askDepartment(key, question);
    return { department: key, title: DEPARTMENTS[key].title, answer };
  });
}
