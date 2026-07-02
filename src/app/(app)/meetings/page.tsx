import Link from "next/link";
import { CalendarClock, MapPin, FileDown, Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/grade-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewMeetingDialog } from "@/components/meetings/new-meeting-dialog";
import { prisma } from "@/lib/prisma";
import { formatDateTime, enumLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

type MeetingWithRels = Awaited<ReturnType<typeof getMeetings>>[number];

async function getMeetings() {
  return prisma.meeting.findMany({
    include: { company: true, user: true },
    orderBy: { scheduledAt: "desc" },
  });
}

function MeetingCard({ meeting }: { meeting: MeetingWithRels }) {
  const questionCount = Array.isArray(meeting.questionnaire)
    ? (meeting.questionnaire as { questions?: unknown[] }[]).reduce(
        (n, s) => n + (Array.isArray(s.questions) ? s.questions.length : 0),
        0
      )
    : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{meeting.title}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" /> {meeting.company.name}
            </p>
          </div>
          <StatusBadge status={meeting.status} />
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> {formatDateTime(meeting.scheduledAt)} ·{" "}
            {meeting.duration} min
          </p>
          {meeting.location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {meeting.location}
            </p>
          )}
          <p className="text-xs">
            {enumLabel(meeting.type)}
            {questionCount > 0 && ` · ${questionCount} discovery questions`}
          </p>
        </div>

        {questionCount > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/meetings/${meeting.id}/pdf`} target="_blank" rel="noreferrer">
                <FileDown className="h-4 w-4" /> Export PDF
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function MeetingsPage() {
  const meetings = await getMeetings();
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => new Date(m.scheduledAt).getTime() >= now && m.status !== "CANCELLED")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const past = meetings.filter(
    (m) => new Date(m.scheduledAt).getTime() < now || m.status === "CANCELLED"
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Discovery Meetings"
        description="Schedule meetings and generate AI-powered, industry-specific discovery questionnaires."
      >
        <NewMeetingDialog />
      </PageHeader>

      {meetings.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meetings yet"
          description="Schedule your first discovery meeting and generate an 80+ question industry questionnaire."
          action={<NewMeetingDialog />}
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Upcoming ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Past ({past.length})</h2>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past meetings.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/companies" className="underline underline-offset-2">
          Import more companies
        </Link>{" "}
        to run discovery on them.
      </p>
    </div>
  );
}
