"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Film } from "lucide-react";
import {
  FestivalBrowseShell,
  FestivalEmptyState,
  festivalFieldClassName,
  festivalTextareaClassName,
} from "@/components/creator/festival-browse-ui";

type CreditPerson = { firstName: string; middleName: string; lastName: string };

const STEPS = [
  { id: 1, label: "Project" },
  { id: 2, label: "Contact" },
  { id: 3, label: "Credits" },
  { id: 4, label: "Specs" },
  { id: 5, label: "Media & pay" },
] as const;

export default function CreatorFestivalSubmitPage() {
  const params = useParams();
  const router = useRouter();
  const festivalId = String(params.festivalId);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [directors, setDirectors] = useState<CreditPerson[]>([{ firstName: "", middleName: "", lastName: "" }]);
  const [genres, setGenres] = useState("");
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [screenerUrl, setScreenerUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [stillUrl, setStillUrl] = useState("");
  const [universeOptIn, setUniverseOptIn] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival", festivalId],
    queryFn: () => fetch(`/api/creator/festivals/${festivalId}`).then((r) => r.json()),
  });
  const festival = data?.festival;

  const selectedCategory = useMemo(
    () => (festival?.categories ?? []).find((c: { id: string }) => c.id === categoryId) ?? null,
    [festival?.categories, categoryId],
  );

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/creator/festivals/${festivalId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          title,
          logline,
          synopsis,
          screenerUrl,
          trailerUrl,
          stillUrls: stillUrl ? [stillUrl] : [],
          universeOptIn,
          contact: { street, city, country },
          credits: { directors },
          specifications: {
            genres,
            runtimeMinutes: Number(runtimeMinutes) || null,
            projectTypes,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submit failed");
      if (json.requiresPayment && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      router.push("/creator/festivals/submissions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setLoading(false);
    }
  }

  if (isLoading || !festival) {
    return (
      <FestivalBrowseShell>
        <div className="h-80 animate-pulse rounded-3xl border border-white/8 bg-white/[0.03]" />
      </FestivalBrowseShell>
    );
  }

  if (!festival.acceptingSubmissions) {
    return (
      <FestivalBrowseShell>
        <FestivalEmptyState
          title="Submissions closed"
          body={`${festival.name} is not accepting entries right now.`}
          href={`/creator/festivals/${festivalId}`}
          actionLabel="Back to festival"
        />
      </FestivalBrowseShell>
    );
  }

  const field = festivalFieldClassName();
  const area = festivalTextareaClassName();

  return (
    <FestivalBrowseShell>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-panel">
        <div className="relative aspect-[21/7] min-h-[160px] bg-slate-900">
          {festival.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={festival.headerImageUrl} alt="" className="h-full w-full object-cover opacity-70" />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.25),_transparent_55%)]">
              <Film className="h-8 w-8 text-orange-300/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90">
              Festival entry
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
              Submit to {festival.name}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Secure checkout with PayFast ·{" "}
              {selectedCategory
                ? `R${Number(selectedCategory.currentFeeZar).toFixed(2)} for ${selectedCategory.name}`
                : "Pick a category to see the fee"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id < step) setStep(s.id);
              }}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-orange-500 text-slate-950"
                  : done
                    ? "bg-orange-500/15 text-orange-100 ring-1 ring-orange-400/25"
                    : "bg-white/[0.04] text-slate-500 ring-1 ring-white/10"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  active || done ? "bg-black/20" : "bg-white/5"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : s.id}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="cinematic-glass rounded-3xl border border-white/8 p-5 shadow-panel md:p-7">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Your project</h2>
              <p className="mt-1 text-sm text-slate-400">Category, title, and story.</p>
            </div>
            <label className="block text-sm text-slate-300">
              Category
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={field}
                required
              >
                <option value="">Select category</option>
                {(festival.categories ?? []).map((c: { id: string; name: string; currentFeeZar: number }) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — R{Number(c.currentFeeZar).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Project title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Title" />
            </label>
            <label className="block text-sm text-slate-300">
              Logline
              <input value={logline} onChange={(e) => setLogline(e.target.value)} className={field} placeholder="One-sentence pitch" />
            </label>
            <label className="block text-sm text-slate-300">
              Synopsis
              <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={6} className={area} placeholder="Tell the story…" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Contact</h2>
              <p className="mt-1 text-sm text-slate-400">Where the festival can reach you.</p>
            </div>
            <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" className={field} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={field} />
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className={field} />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Credits</h2>
              <p className="mt-1 text-sm text-slate-400">Director names for the entry form.</p>
            </div>
            {directors.map((d, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <input
                  value={d.firstName}
                  onChange={(e) => {
                    const next = [...directors];
                    next[i] = { ...d, firstName: e.target.value };
                    setDirectors(next);
                  }}
                  placeholder="First"
                  className={field}
                />
                <input
                  value={d.middleName}
                  onChange={(e) => {
                    const next = [...directors];
                    next[i] = { ...d, middleName: e.target.value };
                    setDirectors(next);
                  }}
                  placeholder="Middle"
                  className={field}
                />
                <input
                  value={d.lastName}
                  onChange={(e) => {
                    const next = [...directors];
                    next[i] = { ...d, lastName: e.target.value };
                    setDirectors(next);
                  }}
                  placeholder="Last"
                  className={field}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDirectors((d) => [...d, { firstName: "", middleName: "", lastName: "" }])}
              className="text-sm font-medium text-orange-200 hover:text-orange-100"
            >
              + Add a person
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Specifications</h2>
              <p className="mt-1 text-sm text-slate-400">Format, genre, runtime.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Short", "Feature", "Documentary", "Animation", "Student"].map((t) => {
                const on = projectTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setProjectTypes((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      on
                        ? "bg-orange-500 text-slate-950"
                        : "border border-white/12 text-slate-300 hover:border-orange-400/40"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Genres (e.g. Horror, Drama)" className={field} />
            <input value={runtimeMinutes} onChange={(e) => setRuntimeMinutes(e.target.value)} placeholder="Runtime (minutes)" className={field} />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Media & checkout</h2>
              <p className="mt-1 text-sm text-slate-400">
                Add your screener, then pay the festival fee via Story Time.
              </p>
            </div>
            <input value={screenerUrl} onChange={(e) => setScreenerUrl(e.target.value)} placeholder="Screener URL" className={field} />
            <input value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} placeholder="Trailer URL (optional)" className={field} />
            <input value={stillUrl} onChange={(e) => setStillUrl(e.target.value)} placeholder="Still / poster URL (optional)" className={field} />
            <label className="flex items-start gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={universeOptIn}
                onChange={(e) => setUniverseOptIn(e.target.checked)}
                className="mt-1"
              />
              <span>
                After this festival ends, consider my film for Story Time Universe.
                <span className="mt-1 block text-xs text-slate-400">
                  Held for admin review until the festival is marked ended.
                </span>
              </span>
            </label>
            {selectedCategory ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                <p className="text-slate-400">Amount due</p>
                <p className="font-display text-2xl font-semibold text-orange-200">
                  R{Number(selectedCategory.currentFeeZar).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">{selectedCategory.name}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5">
          <div className="flex gap-2">
            <Link
              href={`/creator/festivals/${festivalId}`}
              className="rounded-xl border border-white/12 px-4 py-2.5 text-sm text-slate-300 hover:border-white/25"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="rounded-xl border border-white/12 px-4 py-2.5 text-sm text-slate-300 disabled:opacity-40"
            >
              Back
            </button>
          </div>
          {step < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && (!title || !categoryId)) {
                  setError("Title and category are required.");
                  return;
                }
                setError("");
                setStep((s) => s + 1);
              }}
              className="rounded-xl bg-orange-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !screenerUrl}
              onClick={() => submit()}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_36px_-10px_rgba(249,115,22,0.85)] hover:bg-orange-400 disabled:opacity-60"
            >
              {loading ? "Submitting…" : "Pay & submit"}
            </button>
          )}
        </div>
      </div>
    </FestivalBrowseShell>
  );
}
