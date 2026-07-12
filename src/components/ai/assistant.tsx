"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, X, Send, Loader2, ArrowRight, Mic, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRole } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import {
  getSpeechCtor,
  isSpeechSynthesisSupported,
  speak,
  cancelSpeech,
  type SpeechRecognitionLike,
} from "@/lib/speech";

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: { type: "navigate"; href: string; label: string };
  speak?: string; // clean narration for text-to-speech (falls back to content)
}

interface CeoBriefing {
  greeting: string;
  headline: string;
  revenue: string;
  focus: string;
  risks: string[];
  actions: { action: string; why: string }[];
  spoken: string;
}

const SUGGESTIONS = [
  "What should I focus on today?",
  "How is my revenue tracking against target?",
  "Which deals are at risk?",
  "Who should I follow up with first?",
];

const VOICE_KEY = "dv-ceo-voice";

/** Render a briefing object into a readable chat message. */
function formatBriefing(b: CeoBriefing): string {
  const L: string[] = [];
  if (b.greeting) L.push(b.greeting);
  if (b.headline) L.push("", b.headline);
  if (b.revenue) L.push("", `💰 ${b.revenue}`);
  if (b.focus) L.push("", `🎯 Today's #1: ${b.focus}`);
  if (b.risks.length) {
    L.push("", "⚠️ Watch:");
    for (const r of b.risks) L.push(`• ${r}`);
  }
  if (b.actions.length) {
    L.push("", "Top moves:");
    b.actions.forEach((a, i) => L.push(`${i + 1}. ${a.action}${a.why ? ` — ${a.why}` : ""}`));
  }
  return L.join("\n");
}

export function AiAssistant() {
  const router = useRouter();
  // The assistant drives paid AI calls; gated to content.generate roles on the
  // server. Read-only VIEWERs don't get the launcher at all.
  const canUse = useRole() !== "VIEWER";
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [briefingState, setBriefingState] = React.useState<"idle" | "loading" | "done" | "error">("idle");

  // Voice: output (CEO talks back) is a user toggle persisted in localStorage;
  // input (dictation) needs the Web Speech recognition API.
  const [voiceOn, setVoiceOn] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [voiceInSupported, setVoiceInSupported] = React.useState(false);
  const [voiceOutSupported, setVoiceOutSupported] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = React.useRef("");

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const panelInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  React.useEffect(() => {
    setVoiceInSupported(getSpeechCtor() !== null);
    setVoiceOutSupported(isSpeechSynthesisSupported());
    try {
      setVoiceOn(localStorage.getItem(VOICE_KEY) === "1");
    } catch {
      /* localStorage blocked — default off */
    }
  }, []);

  const hasUserMessage = messages.some((m) => m.role === "user");

  const loadBriefing = React.useCallback(async () => {
    setBriefingState("loading");
    try {
      const res = await fetch("/api/command-center/briefing");
      const data = await res.json();
      if (!res.ok || !data.briefing) throw new Error(data.error ?? "no briefing");
      const b = data.briefing as CeoBriefing;
      const msg: Message = { role: "assistant", content: formatBriefing(b), speak: b.spoken };
      setMessages([msg]);
      setBriefingState("done");
      if (voiceOn && b.spoken) speak(b.spoken);
    } catch {
      setMessages([
        {
          role: "assistant",
          content:
            "Good morning — I'm your AI CEO. I couldn't pull today's briefing just now, but ask me anything about revenue, your pipeline, deals at risk or who to follow up with.",
        },
      ]);
      setBriefingState("error");
    }
  }, [voiceOn]);

  // Load the morning briefing the first time the panel opens.
  React.useEffect(() => {
    if (open && briefingState === "idle") loadBriefing();
  }, [open, briefingState, loadBriefing]);

  // Move focus into the panel on open; close on Escape; stop any speech on close.
  React.useEffect(() => {
    if (!open) {
      cancelSpeech();
      recognitionRef.current?.stop();
      return;
    }
    panelInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!canUse) return null;

  function toggleVoiceOut() {
    setVoiceOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(VOICE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!next) cancelSpeech();
      return next;
    });
  }

  function toggleListening() {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = true;
    baseTextRef.current = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalText) baseTextRef.current += finalText;
      setInput(baseTextRef.current + interim);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        toast.error("Microphone access was blocked. Allow it in your browser to talk to your CEO.");
      } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
        toast.error(`Voice input error: ${ev.error}`);
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start() throws if already started — ignore */
    }
  }

  async function send(question: string) {
    if (!question.trim() || loading) return;
    recognitionRef.current?.stop();
    cancelSpeech();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const content = data.answer ?? data.error ?? "Sorry, something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content, action: data.action }]);
      if (voiceOn) speak(content);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
        aria-label="AI CEO"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Crown className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label="AI CEO"
            className="fixed bottom-24 right-6 z-40 flex h-[560px] max-h-[calc(100vh-8rem)] w-[calc(100vw-3rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
              <Crown className="h-5 w-5" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Your AI CEO</div>
                <div className="text-[11px] text-blue-100">DigitalVetri — Chief of Staff</div>
              </div>
              {briefingState !== "loading" && (
                <button
                  onClick={loadBriefing}
                  title="Refresh briefing"
                  aria-label="Refresh briefing"
                  className="rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
              {voiceOutSupported && (
                <button
                  onClick={toggleVoiceOut}
                  title={voiceOn ? "Voice on — tap to mute" : "Voice off — tap to hear your CEO"}
                  aria-label={voiceOn ? "Mute voice" : "Enable voice"}
                  aria-pressed={voiceOn}
                  className="rounded-md p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              )}
            </div>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="flex-1 space-y-3 overflow-y-auto p-4"
            >
              {briefingState === "loading" && messages.length === 0 && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your business…
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground"
                    )}
                  >
                    {m.content}
                    {m.action && (
                      <button
                        onClick={() => {
                          router.push(m.action!.href);
                          setOpen(false);
                        }}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {m.action.label} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                  </div>
                </div>
              )}

              {briefingState !== "loading" && !hasUserMessage && (
                <div className="space-y-1.5 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t p-3"
            >
              {voiceInSupported && (
                <Button
                  type="button"
                  size="icon"
                  variant={listening ? "default" : "outline"}
                  onClick={toggleListening}
                  aria-label={listening ? "Stop listening" : "Talk to your CEO"}
                  aria-pressed={listening}
                  className={cn(listening && "animate-pulse")}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}
              <input
                ref={panelInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? "Listening…" : "Ask your CEO anything…"}
                aria-label="Ask your AI CEO a question"
                className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
