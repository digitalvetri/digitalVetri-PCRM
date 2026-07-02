import { ApiError } from "@/lib/api-error";

/**
 * WhatsApp sending. Two paths:
 *  1) Click-to-chat (wa.me) — no setup; opens WhatsApp with the message
 *     pre-filled and the user sends from their own WhatsApp Business number.
 *  2) Meta WhatsApp Cloud API — true API send, configured via env:
 *       WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN,
 *       WHATSAPP_API_VERSION (default v20.0), WHATSAPP_DEFAULT_COUNTRY (default 91).
 *     NOTE: the Cloud API only allows free-form text within the 24-hour customer
 *     service window; business-initiated (cold) messages require approved templates.
 */

const DEFAULT_COUNTRY = () => process.env.WHATSAPP_DEFAULT_COUNTRY ?? "91";

/** Normalise a phone number to international digits (no +, spaces or symbols). */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Drop a leading national-trunk 0, then add the default country code for
  // plain 10-digit Indian mobiles.
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10) digits = DEFAULT_COUNTRY() + digits;
  return digits;
}

/** Build a wa.me click-to-chat URL. Number optional → opens the composer. */
export function waMeLink(rawNumber: string | null | undefined, text: string): string {
  const num = normalizeWhatsAppNumber(rawNumber);
  const base = num ? `https://wa.me/${num}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function isWhatsAppApiConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

export async function sendWhatsAppViaApi(rawNumber: string, message: string): Promise<{ id: string }> {
  if (!isWhatsAppApiConfigured()) {
    throw new ApiError(
      500,
      "WhatsApp API isn’t configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to .env, or use “Send on WhatsApp”."
    );
  }
  const to = normalizeWhatsAppNumber(rawNumber);
  if (!to) throw new ApiError(400, "Invalid phone number.");

  const version = process.env.WHATSAPP_API_VERSION ?? "v20.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body: message },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(504, "Could not reach the WhatsApp API. Please try again.");
  }

  const data = (await res.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  } | null;

  if (!res.ok) {
    const err = data?.error;
    // 131047 / "re-engagement": outside the 24h window → needs a template.
    if (err?.code === 131047 || /re-?engagement|24 hour|template/i.test(err?.message ?? "")) {
      throw new ApiError(
        422,
        "WhatsApp blocked this message: outside the 24-hour window, only approved message templates can be sent. Use “Send on WhatsApp” for a personal message instead."
      );
    }
    if (res.status === 401 || err?.code === 190) {
      throw new ApiError(401, "WhatsApp rejected the access token. Check WHATSAPP_ACCESS_TOKEN (tokens can expire).");
    }
    throw new ApiError(502, `WhatsApp API error: ${err?.message ?? `HTTP ${res.status}`}`);
  }

  return { id: data?.messages?.[0]?.id ?? "sent" };
}
