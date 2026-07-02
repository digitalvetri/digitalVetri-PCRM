"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Copy, RefreshCw, Mail, Send, ExternalLink } from "lucide-react";
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

const EMAIL_CATEGORIES = [
  { value: "COLD_OUTREACH", label: "Cold Outreach" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "MEETING_REQUEST", label: "Meeting Request" },
  { value: "PROPOSAL_FOLLOW_UP", label: "Proposal Follow-up" },
  { value: "THANK_YOU", label: "Thank You" },
] as const;

const LANGUAGES = ["English", "Hindi", "Tamil"] as const;

const NO_COMPANY = "__none__";

interface CompanyOption {
  id: string;
  name: string;
  publicEmail?: string | null;
}

interface RecentItem {
  id: string;
  category: string;
  subject: string | null;
  body: string;
  companyName: string | null;
  createdAt: string;
}

interface EmailResult {
  id: string;
  subject: string;
  body: string;
}

export function EmailGenerator({
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
  const toId = React.useId();
  const [companyId, setCompanyId] = React.useState<string>(initialCompanyId ?? NO_COMPANY);
  const [category, setCategory] = React.useState<string>("COLD_OUTREACH");
  const [tone, setTone] = React.useState("professional, warm");
  const [language, setLanguage] = React.useState<string>("English");
  const [to, setTo] = React.useState(
    () => companies.find((c) => c.id === initialCompanyId)?.publicEmail ?? ""
  );
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [canSend, setCanSend] = React.useState(false);
  const [result, setResult] = React.useState<EmailResult | null>(null);

  // Is server-side (SMTP) sending available? If not, we fall back to mailto.
  React.useEffect(() => {
    fetch("/api/content/email/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanSend(Boolean(d?.configured)))
      .catch(() => {});
  }, []);

  // Prefill the recipient from the selected company's public email.
  function onCompanyChange(id: string) {
    setCompanyId(id);
    const email = companies.find((c) => c.id === id)?.publicEmail;
    if (email) setTo(email);
  }

  async function sendNow() {
    if (!result) return;
    const recipient = to.trim();
    if (!recipient) {
      toast.error("Enter a recipient email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/content/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient,
          subject: result.subject,
          body: result.body,
          companyId: companyId === NO_COMPANY ? undefined : companyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      toast.success(`Email sent to ${recipient}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  function openInMailApp() {
    if (!result) return;
    const url = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(
      result.subject
    )}&body=${encodeURIComponent(result.body)}`;
    window.location.href = url;
  }

  async function generate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/content/email", {
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
      if (!res.ok) throw new Error(data.error ?? "Failed to generate email");
      setResult({ id: data.id, subject: data.subject, body: data.body });
      toast.success("Email generated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
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
              <Label htmlFor={toId}>Recipient email</Label>
              <Input
                id={toId}
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@company.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Auto-filled from the company&apos;s public email when available.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={categoryId}>Email Type</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id={categoryId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_CATEGORIES.map((c) => (
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
                  placeholder="professional, warm"
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
                  <Sparkles className="h-4 w-4" /> Generate Email
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
                Your generated email will appear here.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="flex items-start justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subject</p>
                    <p className="truncate font-semibold">{result.subject}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(result.subject, "Subject")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3 p-4">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                    {result.body}
                  </pre>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button type="button" size="sm" onClick={sendNow} disabled={sending || !to.trim()}>
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> Send to {to.trim() || "client"}
                        </>
                      )}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={openInMailApp}>
                      <ExternalLink className="h-4 w-4" /> Open in mail app
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(`Subject: ${result.subject}\n\n${result.body}`, "Email")}
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                  </div>
                  {!canSend && (
                    <p className="text-[11px] text-muted-foreground">
                      Direct sending isn’t configured yet — “Open in mail app” works now, or add SMTP
                      settings to enable one-click send.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState icon={Mail} title="No emails yet" description="Generate your first email above." />
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
                    <p className="mt-1 truncate text-sm font-medium">{r.subject ?? "(no subject)"}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{r.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copy(`Subject: ${r.subject ?? ""}\n\n${r.body}`, "Email")
                      }
                    >
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
