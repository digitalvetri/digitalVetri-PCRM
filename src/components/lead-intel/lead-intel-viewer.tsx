"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Sparkles, Brain, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBar } from "@/components/shared/score";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";

interface IntelEntry {
  likelihood: number;
  details: string;
  reasoning: string;
}

export interface CompanyIntel {
  companyId: string;
  companyName: string;
  overallInsight: string | null;
  categories: { key: string; label: string; entry: IntelEntry }[];
}

export function LeadIntelViewer({
  companies,
  ungeneratedCompanies,
}: {
  companies: CompanyIntel[];
  ungeneratedCompanies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const viewCompanyId = React.useId();
  const generateForId = React.useId();
  const [selectedId, setSelectedId] = React.useState<string>(
    companies[0]?.companyId ?? ""
  );
  const [runningId, setRunningId] = React.useState<string>("");
  const [pendingId, setPendingId] = React.useState<string>("");

  const selected = companies.find((c) => c.companyId === selectedId);

  async function runAnalysis(companyId: string) {
    setRunningId(companyId);
    try {
      const res = await fetch(`/api/companies/${companyId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      toast.success("Lead intelligence generated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRunningId("");
    }
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Brain}
            title="No lead intelligence yet"
            description="Run AI analysis on a company to predict its operational challenges."
            action={
              ungeneratedCompanies.length > 0 ? (
                <div className="w-64 space-y-2">
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {ungeneratedCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!selectedId || runningId === selectedId}
                    onClick={() => runAnalysis(selectedId)}
                  >
                    {runningId === selectedId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Run Analysis
                      </>
                    )}
                  </Button>
                </div>
              ) : undefined
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-1.5 sm:max-w-xs">
            <label htmlFor={viewCompanyId} className="text-sm font-medium">View company</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id={viewCompanyId}>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.companyId} value={c.companyId}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected && (
            <Button asChild variant="outline">
              <Link href={`/companies/${selected.companyId}`}>
                <ExternalLink className="h-4 w-4" /> Open Company
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {ungeneratedCompanies.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full space-y-1.5 sm:max-w-xs">
              <label htmlFor={generateForId} className="text-sm font-medium">Generate for another company</label>
              <Select value={pendingId} onValueChange={setPendingId}>
                <SelectTrigger id={generateForId}>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {ungeneratedCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={!pendingId || runningId === pendingId}
              onClick={() => runAnalysis(pendingId)}
            >
              {runningId === pendingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Run Analysis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {selected?.overallInsight && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Overall Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{selected.overallInsight}</p>
          </CardContent>
        </Card>
      )}

      {selected && (
        <div className="grid gap-4 md:grid-cols-2">
          {selected.categories.map((cat) => (
            <Card key={cat.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{cat.label}</CardTitle>
                <ScoreBar score={cat.entry.likelihood} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{cat.entry.details}</p>
                {cat.entry.reasoning && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Why:</span> {cat.entry.reasoning}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EstimateNote />
    </div>
  );
}
