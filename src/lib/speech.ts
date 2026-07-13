/**
 * Thin wrappers over the browser Web Speech API — speech-to-text (dictation)
 * and text-to-speech (the AI CEO talking back). All browser-native: no API key,
 * no cost, no network. Gracefully degrade when unsupported.
 */

// --- Speech recognition (voice input) ---

export interface SpeechResultList {
  readonly length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

export function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// --- Speech synthesis (voice output) ---

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// getVoices() is empty until the browser loads them asynchronously — cache them
// and refresh on `voiceschanged` so voice selection (e.g. Tamil) actually works.
let voiceCache: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  if (isSpeechSynthesisSupported()) voiceCache = window.speechSynthesis.getVoices();
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

/** Does the browser/OS have a voice for this language code (e.g. "ta")? */
export function hasVoiceFor(langShort: string): boolean {
  if (!voiceCache.length) refreshVoices();
  return voiceCache.some((v) => v.lang?.toLowerCase().startsWith(langShort.toLowerCase()));
}

/** Strip markdown/emoji so the spoken output is clean prose, not symbols. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_#`>~]/g, "") // markdown syntax
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → label
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu,
      ""
    ) // emoji / symbols
    .replace(/\s+/g, " ")
    .trim();
}

/** Speak text aloud (cancels anything currently speaking first). */
export function speak(text: string, opts: { lang?: string; rate?: number } = {}): void {
  if (!isSpeechSynthesisSupported()) return;
  const clean = cleanForSpeech(text);
  if (!clean) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const target = (opts.lang ?? "en-IN").toLowerCase();
  u.lang = opts.lang ?? "en-IN";
  u.rate = opts.rate ?? 1;
  // Voice selection: prefer a LOCAL (offline) voice for the language. Remote
  // "Google …" voices often play SILENTLY, and an exact locale like macOS
  // "Rishi" (en-IN) may be listed-but-not-installed (also silent). A local
  // voice (e.g. Samantha for en) reliably produces sound.
  if (!voiceCache.length) refreshVoices();
  const short = target.split("-")[0];
  const pick =
    voiceCache.find((v) => v.lang?.toLowerCase().startsWith(short) && v.localService) ??
    voiceCache.find((v) => v.lang?.toLowerCase().startsWith(short)) ??
    voiceCache.find((v) => v.localService);
  if (pick) u.voice = pick;
  // Chrome can leave synthesis in a paused state after a cancel(); resume() +
  // speak() unsticks it so the utterance actually plays.
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(u);
}

// --- Server TTS (plays real audio, bypassing a broken browser speech engine) ---

let currentAudio: HTMLAudioElement | null = null;

/** True if Vetri is currently speaking via EITHER the audio element or the browser engine. */
export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) return true;
  return isSpeechSynthesisSupported() && window.speechSynthesis.speaking;
}

/**
 * Speak via the server (Groq TTS) → play the returned audio through an <audio>
 * element. Returns true if it played, false if the server TTS was unavailable
 * (so the caller can fall back to the browser engine). English only.
 */
export async function speakViaServer(text: string, lang: "en" | "ta" = "en"): Promise<boolean> {
  const clean = cleanForSpeech(text);
  if (!clean) return true;
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, lang }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!blob.size) return false;
    cancelSpeech();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Best voice available: try the server (reliable audio) first; if it's not set
 * up, fall back to the browser engine. Use this for anything Vetri says.
 */
export async function speakSmart(text: string, lang: "en" | "ta" = "en"): Promise<void> {
  // Server voice supports both English and Tamil; fall back to the browser engine
  // only if the server voice is unavailable.
  const played = await speakViaServer(text, lang);
  if (played) return;
  speak(text, { lang: lang === "ta" ? "ta-IN" : "en-IN" });
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
}

/**
 * "Unlock" speech synthesis. Browsers only allow speak() once it's been invoked
 * from a real user gesture; Vetri's replies come after an async step (voice
 * recognition / the AI call), which no longer counts. Calling this from the tap
 * that starts the interaction (a silent empty utterance) unlocks it so the later
 * reply is allowed to play. Safe to call repeatedly.
 */
export function primeSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {
    /* ignore */
  }
}
