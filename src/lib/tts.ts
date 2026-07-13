import { ApiError } from "@/lib/api-error";

/**
 * Server-side text-to-speech. Returns real audio bytes the browser plays through
 * an <audio> element — this works even when the browser's own speechSynthesis
 * engine is silent (as on some desktop setups).
 *
 * Uses Google's public translate voice (free, no API key, supports English AND
 * Tamil). It's the free tier — fine for this app's volume; can be swapped for
 * Google Cloud TTS (paid, higher quality, same call shape) by changing this file.
 */

export function isServerTtsConfigured(): boolean {
  return true; // no key required
}

/** Split text into ~180-char chunks on word boundaries (the voice endpoint caps length). */
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

export async function synthesizeSpeech(
  text: string,
  lang: "en" | "ta" = "en"
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const tl = lang === "ta" ? "ta" : "en";
  const chunks = chunkText(text);
  const parts: Uint8Array[] = [];

  for (const chunk of chunks) {
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
