"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ClipboardList,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CommandCenterCalendarEvent,
  CommandCenterCalendarPayload,
  CalendarEventKind,
} from "@/lib/creator-command-center-calendar";
import { COMMAND_CENTER_CALENDAR_REFETCH_MS } from "@/lib/dashboard-refresh";

export const COMMAND_CENTER_CALENDAR_QUERY_KEY = ["command-center-calendar"] as const;

const KIND_META: Record<
  CalendarEventKind,
  { label: string; dot: string; group: "shooting" | "tasks" | "incidents" | "manual" }
> = {
  SHOOT_DAY: { label: "Shoot day", dot: "bg-orange-400", group: "shooting" },
  CALL_SHEET: { label: "Call sheet", dot: "bg-amber-300", group: "shooting" },
  PROJECT_TASK: { label: "Production task", dot: "bg-cyan-400", group: "tasks" },
  TABLE_READ: { label: "Table read", dot: "bg-emerald-400", group: "tasks" },
  INCIDENT: { label: "Incident", dot: "bg-red-400", group: "incidents" },
  INCIDENT_RESOLVED: { label: "Incident resolved", dot: "bg-rose-300", group: "incidents" },
  MANUAL_PERSONAL: { label: "Personal task", dot: "bg-violet-400", group: "manual" },
  MANUAL_TEAM: { label: "Team task", dot: "bg-indigo-400", group: "manual" },
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfCalendarGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const dow = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildGridDays(month: Date) {
  const start = startOfCalendarGrid(month);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function eventsForDay(events: CommandCenterCalendarEvent[], day: Date) {
  return events.filter((e) => sameDay(new Date(e.startAt), day));
}

type EventFormState = {
  title: string;
  description: string;
  date: string;
  visibility: "PERSONAL" | "TEAM";
  projectId: string;
  assigneeId: string;
};

function EventModal({
  open,
  onClose,
  initialDate,
  payload,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  payload: CommandCenterCalendarPayload;
  editing: CommandCenterCalendarEvent | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EventFormState>(() => ({
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    date: editing ? toDateInputValue(new Date(editing.startAt)) : initialDate,
    visibility: editing?.visibility ?? "PERSONAL",
    projectId: editing?.projectId ?? "",
    assigneeId: editing?.assigneeId ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const startAt = new Date(`${form.date}T12:00:00`).toISOString();
      const body = {
        title: form.title,
        description: form.description || null,
        startAt,
        allDay: true,
        visibility: form.visibility,
        projectId: form.projectId || null,
        assigneeId: form.assigneeId || null,
      };
      const url = editing
        ? `/api/creator/command-center/calendar/${editing.id}`
        : "/api/creator/command-center/calendar";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator/command-center/calendar/${editing.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Delete failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div
        className="storytime-section fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-5 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-orange-400" />
              {editing ? "Edit task" : "Add calendar task"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Track film progress — e.g. review draft 1, deliverables, prep notes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-400">Title</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Review draft 1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Notes (optional)</span>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          {payload.projects.length > 0 && (
            <label className="block">
              <span className="text-xs text-slate-400">Link to project (optional)</span>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white"
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              >
                <option value="">All projects / studio-wide</option>
                {payload.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {payload.isCompanyAccount && payload.companyId && (
            <>
              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-xs text-slate-400">Visibility</legend>
                <div className="flex flex-wrap gap-3 mt-1">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.visibility === "PERSONAL"}
                      onChange={() => setForm((f) => ({ ...f, visibility: "PERSONAL" }))}
                    />
                    <User className="w-3.5 h-3.5 text-violet-300" />
                    Personal (only you & assignee)
                  </label>
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={form.visibility === "TEAM"}
                      onChange={() => setForm((f) => ({ ...f, visibility: "TEAM" }))}
                    />
                    <Users className="w-3.5 h-3.5 text-indigo-300" />
                    Team ({payload.companyName ?? "company"})
                  </label>
                </div>
              </fieldset>
              <label className="block">
                <span className="text-xs text-slate-400">Assign to (optional)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-white"
                  value={form.assigneeId}
                  onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {payload.teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                      {m.profileDisplayName !== m.name ? ` · ${m.profileDisplayName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" size="sm" onClick={submit} disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add task"}
            </Button>
            {editing && (
              <Button type="button" size="sm" variant="outline" onClick={deleteEvent} disabled={saving}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function DayDetailPanel({
  day,
  events,
  onClose,
  onAdd,
  onEdit,
}: {
  day: Date;
  events: CommandCenterCalendarEvent[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (e: CommandCenterCalendarEvent) => void;
}) {
  const shooting = events.filter((e) => KIND_META[e.kind].group === "shooting");
  const tasks = events.filter((e) => ["tasks", "manual"].includes(KIND_META[e.kind].group));
  const incidents = events.filter((e) => KIND_META[e.kind].group === "incidents");

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white">
          {day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </h4>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="text-xs h-8" onClick={onAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add task
          </Button>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-slate-500">Nothing scheduled — add a personal or team task.</p>
      ) : (
        <div className="space-y-4">
          {shooting.length > 0 && (
            <EventGroup title="Shooting & on set" icon={Clapperboard} events={shooting} onEdit={onEdit} />
          )}
          {tasks.length > 0 && (
            <EventGroup title="Tasks & prep" icon={ClipboardList} events={tasks} onEdit={onEdit} />
          )}
          {incidents.length > 0 && (
            <EventGroup title="Incidents" icon={ShieldAlert} events={incidents} onEdit={onEdit} />
          )}
        </div>
      )}
    </div>
  );
}

function EventGroup({
  title,
  icon: Icon,
  events,
  onEdit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  events: CommandCenterCalendarEvent[];
  onEdit: (e: CommandCenterCalendarEvent) => void;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </p>
      <ul className="space-y-1.5">
        {events.map((e) => {
          const meta = KIND_META[e.kind];
          const row = (
            <>
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100 truncate">{e.title}</p>
                <p className="text-[10px] text-slate-500">
                  {meta.label}
                  {e.projectTitle ? ` · ${e.projectTitle}` : ""}
                  {e.assigneeName ? ` · ${e.assigneeName}` : ""}
                  {e.status ? ` · ${e.status}` : ""}
                </p>
              </div>
              {e.editable && (
                <button
                  type="button"
                  className="shrink-0 text-[10px] text-orange-300 hover:underline"
                  onClick={(ev) => {
                    ev.preventDefault();
                    onEdit(e);
                  }}
                >
                  Edit
                </button>
              )}
            </>
          );

          if (e.href && !e.editable) {
            return (
              <li key={e.id}>
                <Link
                  href={e.href}
                  className="flex items-start gap-2 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2 text-xs hover:border-white/12"
                >
                  {row}
                </Link>
              </li>
            );
          }

          return (
            <li
              key={e.id}
              className="flex items-start gap-2 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2 text-xs"
            >
              {row}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CommandCenterCalendar() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommandCenterCalendarEvent | null>(null);

  const monthParam = monthKey(month);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: [...COMMAND_CENTER_CALENDAR_QUERY_KEY, monthParam],
    queryFn: async (): Promise<CommandCenterCalendarPayload> => {
      const r = await fetch(`/api/creator/command-center/calendar?month=${monthParam}`);
      if (!r.ok) throw new Error("Failed to load calendar");
      return r.json() as Promise<CommandCenterCalendarPayload>;
    },
    refetchInterval: COMMAND_CENTER_CALENDAR_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  const events = data?.events ?? [];
  const gridDays = useMemo(() => buildGridDays(month), [month]);
  const today = useMemo(() => new Date(), []);

  const openAdd = useCallback((day: Date) => {
    setSelectedDay(day);
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((e: CommandCenterCalendarEvent) => {
    setEditing(e);
    setSelectedDay(new Date(e.startAt));
    setModalOpen(true);
  }, []);

  const onSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: COMMAND_CENTER_CALENDAR_QUERY_KEY });
  }, [queryClient]);

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const shootingCount = events.filter((e) => KIND_META[e.kind].group === "shooting").length;
  const taskCount = events.filter((e) => ["tasks", "manual"].includes(KIND_META[e.kind].group)).length;

  return (
    <section className="cinematic-glass rounded-2xl border border-white/8 p-4 md:p-5">
      {isError && (
        <div className="mb-3 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {(error as Error)?.message ?? "Calendar failed to load"}.{" "}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-orange-400" />
            Production calendar
          </h2>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Shoot days, call sheets, on-set tasks, incidents, and table reads across all projects — plus your personal
            and team tasks. Wired to{" "}
            <Link href="/creator/production/control-center" className="text-orange-300 hover:underline">
              Production Control Center
            </Link>{" "}
            and on-set tools.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => openAdd(selectedDay ?? today)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add task
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => void refetch()}
            title="Refresh calendar"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-orange-400" : "text-slate-400"}`} />
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-medium text-white">{monthLabel}</span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="ml-2 text-[10px] uppercase tracking-wide text-orange-300 hover:underline"
            onClick={() => {
              setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
              setSelectedDay(new Date());
            }}
          >
            Today
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-orange-400 mr-1 align-middle" />
            {shootingCount} shooting
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 mr-1 align-middle" />
            {taskCount} tasks
          </span>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-white/6 bg-white/5">
        {gridDays.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = selectedDay != null && sameDay(day, selectedDay);
          const dayEvents = eventsForDay(events, day);
          const hasShoot = dayEvents.some((e) => KIND_META[e.kind].group === "shooting");
          const hasTask = dayEvents.some((e) => ["tasks", "manual"].includes(KIND_META[e.kind].group));
          const hasIncident = dayEvents.some((e) => KIND_META[e.kind].group === "incidents");

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              onDoubleClick={() => openAdd(day)}
              className={`min-h-[4.5rem] md:min-h-[5.5rem] p-1.5 text-left transition-colors ${
                inMonth ? "bg-slate-950/40" : "bg-slate-950/20"
              } ${isSelected ? "ring-1 ring-inset ring-orange-400/60" : "hover:bg-white/[0.04]"}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-orange-500 text-white font-semibold" : inMonth ? "text-slate-200" : "text-slate-600"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className={`truncate rounded px-1 py-0.5 text-[9px] md:text-[10px] leading-tight text-slate-200 border-l-2 border-orange-400/80 bg-white/[0.04]`}
                    style={{
                      borderLeftColor:
                        e.kind === "SHOOT_DAY" || e.kind === "CALL_SHEET"
                          ? undefined
                          : e.kind === "PROJECT_TASK" || e.kind === "TABLE_READ"
                            ? "rgb(34 211 238 / 0.8)"
                            : e.kind.startsWith("INCIDENT")
                              ? "rgb(248 113 113 / 0.8)"
                              : e.kind === "MANUAL_TEAM"
                                ? "rgb(129 140 248 / 0.8)"
                                : "rgb(167 139 250 / 0.8)",
                    }}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[9px] text-slate-500">+{dayEvents.length - 3} more</p>
                )}
              </div>
              {(hasShoot || hasTask || hasIncident) && dayEvents.length <= 3 && (
                <div className="mt-1 flex gap-0.5">
                  {hasShoot && <span className="h-1 w-1 rounded-full bg-orange-400" />}
                  {hasTask && <span className="h-1 w-1 rounded-full bg-cyan-400" />}
                  {hasIncident && <span className="h-1 w-1 rounded-full bg-red-400" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        {(Object.entries(KIND_META) as [CalendarEventKind, (typeof KIND_META)[CalendarEventKind]][]).map(
          ([kind, meta]) => (
            <span key={kind} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          ),
        )}
      </div>

      {selectedDay && (
        <DayDetailPanel
          day={selectedDay}
          events={eventsForDay(events, selectedDay)}
          onClose={() => setSelectedDay(null)}
          onAdd={() => openAdd(selectedDay)}
          onEdit={openEdit}
        />
      )}

      {modalOpen && data && (
        <EventModal
          key={editing?.id ?? `new-${selectedDay?.toISOString() ?? "today"}`}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          initialDate={toDateInputValue(selectedDay ?? today)}
          payload={data}
          editing={editing}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
