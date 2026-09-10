"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  status?: string;
  eventType?: string;
  priority?: string;
  department?: string | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildMonthCells(viewMonth: Date) {
  const first = startOfMonth(viewMonth);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export function ExecutiveCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    startsAt: "",
    endsAt: "",
    description: "",
  });

  async function loadEvents() {
    setLoading(true);
    try {
      const r = await fetch("/api/executive/calendar");
      const data = (await r.json()) as { events?: CalendarEvent[]; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to load calendar");
      setEvents(data.events ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = new Date(event.startsAt);
      const key = dayKey(start);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDay.get(dayKey(selected)) ?? [];
  const today = new Date();

  function openComposerForDay(day: Date) {
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(day);
    end.setHours(10, 0, 0, 0);
    setSelected(day);
    setForm({
      title: "",
      startsAt: toLocalInputValue(start),
      endsAt: toLocalInputValue(end),
      description: "",
    });
    setComposerOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.startsAt || !form.endsAt) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/executive/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          description: form.description.trim() || undefined,
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to create event");
      setComposerOpen(false);
      setForm({ title: "", startsAt: "", endsAt: "", description: "" });
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <StoryTimeLoadingCenter />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">
            Executive suite
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-white">
            Company calendar
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Leadership milestones, reviews, and operating cadence across Story Time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openComposerForDay(selected)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(249,115,22,0.25)] transition hover:bg-orange-400"
        >
          <Plus className="h-4 w-4" />
          New event
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:border-orange-500/30 hover:text-orange-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-display text-xl font-semibold text-white">
              {viewMonth.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
            </h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:border-orange-500/30 hover:text-orange-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-white/8 bg-slate-950/40">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-[minmax(92px,1fr)]">
            {cells.map((day) => {
              const inMonth = day.getMonth() === viewMonth.getMonth();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selected);
              const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(day)}
                  onDoubleClick={() => openComposerForDay(day)}
                  className={`group relative flex min-h-[92px] flex-col border-b border-r border-white/[0.06] p-2 text-left transition ${
                    inMonth ? "bg-transparent" : "bg-slate-950/50"
                  } ${isSelected ? "bg-orange-500/[0.08] ring-1 ring-inset ring-orange-500/40" : "hover:bg-white/[0.03]"}`}
                >
                  <span
                    className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                      isToday
                        ? "bg-orange-500 text-white"
                        : inMonth
                          ? "text-slate-200"
                          : "text-slate-600"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="truncate rounded-md border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] leading-tight text-orange-100"
                        title={ev.title}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="text-[10px] text-slate-500">+{dayEvents.length - 3} more</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected day</p>
            <h3 className="mt-1 font-display text-xl text-white">
              {selected.toLocaleDateString("en-ZA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            <button
              type="button"
              onClick={() => openComposerForDay(selected)}
              className="mt-4 w-full rounded-lg border border-dashed border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:border-orange-500/40 hover:text-orange-200"
            >
              Schedule on this day
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Agenda ({selectedEvents.length})
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-sm leading-relaxed text-slate-500">
                Nothing scheduled. Double-click a day on the grid to draft an event.
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedEvents.map((ev) => {
                  const start = new Date(ev.startsAt);
                  const end = new Date(ev.endsAt);
                  return (
                    <li key={ev.id} className="rounded-xl border border-white/8 bg-slate-950/50 p-3">
                      <p className="font-medium text-white">{ev.title}</p>
                      <p className="mt-1 text-xs tabular-nums text-orange-200/90">
                        {ev.allDay
                          ? "All day"
                          : `${start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`}
                      </p>
                      {ev.description ? (
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{ev.description}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {composerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg text-white">New calendar event</h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50"
                  placeholder="Board review / content freeze / investor sync"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Starts</span>
                  <input
                    required
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">Ends</span>
                  <input
                    required
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Notes</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50"
                  placeholder="Optional context for the executive team"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Add to calendar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
