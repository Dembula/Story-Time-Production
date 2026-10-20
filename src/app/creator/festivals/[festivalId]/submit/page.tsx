"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type CreditPerson = { firstName: string; middleName: string; lastName: string; characterName?: string; priorCredits?: string };

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

  const { data } = useQuery({
    queryKey: ["creator-festival", festivalId],
    queryFn: () => fetch(`/api/creator/festivals/${festivalId}`).then((r) => r.json()),
  });
  const festival = data?.festival;

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

  if (!festival) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!festival.acceptingSubmissions) {
    return <p className="text-sm text-slate-400">This festival is not accepting submissions.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Submit to {festival.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Dedicated festival entry — paid via Story Time (PayFast).</p>
      </div>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`h-1 flex-1 rounded-full ${step >= n ? "bg-amber-500" : "bg-slate-800"}`} />
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <label className="block text-sm text-slate-300">
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <input value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="Logline" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="Synopsis" rows={5} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Contact</h2>
          <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Directors</h2>
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
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
              <input
                value={d.middleName}
                onChange={(e) => {
                  const next = [...directors];
                  next[i] = { ...d, middleName: e.target.value };
                  setDirectors(next);
                }}
                placeholder="Middle"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
              <input
                value={d.lastName}
                onChange={(e) => {
                  const next = [...directors];
                  next[i] = { ...d, lastName: e.target.value };
                  setDirectors(next);
                }}
                placeholder="Last"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDirectors((d) => [...d, { firstName: "", middleName: "", lastName: "" }])}
            className="text-sm text-amber-200"
          >
            + Add a person
          </button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Specifications</h2>
          <div className="flex flex-wrap gap-2">
            {["Short", "Feature", "Documentary", "Animation", "Student"].map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={projectTypes.includes(t)}
                  onChange={(e) =>
                    setProjectTypes((prev) =>
                      e.target.checked ? [...prev, t] : prev.filter((x) => x !== t),
                    )
                  }
                />
                {t}
              </label>
            ))}
          </div>
          <input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Genres (e.g. Horror, Drama)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <input value={runtimeMinutes} onChange={(e) => setRuntimeMinutes(e.target.value)} placeholder="Runtime (minutes)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Media & Universe opt-in</h2>
          <input value={screenerUrl} onChange={(e) => setScreenerUrl(e.target.value)} placeholder="Screener URL" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <input value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} placeholder="Trailer URL (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <input value={stillUrl} onChange={(e) => setStillUrl(e.target.value)} placeholder="Still / poster URL (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={universeOptIn}
              onChange={(e) => setUniverseOptIn(e.target.checked)}
              className="mt-1"
            />
            <span>
              After this festival ends, consider my film for Story Time Universe.
              <span className="mt-1 block text-xs text-slate-500">
                The film still goes to the festival. It will appear in Story Time admin review but stay blocked until the festival is marked ended.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
        >
          Back
        </button>
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
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => submit()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Pay & submit"}
          </button>
        )}
      </div>
    </div>
  );
}
