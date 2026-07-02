import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  FollowUpBoard,
  type FollowUpItem,
  type ProspectOption,
} from "@/components/follow-ups/follow-up-board";
import { prisma } from "@/lib/prisma";
import { istStartOfDay, istEndOfDay } from "@/lib/time";

export const dynamic = "force-dynamic";

type FollowUpChannel = FollowUpItem["channel"];

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  // IST day boundaries (server runs UTC) so "overdue/today" match the API route.
  const startOfToday = istStartOfDay();
  const endOfToday = istEndOfDay();
  const in7 = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [active, completedRaw, prospectsRaw] = await Promise.all([
    prisma.followUp.findMany({
      where: { status: { in: ["PENDING", "RESCHEDULED"] } },
      include: { prospect: { include: { company: true } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.followUp.findMany({
      where: { status: "DONE" },
      include: { prospect: { include: { company: true } } },
      orderBy: { completedAt: "desc" },
      take: 9,
    }),
    // Only the two fields the picker renders — not full prospect+company rows.
    prisma.prospect.findMany({
      where: { status: { notIn: ["LOST", "DISQUALIFIED", "WON"] } },
      select: { id: true, company: { select: { name: true } } },
      orderBy: { company: { name: "asc" } },
      take: 500,
    }),
  ]);

  const toItem = (f: (typeof active)[number]): FollowUpItem => ({
    id: f.id,
    dueAt: f.dueAt.toISOString(),
    channel: f.channel as FollowUpChannel,
    status: f.status,
    notes: f.notes,
    companyName: f.prospect.company.name,
    prospectId: f.prospectId,
  });

  const overdue: FollowUpItem[] = [];
  const today: FollowUpItem[] = [];
  const upcoming: FollowUpItem[] = [];

  for (const f of active) {
    const item = toItem(f);
    if (f.dueAt < startOfToday) overdue.push(item);
    else if (f.dueAt <= endOfToday) today.push(item);
    else if (f.dueAt <= in7) upcoming.push(item);
    else upcoming.push(item); // anything further out still counts as upcoming
  }

  const completed = completedRaw.map(toItem);

  const completedThisWeek = await prisma.followUp.count({
    where: { status: "DONE", completedAt: { gte: weekAgo } },
  });

  const prospects: ProspectOption[] = prospectsRaw.map((p) => ({
    id: p.id,
    companyName: p.company.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-up Manager"
        description="Stay on top of every prospect touchpoint — never let a lead go cold."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Due Today" value={today.length} icon={CalendarClock} accent="primary" />
        <StatCard index={1} label="Overdue" value={overdue.length} icon={AlertTriangle} accent="warning" />
        <StatCard
          index={2}
          label="Completed This Week"
          value={completedThisWeek}
          icon={CheckCircle2}
          accent="success"
        />
      </div>

      <FollowUpBoard
        overdue={overdue}
        today={today}
        upcoming={upcoming}
        completed={completed}
        prospects={prospects}
      />
    </div>
  );
}
