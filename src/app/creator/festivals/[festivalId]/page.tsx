"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

function TimelineRow({ label, date, active }: { label: string; date?: string | null; active?: boolean }) {
  if (!date) return null;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-400" : "bg-slate-600"}`} />
        <span className="w-px flex-1 bg-slate-800" />
      </div>
      <div className="pb-4">
        <p className={`text-sm ${active ? "font-semibold text-emerald-300" : "text-white"}`}>{label}</p>
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

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  const f = data?.festival;
  if (!f) return <p className="text-sm text-red-400">Festival not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800">
        <div className="aspect-[21/9] bg-slate-900">
          {f.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.headerImageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="space-y-2 p-5">
          <div className="flex items-start gap-3">
            {f.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.logoUrl} alt="" className="-mt-10 h-16 w-16 rounded-xl border border-white/20 object-cover" />
            ) : null}
            <div>
              <h1 className="font-display text-2xl font-semibold text-white">{f.name}</h1>
              {f.tagline ? <p className="text-sm text-slate-400">{f.tagline}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{f.yearsRunning} years running · Film festival</p>
            </div>
          </div>
        </div>
      </div>

      {f.about ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">About</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{f.about}</p>
        </section>
      ) : null}

      {(f.mediaAssets ?? []).length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">From previous events</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {f.mediaAssets.map((m: { id: string; url: string; kind: string }) =>
              m.kind === "VIDEO" ? (
                <video key={m.id} src={m.url} className="aspect-video rounded-lg object-cover" controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt="" className="aspect-video rounded-lg object-cover" />
              ),
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Dates & deadlines</h2>
        <TimelineRow label="Opening" date={f.openingAt} />
        <TimelineRow label="Earlybird" date={f.earlybirdAt} active={f.currentTier === "earlybird"} />
        <TimelineRow label="Regular" date={f.regularAt} active={f.currentTier === "regular"} />
        <TimelineRow label="Late" date={f.lateAt} active={f.currentTier === "late"} />
        <TimelineRow label="Notification" date={f.notificationAt} />
        <TimelineRow label="Event" date={f.eventStartsAt} />
      </section>

      <section className="rounded-2xl border border-slate-800 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Categories & fees</h2>
        <ul className="divide-y divide-slate-800">
          {(f.categories ?? []).map((c: { id: string; name: string; description?: string | null; currentFeeZar: number }) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-white">{c.name}</p>
                {c.description ? <p className="text-xs text-slate-500">{c.description}</p> : null}
              </div>
              <p className="text-sm font-semibold text-amber-200">R{Number(c.currentFeeZar).toFixed(2)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">Current deadline tier: {f.currentTier}</p>
      </section>

      {f.awardsText ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Awards & prizes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{f.awardsText}</p>
        </section>
      ) : null}

      {f.rulesText ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">Rules & requirements</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{f.rulesText}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 p-4 text-sm text-slate-300">
        <h2 className="mb-2 text-lg font-semibold text-white">Contact & socials</h2>
        <ul className="space-y-1">
          {f.contactEmail ? <li>Email: {f.contactEmail}</li> : null}
          {f.contactPhone ? <li>Phone: {f.contactPhone}</li> : null}
          {f.websiteUrl ? <li><a className="text-amber-200 underline" href={f.websiteUrl} target="_blank" rel="noreferrer">Website</a></li> : null}
          {f.facebookUrl ? <li><a className="text-amber-200 underline" href={f.facebookUrl} target="_blank" rel="noreferrer">Facebook</a></li> : null}
          {f.twitterUrl ? <li><a className="text-amber-200 underline" href={f.twitterUrl} target="_blank" rel="noreferrer">X</a></li> : null}
          {f.instagramUrl ? <li><a className="text-amber-200 underline" href={f.instagramUrl} target="_blank" rel="noreferrer">Instagram</a></li> : null}
          {f.organizers ? <li>Organizers: {f.organizers}</li> : null}
        </ul>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {f.acceptingSubmissions ? (
          <Link
            href={`/creator/festivals/${f.id}/submit`}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500"
          >
            Submit now
          </Link>
        ) : (
          <p className="rounded-xl border border-slate-700 py-3 text-center text-sm text-slate-400">Submissions closed</p>
        )}
      </div>
    </div>
  );
}
