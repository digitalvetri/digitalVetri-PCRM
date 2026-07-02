"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, ChevronRight, ChevronLeft, Building2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/misc";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, enumLabel, initials, cn } from "@/lib/utils";

const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
type Priority = (typeof PRIORITIES)[number];
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

const PRIORITY_COLORS: Record<Priority, string> = {
  URGENT: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  LOW: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  assigneeName: string | null;
  companyName: string | null;
}

export interface UserOption {
  id: string;
  name: string;
}

export interface TaskProspectOption {
  id: string;
  companyName: string;
}

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: "TODO", label: "To Do", accent: "bg-slate-400" },
  { key: "IN_PROGRESS", label: "In Progress", accent: "bg-primary" },
  { key: "DONE", label: "Done", accent: "bg-emerald-500" },
];

const NEXT: Partial<Record<TaskStatus, TaskStatus>> = { TODO: "IN_PROGRESS", IN_PROGRESS: "DONE" };
const PREV: Partial<Record<TaskStatus, TaskStatus>> = { DONE: "IN_PROGRESS", IN_PROGRESS: "TODO" };

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        PRIORITY_COLORS[priority]
      )}
    >
      {enumLabel(priority)}
    </span>
  );
}

function TaskCard({ task, onChanged }: { task: TaskItem; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const overdue =
    task.dueDate != null && task.status !== "DONE" && new Date(task.dueDate) < new Date();

  async function move(status: TaskStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success(`Moved to ${enumLabel(status)}`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const next = NEXT[task.status];
  const prev = PREV[task.status];

  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold">{task.title}</p>
          <PriorityBadge priority={task.priority} />
        </div>

        {task.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-500")}>
              <CalendarClock className="h-3 w-3" /> {formatDate(task.dueDate)}
            </span>
          )}
          {task.companyName && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {task.companyName}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          {task.assigneeName ? (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{initials(task.assigneeName)}</AvatarFallback>
            </Avatar>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}

          <div className="flex items-center gap-1">
            {prev && (
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => move(prev)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {next && (
              <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => move(next)}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {enumLabel(next)}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewTaskDialog({
  users,
  prospects,
  onCreated,
}: {
  users: UserOption[];
  prospects: TaskProspectOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState("");
  const [prospectId, setProspectId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const priorityId = React.useId();
  const dueDateId = React.useId();
  const assigneeId = React.useId();
  const prospectFieldId = React.useId();

  async function submit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assignedToId: assignedToId || undefined,
          prospectId: prospectId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create task");
      toast.success("Task created");
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate("");
      setAssignedToId("");
      setProspectId("");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Create a task and assign it to a team member.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={titleId}>Title</Label>
            <Input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up on proposal…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={descriptionId}>Description (optional)</Label>
            <Textarea id={descriptionId} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={priorityId}>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id={priorityId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {enumLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={dueDateId}>Due Date</Label>
              <Input id={dueDateId} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={assigneeId}>Assignee (optional)</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger id={assigneeId}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={prospectFieldId}>Linked Prospect (optional)</Label>
              <Select value={prospectId} onValueChange={setProspectId}>
                <SelectTrigger id={prospectFieldId}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {prospects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskBoard({
  tasks,
  users,
  prospects,
}: {
  tasks: TaskItem[];
  users: UserOption[];
  prospects: TaskProspectOption[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
  const active = tasks.filter((t) => t.status !== "CANCELLED");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <NewTaskDialog users={users} prospects={prospects} onCreated={refresh} />
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No tasks yet"
          description="Create your first task to organise your sales workflow."
          action={<NewTaskDialog users={users} prospects={prospects} onCreated={refresh} />}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = byStatus(col.key);
            return (
              <div key={col.key} className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", col.accent)} />
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                    Nothing here
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((t) => (
                      <TaskCard key={t.id} task={t} onChanged={refresh} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
