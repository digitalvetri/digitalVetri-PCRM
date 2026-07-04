"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Company, CompanyAnalysis, DecisionMaker, Prospect } from "@prisma/client";
import { MoreHorizontal, Search, Building2, ExternalLink, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScoreBar } from "@/components/shared/score";
import { GradeBadge, StatusBadge } from "@/components/shared/grade-badge";
import { ConfidenceBadge } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RelationshipBadge } from "@/components/shared/relationship-badge";
import { LEAD_GRADES, LEAD_GRADE_LABELS } from "@/lib/constants";

export type CompanyRow = Company & {
  analysis: CompanyAnalysis | null;
  decisionMakers: DecisionMaker[];
  prospect: Prospect | null;
};

const ALL = "ALL";

/** Trim the parenthetical from long service names for compact chips. */
function shortService(s: string): string {
  return s.replace(/\s*\(.*\)$/, "");
}

export function CompaniesTable({
  companies,
  industries,
  cities,
  canDelete = false,
}: {
  companies: CompanyRow[];
  industries: string[];
  cities: string[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [industry, setIndustry] = React.useState(ALL);
  const [city, setCity] = React.useState(ALL);
  const [grade, setGrade] = React.useState(ALL);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (q) {
        const hay = [c.name, c.phone, c.publicEmail].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (industry !== ALL && c.industry !== industry) return false;
      if (city !== ALL && c.city !== city) return false;
      if (grade !== ALL && c.analysis?.leadGrade !== grade) return false;
      return true;
    });
  }, [companies, search, industry, city, grade]);

  async function runAnalysis(c: CompanyRow) {
    setBusyId(c.id);
    const toastId = toast.loading(`Running AI analysis on ${c.name}…`);
    try {
      const res = await fetch(`/api/companies/${c.id}/analyze`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      toast.success(`Analysis complete for ${c.name}.`, { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed", { id: toastId });
    } finally {
      setBusyId(null);
    }
  }

  async function addToProspects(c: CompanyRow) {
    setBusyId(c.id);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: c.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add prospect");
      toast.success(
        json.created ? `${c.name} added to prospects.` : `${c.name} is already a prospect.`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add prospect");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCompany(c: CompanyRow) {
    if (!window.confirm(`Delete ${c.name}? This also removes its prospect, notes and follow-ups. This cannot be undone.`)) {
      return;
    }
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/companies/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to delete");
      }
      toast.success(`${c.name} deleted.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email…"
            aria-label="Search companies by name, phone or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Industries</SelectItem>
            {industries.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Grades</SelectItem>
            {LEAD_GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {LEAD_GRADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies found"
          description="Import companies from Excel, a website, Google Maps or LinkedIn, or add one manually to get started."
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Lead Score</TableHead>
                <TableHead>CRM / Automation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const a = c.analysis;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <Link
                          href={`/companies/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.website && (
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <ExternalLink className="h-3 w-3" />
                            {c.website.replace(/^https?:\/\//, "")}
                          </p>
                        )}
                        <RelationshipBadge status={c.relationship} className="mt-1" />
                        {c.targetServices.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.targetServices.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                              >
                                {shortService(s)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm">{c.industry ?? "—"}</p>
                        {c.subIndustry && (
                          <p className="truncate text-xs text-muted-foreground">{c.subIndustry}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {c.employeeEstimate != null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums">{c.employeeEstimate}</span>
                          <ConfidenceBadge confidence={c.employeeConfidence} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <ScoreBar score={a.leadScore} />
                          </div>
                          <GradeBadge grade={a.leadGrade} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not analysed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a ? (
                        <div className="space-y-1">
                          <div className="w-24">
                            <ScoreBar score={a.crmOpportunityScore} />
                          </div>
                          <div className="w-24">
                            <ScoreBar score={a.automationScore} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.prospect ? <StatusBadge status={c.prospect.status} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === c.id}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/companies/${c.id}`}>View</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => runAnalysis(c)}>
                            Run AI Analysis
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => addToProspects(c)}>
                            Add to Prospects
                          </DropdownMenuItem>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => deleteCompany(c)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {filtered.length} compan{filtered.length === 1 ? "y" : "ies"}
      </p>
    </div>
  );
}
