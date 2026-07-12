import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { enforceRateLimit } from "@/lib/rate-limit";
import { askAssistant, answerAsCeo } from "@/lib/ai/assistant";

const schema = z.object({
  question: z.string().min(1).max(500),
  // Voice path: skip intent classification and answer in one call (faster).
  fast: z.boolean().optional(),
  lang: z.enum(["en", "ta"]).optional(),
});

export const maxDuration = 120;

export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("content.generate");
    enforceRateLimit(`ai:assistant:${user.id}`, 40, 60_000);
    const { question, fast, lang } = schema.parse(await req.json());
    if (fast) {
      const answer = await answerAsCeo(question, lang ?? "en");
      return { answer };
    }
    return askAssistant(question, lang ?? "en");
  });
}
