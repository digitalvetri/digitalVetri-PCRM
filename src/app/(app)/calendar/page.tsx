import { PageHeader } from "@/components/shared/page-header";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const now = new Date();
  // Widen to current month ±1 so prev/next navigation still shows events
  // without any client re-fetch (client navigation is view-only).
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  const [meetings, followUps, tasks] = await Promise.all([
    prisma.meeting.findMany({
      where: { scheduledAt: { gte: rangeStart, lte: rangeEnd } },
      include: { company: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.followUp.findMany({
      where: {
        dueAt: { gte: rangeStart, lte: rangeEnd },
        status: { in: ["PENDING", "RESCHEDULED"] },
      },
      include: { prospect: { include: { company: true } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        dueDate: { gte: rangeStart, lte: rangeEnd },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      include: { prospect: { include: { company: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...meetings.map((m) => ({
      id: `m-${m.id}`,
      type: "meeting" as const,
      title: m.title || `Meeting · ${m.company.name}`,
      date: m.scheduledAt.toISOString(),
      href: "/meetings",
    })),
    ...followUps.map((f) => ({
      id: `f-${f.id}`,
      type: "followup" as const,
      title: `Follow-up · ${f.prospect.company.name}`,
      date: f.dueAt.toISOString(),
      href: "/follow-ups",
    })),
    ...tasks.map((t) => ({
      id: `t-${t.id}`,
      type: "task" as const,
      title: t.title,
      date: (t.dueDate as Date).toISOString(),
      href: "/tasks",
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Your meetings, follow-ups and tasks in one unified month view."
      />
      <CalendarView events={events} />
    </div>
  );
}
