"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; role: string; imageUrl: string | null };
}

const ROLE_TONE: Record<string, string> = {
  ADMIN: "bg-primary/10 text-primary",
  MANAGER: "bg-blue-500/10 text-blue-600",
  EMPLOYEE: "bg-emerald-500/10 text-emerald-600",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/** Company-wide team chat. Polls every 5s for near-real-time updates. */
export function TeamChat({ className, height = "h-[65vh]" }: { className?: string; height?: string }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [meId, setMeId] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const atBottomRef = React.useRef(true);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setMeId(json.meId);
      setMessages((prev) => {
        if (prev.length === json.messages.length && prev[prev.length - 1]?.id === json.messages[json.messages.length - 1]?.id) return prev;
        return json.messages;
      });
    } catch {
      /* transient network — next poll retries */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // Auto-scroll to newest, but only if the user is already near the bottom.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const json = await res.json();
      if (res.ok && json.message) {
        atBottomRef.current = true;
        setMessages((prev) => [...prev, json.message]);
      } else {
        setText(body);
      }
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("flex flex-col rounded-xl border bg-card", height, className)}>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading chat…</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p>No messages yet.</p>
            <p className="text-xs">Say hello to your team 👋</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.user.id === meId;
            const showHeader = i === 0 || messages[i - 1].user.id !== m.user.id;
            return (
              <div key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", showHeader ? ROLE_TONE[m.user.role] ?? "bg-muted text-muted-foreground" : "opacity-0")}>
                  {showHeader ? initials(m.user.name) : ""}
                </div>
                <div className={cn("min-w-0 max-w-[75%]", mine && "items-end text-right")}>
                  {showHeader && (
                    <div className={cn("mb-0.5 flex items-center gap-2 text-xs", mine && "flex-row-reverse")}>
                      <span className="font-medium">{mine ? "You" : m.user.name}</span>
                      <span className="text-muted-foreground">{fmtTime(m.createdAt)}</span>
                    </div>
                  )}
                  <div className={cn("inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your team…"
          maxLength={2000}
          className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-primary"
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
