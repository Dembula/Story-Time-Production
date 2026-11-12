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

function toExternalHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `https://${value.replace(/^\/+/, "")}`;
}

function formatZar(amount: number | null | undefined): string {
  return `R${Number(amount ?? 0).toFixed(0)}`;
}

function SocialChip({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-orange-100 transition hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-50"
    >
      {label}
      <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
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
            <p className="mt-1 text-xs text-slate-500">
              All submission stages shown. Current tier:{" "}
              <span className="font-semibold uppercase tracking-wide text-orange-200/90">
                {f.currentTier}
              </span>
            </p>
            <ul className="mt-3 divide-y divide-white/8">
              {(f.categories ?? []).map((c: {
                id: string;
                name: string;
                description?: string | null;
                earlybirdFeeZar?: number;
                regularFeeZar?: number;
                lateFeeZar?: number;
                currentFeeZar: number;
              }) => (
                <li key={c.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{c.name}</p>
                      {c.description ? <p className="text-xs text-slate-500">{c.description}</p> : null}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-orange-200">
                      Now {formatZar(c.currentFeeZar)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div
                      className={`rounded-lg border px-2 py-1.5 ${
                        f.currentTier === "earlybird"
                          ? "border-orange-400/40 bg-orange-500/10 text-orange-100"
                          : "border-white/8 bg-white/[0.02] text-slate-400"
                      }`}
                    >
                      <p className="uppercase tracking-wide opacity-80">Early</p>
                      <p className="mt-0.5 text-sm font-semibold text-white">{formatZar(c.earlybirdFeeZar)}</p>
                    </div>
                    <div
                      className={`rounded-lg border px-2 py-1.5 ${
                        f.currentTier === "regular"
                          ? "border-orange-400/40 bg-orange-500/10 text-orange-100"
                          : "border-white/8 bg-white/[0.02] text-slate-400"
                      }`}
                    >
                      <p className="uppercase tracking-wide opacity-80">Regular</p>
                      <p className="mt-0.5 text-sm font-semibold text-white">{formatZar(c.regularFeeZar)}</p>
                    </div>
                    <div
                      className={`rounded-lg border px-2 py-1.5 ${
                        f.currentTier === "late"
                          ? "border-orange-400/40 bg-orange-500/10 text-orange-100"
                          : "border-white/8 bg-white/[0.02] text-slate-400"
                      }`}
                    >
                      <p className="uppercase tracking-wide opacity-80">Late</p>
                      <p className="mt-0.5 text-sm font-semibold text-white">{formatZar(c.lateFeeZar)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 text-sm text-slate-300">
            <h2 className="font-display text-lg font-semibold text-white">Contact & socials</h2>
            <ul className="mt-3 space-y-1.5">
              {f.contactEmail ? <li>{f.contactEmail}</li> : null}
              {f.contactPhone ? <li>{f.contactPhone}</li> : null}
              {f.organizers ? <li className="text-slate-500">Organizers: {f.organizers}</li> : null}
            </ul>
            {(() => {
              const socials = [
                { label: "Website", href: toExternalHref(f.websiteUrl) },
                { label: "Instagram", href: toExternalHref(f.instagramUrl) },
                { label: "TikTok", href: toExternalHref(f.tiktokUrl) },
                { label: "Facebook", href: toExternalHref(f.facebookUrl) },
                { label: "X / Twitter", href: toExternalHref(f.twitterUrl) },
              ].filter((s): s is { label: string; href: string } => Boolean(s.href));
              if (socials.length === 0) {
                return <p className="mt-3 text-xs text-slate-500">No social links added yet.</p>;
              }
              return (
                <div className="mt-4 flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <SocialChip key={s.label} label={s.label} href={s.href} />
                  ))}
                </div>
              );
            })()}
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
