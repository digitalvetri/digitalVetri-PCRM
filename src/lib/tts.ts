import { ApiError } from "@/lib/api-error";

/**
 * Server-side text-to-speech. Returns real audio bytes the browser plays through
 * an <audio> element (works even when the browser's own speech engine is silent).
 *
 * Provider:
 *  - If GOOGLE_TTS_API_KEY is set → Google Cloud TTS (natural neural voices,
 *    great English + Tamil). Recommended.
 *  - Otherwise → Google's free public translate voice (robotic but no key). So
 *    voice works out of the box and upgrades to human-quality when the key is added.
 */

export function isServerTtsConfigured(): boolean {
  return true; // the free voice always works
}

export async function synthesizeSpeech(
  text: string,
  lang: "en" | "ta" = "en"
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (key) return synthGoogleCloud(text, lang, key);
  return synthTranslateFree(text, lang);
}

// --- Google Cloud TTS (natural neural voices) ---

async function synthGoogleCloud(
  text: string,
  lang: "en" | "ta",
  key: string
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const voice =
    lang === "ta"
      ? { languageCode: "ta-IN", name: "ta-IN-Wavenet-A" }
      : { languageCode: "en-IN", name: "en-IN-Wavenet-D" };
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: text.slice(0, 1800) },
      voice,
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.02, pitch: 0 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(502, `Google TTS ${res.status}: ${detail.slice(0, 160)}`);
  }
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new ApiError(502, "Google TTS returned no audio.");
  const bytes = Buffer.from(json.audioContent, "base64");
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { audio: ab, contentType: "audio/mpeg" };
}

// --- Free fallback: Google's public translate voice (no key) ---

function chunkText(text: string, max = 180, maxChunks = 8): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) chunks.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks.slice(0, maxChunks);
}

async function synthTranslateFree(
  text: string,
  lang: "en" | "ta"
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const tl = lang === "ta" ? "ta" : "en";
  const parts: Uint8Array[] = [];
  for (const chunk of chunkText(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) {
      throw new ApiError(502, `TTS provider returned ${res.status}`);
    }
    parts.push(new Uint8Array(await res.arrayBuffer()));
  }
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return { audio: out.buffer, contentType: "audio/mpeg" };
}
