import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Users,
  Linkedin,
  FileText,
  Send,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreRing, ScoreBar } from "@/components/shared/score";
import { GradeBadge, StatusBadge } from "@/components/shared/grade-badge";
import { ConfidenceBadge, EstimateNote } from "@/components/shared/confidence-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ProspectActions } from "@/components/prospects/prospect-actions";
import { NotesPanel } from "@/components/shared/notes-panel";
import { QuickContact } from "@/components/shared/quick-contact";
import { getCurrentUser, roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { userCardSelect } from "@/lib/selects";
import { formatDate, formatINR, enumLabel } from "@/lib/utils";
import { istDateInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Format a Date as yyyy-MM-dd (IST) for <input type="date">. */
function toDateInput(d: Date | null | undefined): string | null {
  if (!d) return null;
  return istDateInputValue(new Date(d));
}

export const metadata = { title: "Prospect" };

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [prospect, users, currentUser] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            analysis: true,
            recommendation: true,
            leadIntelligence: true,
            decisionMakers: true,
            notes: {
              include: { author: { select: { id: true, name: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        assignedTo: { select: userCardSelect },
        followUps: { include: { user: { select: userCardSelect } }, orderBy: { dueAt: "asc" } },
        tasks: true,
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCurrentUser(),
  ]);

  if (!prospect) notFound();

  const canAssign = currentUser ? roleCan(currentUser.role, "prospects.assign") : false;
  const canWriteNotes = currentUser ? roleCan(currentUser.role, "companies.edit") : false;
  const canDeleteNotes = currentUser ? roleCan(currentUser.role, "companies.delete") : false;

  const c = prospect.company;
  const notes = c.notes.map((n) => ({
    id: n.id,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
    author: n.author,
  }));
  const a = c.analysis;
  const primaryDM = c.decisionMakers.find((d) => d.isPrimary) ?? c.decisionMakers[0];

  return (
    <div className="space-y-6">
      <PageHeader title={c.name} description={`${prospect.prospectId} · ${c.industry ?? "—"}`}>
        <StatusBadge status={prospect.status} />
        {prospect.syncedToCrm && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Synced
          </span>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/proposals">
            <FileText className="h-4 w-4" /> Proposal
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/email-generator?companyId=${c.id}`}>
            <Send className="h-4 w-4" /> Email
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          <ProspectActions
            prospectId={prospect.id}
            synced={prospect.syncedToCrm}
            users={users}
            canAssign={canAssign}
            initial={{
              status: prospect.status,
              assignedToId: prospect.assignedToId,
              proposalValue: prospect.proposalValue,
              expectedCloseDate: toDateInput(prospect.expectedCloseDate),
              probability: prospect.probability,
              nextFollowUpDate: toDateInput(prospect.nextFollowUpDate),
            }}
          />

          {/* Scores */}
          {a && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Opportunity Scores
                  <ConfidenceBadge confidence="ESTIMATED" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <div className="flex flex-col items-center gap-2">
                    <ScoreRing score={a.leadScore} label="Lead" />
                    <GradeBadge grade={a.leadGrade} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <ScoreBar label="CRM Opportunity" score={a.crmOpportunityScore} />
                    <ScoreBar label="AI Opportunity" score={a.aiOpportunityScore} />
                    <ScoreBar label="Automation" score={a.automationScore} />
                    <ScoreBar label="Digital Maturity" score={a.digitalMaturityScore} />
                  </div>
                </div>
                {a.businessSummary && (
                  <p className="mt-4 text-sm text-muted-foreground">{a.businessSummary}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              {prospect.followUps.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No follow-ups yet"
                  description="Schedule a follow-up to keep this prospect moving."
                />
              ) : (
                <ul className="space-y-3">
                  {prospect.followUps.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {enumLabel(f.channel)} · {enumLabel(f.status)}
                        </p>
                        {f.notes && <p className="truncate text-muted-foreground">{f.notes}</p>}
                        <p className="text-xs text-muted-foreground">{f.user.name}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(f.dueAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <NotesPanel
            companyId={c.id}
            initialNotes={notes}
            currentUserId={currentUser?.id ?? ""}
            canWrite={canWriteNotes}
            canDeleteAny={canDeleteNotes}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <QuickContact
            companyId={c.id}
            companyName={c.name}
            email={c.publicEmail}
            phone={c.phone}
            contactName={primaryDM?.name}
          />

          {/* Company */}
          <Card>
            <CardHeader>
              <CardTitle>Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={MapPin} value={[c.city, c.state].filter(Boolean).join(", ") || "—"} />
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{c.employeeEstimate ?? "—"} employees</span>
                <ConfidenceBadge confidence={c.employeeConfidence} />
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{c.revenueEstimate ?? "—"}</span>
                <ConfidenceBadge confidence={c.revenueConfidence} />
              </div>
              {c.website && (
                <InfoRow icon={Globe} value={c.website} href={c.website} />
              )}
              {c.linkedinUrl && (
                <InfoRow icon={Linkedin} value="LinkedIn" href={c.linkedinUrl} />
              )}
              {c.phone && <InfoRow icon={Phone} value={c.phone} />}
              {c.publicEmail && <InfoRow icon={Mail} value={c.publicEmail} />}
            </CardContent>
          </Card>

          {/* Decision maker */}
          {primaryDM && (
            <Card>
              <CardHeader>
                <CardTitle>Decision Maker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{primaryDM.name}</p>
                {primaryDM.designation && (
                  <p className="text-muted-foreground">{primaryDM.designation}</p>
                )}
                {primaryDM.email && <p className="text-muted-foreground">{primaryDM.email}</p>}
                {primaryDM.phone && <p className="text-muted-foreground">{primaryDM.phone}</p>}
                {primaryDM.linkedinUrl && (
                  <a
                    href={primaryDM.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    LinkedIn profile
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pipeline snapshot */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SnapshotRow label="Proposal Value" value={formatINR(prospect.proposalValue)} />
              <SnapshotRow
                label="Probability"
                value={prospect.probability != null ? `${prospect.probability}%` : "—"}
              />
              <SnapshotRow label="Expected Close" value={formatDate(prospect.expectedCloseDate)} />
              <SnapshotRow label="Next Follow-up" value={formatDate(prospect.nextFollowUpDate)} />
              <SnapshotRow label="Last Contact" value={formatDate(prospect.lastContactDate)} />
              <SnapshotRow label="Assigned To" value={prospect.assignedTo?.name ?? "Unassigned"} />
            </CardContent>
          </Card>
        </div>
      </div>

      <EstimateNote />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  value,
  href,
}: {
  icon: typeof MapPin;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-primary hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="truncate">{value}</span>
      )}
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
