import type { Priority, FollowUpChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { parseISTDate } from "@/lib/time";

/**
 * Agentic tool executors — the things Vetri can DO in the app. Each is called
 * only after the user taps "Save" on the readback, and each route re-checks the
 * matching permission server-side.
 */

function toPriority(v?: string | null): Priority {
  const p = (v ?? "").toUpperCase();
  return p === "URGENT" || p === "HIGH" || p === "LOW" ? (p as Priority) : "MEDIUM";
}
function toChannel(v?: string | null): FollowUpChannel {
  const c = (v ?? "").toUpperCase();
  return c === "EMAIL" || c === "WHATSAPP" || c === "MEETING" || c === "LINKEDIN" ? (c as FollowUpChannel) : "CALL";
}

// --- Resolution helpers ---

export interface ProspectMatch {
  id: string;
  companyName: string;
}
/** Find an active deal (prospect) by its company name. */
export async function matchProspects(companyName: string): Promise<ProspectMatch[]> {
  const rows = await prisma.prospect.findMany({
    where: {
      status: { notIn: ["LOST", "DISQUALIFIED"] },
      company: { name: { contains: companyName.trim(), mode: "insensitive" } },
    },
    select: { id: true, company: { select: { name: true } } },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, companyName: r.company.name }));
}

/** Find an active employee by (partial) name — for voice HR actions. */
export async function matchEmployee(name: string): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.user.findMany({
    where: { role: "EMPLOYEE", isActive: true, name: { contains: name.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
  });
  return rows;
}

/** Find a PENDING leave request by the employee's (partial) name. */
export async function matchPendingLeave(employeeName: string): Promise<{ id: string; employeeName: string; type: string; startDate: string; endDate: string }[]> {
  const rows = await prisma.leaveRequest.findMany({
    where: { status: "PENDING", user: { name: { contains: employeeName.trim(), mode: "insensitive" } } },
    select: { id: true, type: true, startDate: true, endDate: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  return rows.map((r) => ({ id: r.id, employeeName: r.user.name, type: r.type, startDate: r.startDate.toISOString(), endDate: r.endDate.toISOString() }));
}

// --- Executors ---

export async function executeCreateTask(userId: string, p: { title: string; dueDate?: string | null; priority?: string | null }) {
  if (!p.title?.trim()) throw new ApiError(400, "A task needs a title.");
  const due = p.dueDate ? parseISTDate(p.dueDate) : null;
  await prisma.task.create({
    data: { title: p.title.trim(), createdById: userId, assignedToId: userId, dueDate: due ?? undefined, priority: toPriority(p.priority) },
  });
  return { title: p.title.trim() };
}

export async function executeCreateNote(userId: string, p: { companyId: string; content: string }) {
  const c = await prisma.company.findUnique({ where: { id: p.companyId }, select: { name: true } });
  if (!c) throw new ApiError(404, "Company not found.");
  if (!p.content?.trim()) throw new ApiError(400, "The note is empty.");
  await prisma.note.create({ data: { companyId: p.companyId, authorId: userId, content: p.content.trim() } });
  return { company: c.name };
}

export async function executeScheduleMeeting(userId: string, p: { companyId: string; title?: string | null; scheduledAt: string }) {
  const c = await prisma.company.findUnique({ where: { id: p.companyId }, select: { name: true } });
  if (!c) throw new ApiError(404, "Company not found.");
  const when = parseISTDate(p.scheduledAt);
  if (!when) throw new ApiError(400, "I couldn't read that date.");
  await prisma.meeting.create({
    data: { companyId: p.companyId, userId, title: p.title?.trim() || `Meeting with ${c.name}`, scheduledAt: when },
  });
  return { company: c.name };
}

export async function executeCreateFollowup(userId: string, p: { prospectId: string; dueAt: string; channel?: string | null; notes?: string | null }) {
  const prospect = await prisma.prospect.findUnique({ where: { id: p.prospectId }, include: { company: { select: { name: true } } } });
  if (!prospect) throw new ApiError(404, "Deal not found.");
  const due = parseISTDate(p.dueAt);
  if (!due) throw new ApiError(400, "I couldn't read that date.");
  await prisma.followUp.create({
    data: { prospectId: p.prospectId, userId, dueAt: due, channel: toChannel(p.channel), notes: p.notes?.trim() || undefined },
  });
  return { company: prospect.company.name };
}
