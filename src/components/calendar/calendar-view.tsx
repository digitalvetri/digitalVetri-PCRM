"use client";

import * as React from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarClock, BellRing, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CalendarEventType = "meeting" | "followup" | "task";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string; // ISO
  href?: string;
}

const TYPE_META: Record<
  CalendarEventType,
  { label: string; dot: string; chip: string; icon: React.ComponentType<{ className?: string }> }
> = {
  meeting: {
    label: "Meetings",
    dot: "bg-violet-500",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    icon: CalendarClock,
  },
  followup: {
    label: "Follow-ups",
    dot: "bg-cyan-500",
    chip: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    icon: BellRing,
  },
  task: {
    label: "Tasks",
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: ListTodo,
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = React.useState<Date | null>(null);

  const today = new Date();

  const gridStart = startOfWeek(startOfMonth(cursor));
  const gridEnd = endOfWeek(endOfMonth(cursor));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = format(parseISO(e.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const dayEvents = (d: Date) => eventsByDay.get(format(d, "yyyy-MM-dd")) ?? [];
  const selectedEvents = selected ? dayEvents(selected) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {(Object.keys(TYPE_META) as CalendarEventType[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", TYPE_META[t].dot)} />
              {TYPE_META[t].label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <Card>
          <CardContent className="p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                  {w}
                </div>
              ))}
              {days.map((d) => {
                const evs = dayEvents(d);
                const inMonth = isSameMonth(d, cursor);
                const isToday = isSameDay(d, today);
                const isSelected = selected != null && isSameDay(d, selected);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setSelected(d)}
                    className={cn(
                      "flex min-h-[68px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[92px]",
                      inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                      isSelected ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-border",
                      evs.length > 0 && "hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {evs.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                            TYPE_META[e.type].chip
                          )}
                        >
                          {e.title}
                        </span>
                      ))}
                      {evs.length > 3 && (
                        <span className="px-1 text-[10px] text-muted-foreground">+{evs.length - 3} more</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side panel */}
      <Card className="h-fit">
        <CardContent className="space-y-4 p-5">
          <h3 className="text-sm font-semibold">
            {selected ? format(selected, "EEEE, d MMM yyyy") : "Select a day"}
          </h3>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Click any day to see its meetings, follow-ups and tasks.
            </p>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events on this day.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => {
                const meta = TYPE_META[e.type];
                const Icon = meta.icon;
                const inner = (
                  <div className="flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/50">
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", meta.chip)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {meta.label.replace(/s$/, "")} · {format(parseISO(e.date), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={e.id}>{e.href ? <Link href={e.href}>{inner}</Link> : inner}</li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
