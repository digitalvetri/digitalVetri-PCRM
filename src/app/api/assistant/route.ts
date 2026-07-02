import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askAssistant } from "@/lib/ai/assistant";

const schema = z.object({ question: z.string().min(1).max(500) });

export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`ai:assistant:${user.id}`, 30, 60_000);
    const { question } = schema.parse(await req.json());
    return askAssistant(question);
  });
}
