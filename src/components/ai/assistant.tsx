"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: { type: "navigate"; href: string; label: string };
}

const SUGGESTIONS = [
  "Which companies have the highest CRM potential?",
  "Show manufacturing companies with more than 40 employees",
  "Which prospects need follow-up today?",
  "Give me a pipeline summary",
];

export function AiAssistant() {
  const router = useRouter();
  // The assistant drives paid AI calls; gated to content.generate roles on the
  // server. Read-only VIEWERs don't get the launcher at all.
  const canUse = useRole() !== "VIEWER";
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your DigitalVetri Sales Intelligence assistant. Ask me about your companies, prospects, follow-ups or pipeline — or ask me to generate a proposal or discovery questions.",
    },
  ]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const panelInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Move focus into the panel on open and close it on Escape.
  React.useEffect(() => {
    if (!open) return;
    panelInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!canUse) return null;

  async function send(question: string) {
    if (!question.trim() || loading) return;
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
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer ?? data.error ?? "Sorry, something went wrong.",
          action: data.action,
        },
      ]);
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
        aria-label="AI Assistant"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Sparkles className="h-6 w-6" />
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
            aria-label="AI Assistant"
            className="fixed bottom-24 right-6 z-40 flex h-[560px] max-h-[calc(100vh-8rem)] w-[calc(100vw-3rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
              <Sparkles className="h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">AI Assistant</div>
                <div className="text-[11px] text-blue-100">DigitalVetri Sales Intelligence</div>
              </div>
            </div>

            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="flex-1 space-y-3 overflow-y-auto p-4"
            >
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

              {messages.length === 1 && (
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
              <input
                ref={panelInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                aria-label="Ask the assistant a question"
                className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
