"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, FileDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";

interface CompanyOption {
  id: string;
  name: string;
  industry: string | null;
}

interface ProposalContent {
  companyOverview?: string;
  currentProblems?: { title: string; description: string }[];
  timeline?: { phase: string; duration: string; deliverables: string }[];
  pricing?: { item: string; description: string; amount: number }[];
  totalValue?: number;
}

interface GeneratedProposal {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  totalValue: number;
  content: ProposalContent;
}

export function ProposalGenerator({ onGenerated }: { onGenerated?: () => void }) {
  const router = useRouter();
  const companyFieldId = React.useId();
  const titleId = React.useId();
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [marking, setMarking] = React.useState(false);
  const [proposal, setProposal] = React.useState<GeneratedProposal | null>(null);

  React.useEffect(() => {
    fetch("/api/companies?pageSize=100")
      .then((r) => r.json())
      .then((d) => setCompanies(d.items ?? []))
      .catch(() => toast.error("Failed to load companies"));
  }, []);

  async function generate() {
    if (!companyId) {
      toast.error("Select a company first");
      return;
    }
    setLoading(true);
    setProposal(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate proposal");
      setProposal(data.proposal);
      toast.success(`Proposal ${data.proposal.proposalNo} generated`);
      onGenerated?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function markSent() {
    if (!proposal) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setProposal((p) => (p ? { ...p, status: "SENT" } : p));
      toast.success("Marked as sent");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMarking(false);
    }
  }

  const content = proposal?.content;
  const pricing = content?.pricing ?? [];
  const problems = content?.currentProblems ?? [];
  const timeline = content?.timeline ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={companyFieldId}>Company</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger id={companyFieldId}>
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.industry ? ` · ${c.industry}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={titleId}>Title (optional)</Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-generated if left blank"
          />
        </div>
      </div>

      <Button type="button" onClick={generate} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </>
        )}
      </Button>

      {loading && (
        <p className="text-sm text-muted-foreground">
          Drafting a full proposal from this company&apos;s analysis and recommendation. This can
          take a moment.
        </p>
      )}

      {proposal && (
        <div className="space-y-5 rounded-xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">{proposal.title}</h3>
              <p className="text-sm text-muted-foreground">
                {proposal.proposalNo} · {proposal.status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-lg font-bold text-primary">
                {formatINR(content?.totalValue ?? proposal.totalValue)}
              </p>
            </div>
          </div>

          {content?.companyOverview && (
            <div>
              <h4 className="mb-1 text-sm font-semibold">Overview</h4>
              <p className="text-sm text-muted-foreground">{content.companyOverview}</p>
            </div>
          )}

          {problems.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-semibold">Current Problems</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {problems.slice(0, 5).map((p, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{p.title}:</span> {p.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pricing.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Pricing</h4>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pricing.map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{p.item}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                        <td className="px-3 py-2 text-right">{formatINR(p.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(content?.totalValue ?? proposal.totalValue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div>
              <h4 className="mb-1 text-sm font-semibold">Timeline</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {timeline.map((t, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{t.phase}</span> — {t.duration}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button asChild variant="outline">
              <a href={`/api/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer">
                <FileDown className="h-4 w-4" /> Download PDF
              </a>
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={markSent}
              disabled={marking || proposal.status === "SENT"}
            >
              {marking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Marking…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Mark as Sent
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
