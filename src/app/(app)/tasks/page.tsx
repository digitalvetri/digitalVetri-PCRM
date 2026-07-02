import { ListTodo, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  TaskBoard,
  type TaskItem,
  type UserOption,
  type TaskProspectOption,
} from "@/components/tasks/task-board";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const [tasksRaw, usersRaw, prospectsRaw] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignedTo: true,
        prospect: { include: { company: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "asc" }],
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.prospect.findMany({ include: { company: true }, orderBy: { company: { name: "asc" } } }),
  ]);

  const tasks: TaskItem[] = tasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskItem["status"],
    priority: t.priority as TaskItem["priority"],
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    assigneeName: t.assignedTo?.name ?? null,
    companyName: t.prospect?.company.name ?? null,
  }));

  const users: UserOption[] = usersRaw.map((u) => ({ id: u.id, name: u.name }));
  const prospects: TaskProspectOption[] = prospectsRaw.map((p) => ({
    id: p.id,
    companyName: p.company.name,
  }));

  const now = new Date();
  const todo = tasks.filter((t) => t.status === "TODO").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const overdue = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate != null && new Date(t.dueDate) < now
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Track and organise your team's sales workflow.">
        {/* New Task action lives in the board so it can refresh on create. */}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="To Do" value={todo} icon={ListTodo} accent="primary" />
        <StatCard index={1} label="In Progress" value={inProgress} icon={Loader2} accent="cyan" />
        <StatCard index={2} label="Done" value={done} icon={CheckCircle2} accent="success" />
        <StatCard index={3} label="Overdue" value={overdue} icon={AlertTriangle} accent="warning" />
      </div>

      <TaskBoard tasks={tasks} users={users} prospects={prospects} />
    </div>
  );
}
