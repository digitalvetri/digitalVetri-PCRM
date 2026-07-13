import { z } from "zod";
import { requireUser } from "@/lib/rbac";
import { ApiError } from "@/lib/api-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { synthesizeSpeech } from "@/lib/tts";

const schema = z.object({ text: z.string().min(1).max(1500) });

export const maxDuration = 60;

/** POST /api/tts — synthesise speech and return audio bytes (played by the client). */
export async function POST(req: Request) {
  try {
    const user = await requireUser("content.generate");
    enforceRateLimit(`tts:${user.id}`, 60, 60_000);
    const { text } = schema.parse(await req.json());
    const audio = await synthesizeSpeech(text);
    return new Response(audio, {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    const message = e instanceof ApiError ? e.message : "TTS failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
