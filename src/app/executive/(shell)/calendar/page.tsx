"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus } from "lucide-react";
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

type CalendarResponse = {
  events?: CalendarEvent[];
  error?: string;
};

function formatEventRange(startsAt: string, endsAt: string, allDay?: boolean): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (allDay) {
    return start.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  const datePart = start.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  const timePart = `${start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`;
  return `${datePart} · ${timePart}`;
}

export default function ExecutiveCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const data = (await r.json()) as CalendarResponse;
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
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white md:text-3xl">
          <Calendar className="h-6 w-6 text-orange-400" />
          Executive calendar
        </h1>
        <p className="mt-1 text-sm text-slate-400">Leadership meetings, reviews, and platform milestones.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="rounded-xl border border-white/8 bg-slate-900/40 p-5 space-y-4"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4 text-orange-400" />
          New event
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-slate-500">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Starts</span>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Ends</span>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-slate-500">Description (optional)</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 [@media(hover:hover)]:bg-orange-500"
        >
          {submitting ? "Creating…" : "Create event"}
        </button>
      </form>

      <section className="rounded-xl border border-white/8 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Upcoming & recent</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No calendar events yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatEventRange(event.startsAt, event.endsAt, event.allDay)}
                  </p>
                  {event.description ? <p className="mt-2 text-sm text-slate-400">{event.description}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 text-[10px] uppercase tracking-wide">
                  {event.status ? (
                    <span className="rounded border border-white/10 px-2 py-0.5 text-slate-400">{event.status}</span>
                  ) : null}
                  {event.priority ? (
                    <span className="rounded border border-orange-500/20 px-2 py-0.5 text-orange-300">{event.priority}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
