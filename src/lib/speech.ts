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
  u.lang = opts.lang ?? "en-IN";
  u.rate = opts.rate ?? 1;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
