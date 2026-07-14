/**
 * Pluggable AI provider layer. Every AI feature in the platform calls
 * generateText / generateJSON; the concrete provider (OpenAI, Claude,
 * Gemini) is chosen by the AI_PROVIDER env var or a per-call override.
 *
 * IMPORTANT: all outputs are AI ESTIMATES. Callers must persist them with
 * the appropriate confidence flags and the UI must label them as estimated.
 */

import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export type AiProvider = "openai" | "claude" | "gemini" | "groq";

function normalizeProvider(v?: string | null): AiProvider | null {
  const p = (v ?? "").toLowerCase();
  if (p === "claude" || p === "anthropic") return "claude";
  if (p === "gemini" || p === "google") return "gemini";
  if (p === "groq") return "groq";
  if (p === "openai") return "openai";
  return null;
}

// Cache the DB-selected provider briefly so a multi-call request doesn't re-query.
let providerCache: { value: AiProvider; at: number } | null = null;

/**
 * The active brain: the Settings → AI Provider choice wins (so it can be changed
 * live from the UI), falling back to the AI_PROVIDER env var, then OpenAI.
 */
async function resolveProvider(): Promise<AiProvider> {
  if (providerCache && Date.now() - providerCache.at < 10_000) return providerCache.value;
  let value = activeProvider(); // env-based default
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "aiProvider" } });
    const fromSettings = normalizeProvider(row?.value as string | undefined);
    if (fromSettings) value = fromSettings;
  } catch {
    /* DB unavailable — keep the env-based provider */
  }
  providerCache = { value, at: Date.now() };
  return value;
}

/** Per-call timeout so a hung provider can't block the request indefinitely. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Translate a raw provider SDK failure into an ApiError with a clear, safe,
 * user-facing message (so the UI shows "quota exceeded" rather than a generic
 * "Internal server error"). Returns (doesn't throw) so callers can inspect it
 * before deciding whether to fall back to another provider.
 */
function toApiError(provider: AiProvider, err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const p = provider.charAt(0).toUpperCase() + provider.slice(1);

  if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted")) {
    return new ApiError(429, `${p} AI quota/rate limit reached. Check your ${p} plan & billing, or try again in a minute.`);
  }
  if (
    msg.includes("api key not valid") ||
    msg.includes("api_key_invalid") ||
    msg.includes("401") ||
    msg.includes("unauthenticated") ||
    msg.includes("permission denied") ||
    msg.includes("invalid api key")
  ) {
    return new ApiError(401, `${p} rejected the API key. Verify the key in your environment (.env).`);
  }
  if (msg.includes("not found") || msg.includes("404")) {
    return new ApiError(400, `The configured ${p} model was not found. Check the model name in your environment (.env).`);
  }
  if (msg.includes("timeout") || msg.includes("aborted") || msg.includes("etimedout")) {
    return new ApiError(504, `${p} took too long to respond. Please try again.`);
  }
  console.error(`[ai:${provider}]`, err);
  return new ApiError(502, `The ${p} AI request failed. Please try again.`);
}

/** Minimal validator shape — any Zod schema satisfies this via `.parse`. */
export interface OutputValidator<T> {
  parse: (data: unknown) => T;
}

export interface GenerateOptions {
  system?: string;
  provider?: AiProvider;
  temperature?: number;
  maxTokens?: number;
}

export function activeProvider(): AiProvider {
  const p = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  if (p === "claude" || p === "anthropic") return "claude";
  if (p === "gemini" || p === "google") return "gemini";
  if (p === "groq") return "groq";
  return "openai";
}

function callProvider(provider: AiProvider, prompt: string, opts: GenerateOptions): Promise<string> {
  switch (provider) {
    case "claude":
      return claudeGenerate(prompt, opts);
    case "gemini":
      return geminiGenerate(prompt, opts);
    case "groq":
      return groqGenerate(prompt, opts);
    default:
      return openaiGenerate(prompt, opts);
  }
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const primary = opts.provider ?? (await resolveProvider());
  try {
    return await callProvider(primary, prompt, opts);
  } catch (err) {
    const primaryError = toApiError(primary, err);
    // Resilience: if the primary provider fails (quota/429, outage, bad key)
    // and Groq is configured as a fallback, transparently retry on Groq.
    if (primary !== "groq" && process.env.GROQ_API_KEY) {
      console.warn(`[ai] ${primary} failed (${primaryError.message}) — falling back to Groq.`);
      try {
        return await callProvider("groq", prompt, opts);
      } catch (fallbackErr) {
        throw toApiError("groq", fallbackErr);
      }
    }
    throw primaryError;
  }
}

/**
 * Generate a JSON object matching the described shape. Retries once on
 * parse/validation failure. `schemaHint` is a human-readable description of
 * the JSON shape appended to the prompt.
 *
 * When a Zod `schema` is provided, the parsed output is validated and
 * normalized through it before returning — so hallucinated/missing fields
 * become safe defaults instead of crashing downstream callers. Without a
 * schema the parsed value is returned as `T` unchecked (legacy behavior).
 */
export async function generateJSON<T>(
  prompt: string,
  schemaHint: string,
  opts: GenerateOptions = {},
  schema?: OutputValidator<T>
): Promise<T> {
  const fullPrompt = `${prompt}

Respond with ONLY a valid JSON object (no markdown fences, no commentary) matching this shape:
${schemaHint}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generateText(fullPrompt, {
      ...opts,
      system:
        (opts.system ? opts.system + "\n\n" : "") +
        "You output strictly valid JSON. Never wrap output in markdown code fences.",
    });
    try {
      const parsed = parseJsonLoose<unknown>(raw);
      return schema ? schema.parse(parsed) : (parsed as T);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`AI returned unparseable or invalid JSON: ${String(lastError)}`);
}

/** Tolerate code fences and leading prose around the JSON payload. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[{[]/);
  if (start === -1) throw new Error("No JSON found in response");
  const opener = cleaned[start];
  const closer = opener === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closer);
  if (end === -1) throw new Error("Unterminated JSON in response");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

// ---------------------------------------------------------------
// Provider implementations (lazy imports keep unused SDKs out of
// the serverless bundle path)
// ---------------------------------------------------------------

async function openaiGenerate(prompt: string, opts: GenerateOptions): Promise<string> {
  if (!process.env.OPENAI_API_KEY)
    throw new ApiError(500, "OpenAI is not configured — set OPENAI_API_KEY in .env (or switch AI_PROVIDER).");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

// Groq exposes an OpenAI-compatible API, so we reuse the OpenAI SDK pointed at
// Groq's base URL. Used both as a primary provider (AI_PROVIDER=groq) and as the
// automatic fallback when another provider is rate-limited/unavailable.
async function groqGenerate(prompt: string, opts: GenerateOptions): Promise<string> {
  if (!process.env.GROQ_API_KEY)
    throw new ApiError(500, "Groq is not configured — set GROQ_API_KEY in .env.");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  const res = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

async function claudeGenerate(prompt: string, opts: GenerateOptions): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new ApiError(500, "Claude is not configured — set ANTHROPIC_API_KEY in .env (or switch AI_PROVIDER).");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.4,
    system: opts.system,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

async function geminiGenerate(prompt: string, opts: GenerateOptions): Promise<string> {
  if (!process.env.GEMINI_API_KEY)
    throw new ApiError(500, "Gemini is not configured — set GEMINI_API_KEY in .env (or switch AI_PROVIDER).");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel(
    {
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      systemInstruction: opts.system,
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 4096,
      },
    },
    { timeout: REQUEST_TIMEOUT_MS }
  );
  const res = await model.generateContent(prompt);
  return res.response.text();
}
