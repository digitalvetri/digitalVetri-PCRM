import { ApiError } from "@/lib/api-error";

/**
 * Server-side text-to-speech via Groq (PlayAI TTS). Returns real audio bytes the
 * browser plays through an <audio> element — this works even when the browser's
 * own speechSynthesis engine is silent (common on some desktop setups).
 *
 * NOTE: PlayAI TTS is English-only. Tamil falls back to the browser engine.
 * The Groq PlayAI models require a one-time terms acceptance in the Groq console
 * (console.groq.com) — until then the API returns an error and the client falls
 * back to browser speech.
 */

export function isServerTtsConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ApiError(503, "Server TTS is not configured.");
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "playai-tts",
      voice: "Fritz-PlayAI",
      input: text.slice(0, 1200),
      response_format: "wav",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(502, `TTS provider error ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
