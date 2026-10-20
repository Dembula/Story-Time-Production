"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, Film } from "lucide-react";
import {
  FestivalBrowseShell,
  FestivalEmptyState,
} from "@/components/creator/festival-browse-ui";

function TimelineRow({ label, date, active }: { label: string; date?: string | null; active?: boolean }) {
  if (!date) return null;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ring-4 ${
            active ? "bg-orange-400 ring-orange-400/20" : "bg-slate-600 ring-transparent"
          }`}
        />
        <span className="w-px flex-1 bg-white/10" />
      </div>
      <div className="pb-5">
        <p className={`text-sm ${active ? "font-semibold text-orange-200" : "text-white"}`}>{label}</p>
        <p className="text-xs text-slate-500">{new Date(date).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

export default function CreatorFestivalDetailPage() {
  const params = useParams();
  const festivalId = String(params.festivalId);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival", festivalId],
    queryFn: () => fetch(`/api/creator/festivals/${festivalId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <FestivalBrowseShell>
        <div className="h-72 animate-pulse rounded-3xl border border-white/8 bg-white/[0.03]" />
      </FestivalBrowseShell>
    );
  }

  const f = data?.festival;
  if (!f) {
    return (
      <FestivalBrowseShell>
        <FestivalEmptyState title="Festival not found" href="/creator/festivals" actionLabel="Browse festivals" />
      </FestivalBrowseShell>
    );
  }

  return (
    <FestivalBrowseShell>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-panel">
        <div className="relative aspect-[21/9] min-h-[220px] bg-slate-900">
          {f.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.headerImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.28),_transparent_55%)]">
              <Film className="h-10 w-10 text-orange-300/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            <div className="flex items-end gap-4">
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.logoUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl border border-white/25 object-cover shadow-xl md:h-20 md:w-20"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90">
                  {f.yearsRunning} years · {f.acceptingSubmissions ? "Open for entries" : "Closed"}
                </p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {f.name}
                </h1>
                {f.tagline ? <p className="mt-1 text-sm text-slate-300 md:text-base">{f.tagline}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          {f.about ? (
            <section className="cinematic-glass rounded-3xl border border-white/8 p-5 shadow-panel md:p-6">
              <h2 className="font-display text-lg font-semibold text-white">About</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{f.about}</p>
            </section>
          ) : null}

          {(f.mediaAssets ?? []).length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-white">From previous events</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {f.mediaAssets.map((m: { id: string; url: string; kind: string }) =>
                  m.kind === "VIDEO" ? (
                    <video key={m.id} src={m.url} className="aspect-video rounded-2xl object-cover" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={m.url} alt="" className="aspect-video rounded-2xl object-cover" />
                  ),
                )}
              </div>
            </section>
          ) : null}

          {f.awardsText ? (
            <section className="cinematic-glass rounded-3xl border border-white/8 p-5 shadow-panel">
              <h2 className="font-display text-lg font-semibold text-white">Awards & prizes</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{f.awardsText}</p>
            </section>
          ) : null}

          {f.rulesText ? (
            <section className="cinematic-glass rounded-3xl border border-white/8 p-5 shadow-panel">
              <h2 className="font-display text-lg font-semibold text-white">Rules</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{f.rulesText}</p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="cinematic-glass rounded-3xl border border-white/8 p-5 shadow-panel">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-orange-300" />
              <h2 className="font-display text-lg font-semibold text-white">Dates</h2>
            </div>
            <TimelineRow label="Opening" date={f.openingAt} />
            <TimelineRow label="Earlybird" date={f.earlybirdAt} active={f.currentTier === "earlybird"} />
            <TimelineRow label="Regular" date={f.regularAt} active={f.currentTier === "regular"} />
            <TimelineRow label="Late" date={f.lateAt} active={f.currentTier === "late"} />
            <TimelineRow label="Notification" date={f.notificationAt} />
            <TimelineRow label="Event" date={f.eventStartsAt} />
          </section>

          <section className="cinematic-glass rounded-3xl border border-white/8 p-5 shadow-panel">
            <h2 className="font-display text-lg font-semibold text-white">Categories & fees</h2>
            <ul className="mt-3 divide-y divide-white/8">
              {(f.categories ?? []).map((c: {
                id: string;
                name: string;
                description?: string | null;
                currentFeeZar: number;
              }) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    {c.description ? <p className="text-xs text-slate-500">{c.description}</p> : null}
                  </div>
                  <p className="text-sm font-semibold text-orange-200">
                    R{Number(c.currentFeeZar).toFixed(0)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
              Current tier: {f.currentTier}
            </p>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 text-sm text-slate-300">
            <h2 className="font-display text-lg font-semibold text-white">Contact</h2>
            <ul className="mt-3 space-y-1.5">
              {f.contactEmail ? <li>{f.contactEmail}</li> : null}
              {f.contactPhone ? <li>{f.contactPhone}</li> : null}
              {f.websiteUrl ? (
                <li>
                  <a className="inline-flex items-center gap-1 text-orange-200 hover:underline" href={f.websiteUrl} target="_blank" rel="noreferrer">
                    Website <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ) : null}
              {f.organizers ? <li className="text-slate-500">Organizers: {f.organizers}</li> : null}
            </ul>
          </section>

          {f.acceptingSubmissions ? (
            <Link
              href={`/creator/festivals/${f.id}/submit`}
              className="flex w-full items-center justify-center rounded-2xl bg-orange-500 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_40px_-12px_rgba(249,115,22,0.8)] transition hover:bg-orange-400"
            >
              Submit your film
            </Link>
          ) : (
            <p className="rounded-2xl border border-white/10 py-3.5 text-center text-sm text-slate-400">
              Submissions closed
            </p>
          )}
        </aside>
      </div>
    </FestivalBrowseShell>
  );
}
