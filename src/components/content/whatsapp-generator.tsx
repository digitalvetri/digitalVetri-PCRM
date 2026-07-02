"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Copy, RefreshCw, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { enumLabel, relativeTime } from "@/lib/utils";

const WHATSAPP_CATEGORIES = [
  { value: "FIRST_CONTACT", label: "First Contact" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "MEETING_REMINDER", label: "Meeting Reminder" },
  { value: "PROPOSAL_REMINDER", label: "Proposal Reminder" },
  { value: "FESTIVAL_GREETING", label: "Festival Greeting" },
  { value: "REVIEW_REQUEST", label: "Review Request" },
  { value: "REFERRAL_REQUEST", label: "Referral Request" },
] as const;

const LANGUAGES = ["English", "Hindi", "Tamil"] as const;

const NO_COMPANY = "__none__";

interface CompanyOption {
  id: string;
  name: string;
  phone?: string | null;
}

/** International digits for wa.me (strip symbols, default India +91 for 10-digit). */
function normalizeNumber(raw: string): string {
  let d = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;
  return d;
}

interface RecentItem {
  id: string;
  category: string;
  body: string;
  companyName: string | null;
  createdAt: string;
}

interface WhatsAppResult {
  id: string;
  body: string;
}

function ChatBubble({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-[#dcf8c6] p-4 dark:bg-[#005c4b]">
      <div className="ml-auto max-w-full rounded-lg rounded-tr-none bg-[#25d366]/90 px-3 py-2 text-sm text-white shadow-sm dark:bg-[#25d366]/80">
        <pre className="whitespace-pre-wrap break-words font-sans">{text}</pre>
        <span className="mt-1 block text-right text-[10px] text-white/80">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
        </span>
      </div>
    </div>
  );
}

export function WhatsAppGenerator({
  companies,
  recent,
  initialCompanyId = null,
}: {
  companies: CompanyOption[];
  recent: RecentItem[];
  initialCompanyId?: string | null;
}) {
  const router = useRouter();
  const companyFieldId = React.useId();
  const categoryId = React.useId();
  const toneId = React.useId();
  const languageId = React.useId();
  const phoneId = React.useId();
  const [companyId, setCompanyId] = React.useState<string>(initialCompanyId ?? NO_COMPANY);
  const [category, setCategory] = React.useState<string>("FIRST_CONTACT");
  const [tone, setTone] = React.useState("professional but friendly");
  const [language, setLanguage] = React.useState<string>("English");
  const [phone, setPhone] = React.useState(
    () => companies.find((c) => c.id === initialCompanyId)?.phone ?? ""
  );
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [apiConfigured, setApiConfigured] = React.useState(false);
  const [result, setResult] = React.useState<WhatsAppResult | null>(null);

  // Is the Meta Cloud API path available? If not, only click-to-chat is shown.
  React.useEffect(() => {
    fetch("/api/content/whatsapp/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setApiConfigured(Boolean(d?.configured)))
      .catch(() => {});
  }, []);

  function onCompanyChange(id: string) {
    setCompanyId(id);
    const p = companies.find((c) => c.id === id)?.phone;
    if (p) setPhone(p);
  }

  // Click-to-chat: opens WhatsApp (Web/app) with the number + message pre-filled;
  // the user sends from their own WhatsApp Business number.
  function sendOnWhatsApp() {
    if (!result) return;
    const num = normalizeNumber(phone);
    const base = num ? `https://wa.me/${num}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(result.body)}`, "_blank", "noopener");
  }

  async function sendViaApi() {
    if (!result) return;
    const num = phone.trim();
    if (!num) {
      toast.error("Enter the recipient's WhatsApp number.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/content/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: num,
          message: result.body,
          companyId: companyId === NO_COMPANY ? undefined : companyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send message");
      toast.success("WhatsApp message sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function generate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: companyId === NO_COMPANY ? undefined : companyId,
          category,
          tone: tone.trim() || undefined,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate message");
      setResult({ id: data.id, body: data.body });
      toast.success("Message generated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={companyFieldId}>Company (optional)</Label>
              <Select value={companyId} onValueChange={onCompanyChange}>
                <SelectTrigger id={companyFieldId}>
                  <SelectValue placeholder="No company (generic)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>No company (generic)</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={phoneId}>WhatsApp number</Label>
              <Input
                id={phoneId}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9600759304 or +91 96007 59304"
              />
              <p className="text-[11px] text-muted-foreground">
                Auto-filled from the company&apos;s phone. India (+91) assumed for 10-digit numbers.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={categoryId}>Message Type</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id={categoryId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={toneId}>Tone</Label>
                <Input
                  id={toneId}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="professional but friendly"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={languageId}>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id={languageId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="button" onClick={generate} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate Message
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Preview</CardTitle>
            {result && (
              <Button type="button" size="sm" variant="outline" onClick={generate} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Regenerate
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                Your generated message will appear here.
              </div>
            ) : (
              <div className="space-y-3">
                <ChatBubble text={result.body} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={sendOnWhatsApp}
                    className="bg-[#25d366] text-white hover:bg-[#1ebe5b]"
                  >
                    <MessageCircle className="h-4 w-4" /> Send on WhatsApp
                  </Button>
                  {apiConfigured && (
                    <Button type="button" size="sm" variant="outline" onClick={sendViaApi} disabled={sending || !phone.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send via API
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => copy(result.body)}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  “Send on WhatsApp” opens WhatsApp with your message pre-filled — you send it from
                  your own WhatsApp Business number.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No messages yet"
              description="Generate your first WhatsApp message above."
            />
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{enumLabel(r.category)}</Badge>
                      {r.companyName && (
                        <span className="text-xs text-muted-foreground">{r.companyName}</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => copy(r.body)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
