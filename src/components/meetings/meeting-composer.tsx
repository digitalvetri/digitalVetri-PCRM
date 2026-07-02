"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CalendarClock, FileDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CompanyOption {
  id: string;
  name: string;
  industry: string | null;
}

interface QuestionnaireSection {
  section: string;
  questions: { q: string }[];
}

const MEETING_TYPES = [
  "DISCOVERY",
  "DEMO",
  "PROPOSAL_REVIEW",
  "NEGOTIATION",
  "KICKOFF",
  "FOLLOW_UP",
] as const;

function label(v: string) {
  return v
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function MeetingComposer({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const companyFieldId = React.useId();
  const typeId = React.useId();
  const titleId = React.useId();
  const scheduledAtId = React.useId();
  const agendaId = React.useId();
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = React.useState("");
  const [type, setType] = React.useState<(typeof MEETING_TYPES)[number]>("DISCOVERY");
  const [title, setTitle] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [agenda, setAgenda] = React.useState("");

  const [sections, setSections] = React.useState<QuestionnaireSection[]>([]);
  const [openSection, setOpenSection] = React.useState<number | null>(0);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/companies?pageSize=100")
      .then((r) => r.json())
      .then((d) => setCompanies(d.items ?? []))
      .catch(() => toast.error("Failed to load companies"));
  }, []);

  const selectedCompany = companies.find((c) => c.id === companyId);
  const questionCount = sections.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);

  async function generateQuestions() {
    if (!companyId) {
      toast.error("Select a company first");
      return;
    }
    setGenerating(true);
    setSections([]);
    try {
      const res = await fetch("/api/meetings/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate questions");
      setSections(data.questionnaire ?? []);
      setOpenSection(0);
      const count = (data.questionnaire ?? []).reduce(
        (s: number, x: QuestionnaireSection) => s + (x.questions?.length ?? 0),
        0
      );
      toast.success(`Generated ${count} discovery questions`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function saveMeeting() {
    if (!companyId || !title.trim() || !scheduledAt) {
      toast.error("Company, title and date/time are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          title: title.trim(),
          type,
          scheduledAt: new Date(scheduledAt).toISOString(),
          agenda: agenda.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save meeting");

      // Attach the generated questionnaire if we produced one.
      if (sections.length && data.meeting?.id) {
        await fetch(`/api/meetings/${data.meeting.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionnaire: sections,
            questionnaireIndustry: selectedCompany?.industry ?? undefined,
          }),
        });
      }

      toast.success("Meeting scheduled");
      onSaved?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

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
          <Label htmlFor={typeId}>Meeting Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id={typeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEETING_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {label(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={titleId}>Title</Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Discovery call with…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={scheduledAtId}>Date &amp; Time</Label>
          <Input
            id={scheduledAtId}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={agendaId}>Agenda (optional)</Label>
        <Textarea
          id={agendaId}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          placeholder="Key topics to cover…"
          rows={2}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={generateQuestions} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate Questions
            </>
          )}
        </Button>
        <Button type="button" onClick={saveMeeting} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <CalendarClock className="h-4 w-4" /> Save Meeting
            </>
          )}
        </Button>
      </div>

      {generating && (
        <p className="text-sm text-muted-foreground">
          Building an industry-tailored questionnaire. Manufacturing companies get 80+ questions —
          this can take a moment.
        </p>
      )}

      {sections.length > 0 && (
        <div className="rounded-xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold">
              Discovery Questionnaire
              <span className="ml-2 font-normal text-muted-foreground">
                {questionCount} questions · {sections.length} sections
              </span>
            </div>
          </div>
          <div className="divide-y">
            {sections.map((s, i) => (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setOpenSection(openSection === i ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
                >
                  <span>
                    {s.section}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {s.questions?.length ?? 0}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      openSection === i && "rotate-180"
                    )}
                  />
                </button>
                {openSection === i && (
                  <ol className="list-decimal space-y-1.5 px-8 pb-4 text-sm text-muted-foreground">
                    {(s.questions ?? []).map((q, qi) => (
                      <li key={qi}>{q.q}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExportQuestionnaireLink({ meetingId }: { meetingId: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/meetings/${meetingId}/pdf`} target="_blank" rel="noreferrer">
        <FileDown className="h-4 w-4" /> Export PDF
      </a>
    </Button>
  );
}
