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
import { MediaDropzone } from "@/components/ecosystem/media-dropzone";
import {
  preferredStorageReference,
  uploadContentMediaViaApiFull,
} from "@/lib/upload-content-media-client";

type CreditPerson = {
  firstName: string;
  middleName: string;
  lastName: string;
  email?: string;
  role?: string;
};

type UploadSlot = {
  uploading: boolean;
  progress: number | null;
  done: boolean;
  error: string | null;
  fileName?: string;
};

const emptyUpload = (): UploadSlot => ({
  uploading: false,
  progress: null,
  done: false,
  error: null,
});

const STEPS = [
  { id: 1, label: "Project" },
  { id: 2, label: "Contact" },
  { id: 3, label: "Credits" },
  { id: 4, label: "Specs" },
  { id: 5, label: "Media & pay" },
] as const;

const PROJECT_TYPES = [
  "Short",
  "Feature",
  "Documentary",
  "Animation",
  "Student",
  "Experimental",
  "Music video",
  "Series / episode",
] as const;

const GENRE_OPTIONS = [
  "Drama",
  "Comedy",
  "Horror",
  "Thriller",
  "Romance",
  "Sci-Fi",
  "Fantasy",
  "Action",
  "Adventure",
  "Crime",
  "Mystery",
  "Documentary",
  "Family",
  "Animation",
  "Historical",
  "War",
  "Western",
  "Musical",
  "Biography",
  "Other",
] as const;

const LANGUAGE_OPTIONS = [
  "English",
  "Afrikaans",
  "isiZulu",
  "isiXhosa",
  "Sesotho",
  "Setswana",
  "Sepedi",
  "Xitsonga",
  "siSwati",
  "Tshivenda",
  "isiNdebele",
  "French",
  "Portuguese",
  "Other",
] as const;

const ASPECT_RATIOS = ["16:9", "2.39:1", "1.85:1", "4:3", "9:16", "Other"] as const;
const FRAME_RATES = ["23.976", "24", "25", "29.97", "30", "50", "60"] as const;
const SOUND_MIXES = ["Stereo", "5.1", "Atmos", "Mono", "Other"] as const;

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
  const [productionYear, setProductionYear] = useState(String(new Date().getFullYear()));
  const [originalLanguage, setOriginalLanguage] = useState("English");
  const [subtitleLanguages, setSubtitleLanguages] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAltPhone, setContactAltPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("South Africa");

  const [directors, setDirectors] = useState<CreditPerson[]>([
    { firstName: "", middleName: "", lastName: "", email: "", role: "Director" },
  ]);
  const [producers, setProducers] = useState<CreditPerson[]>([
    { firstName: "", middleName: "", lastName: "", email: "", role: "Producer" },
  ]);
  const [writers, setWriters] = useState<CreditPerson[]>([]);
  const [keyCast, setKeyCast] = useState("");
  const [productionCompany, setProductionCompany] = useState("");

  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("South Africa");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [frameRate, setFrameRate] = useState("24");
  const [soundMix, setSoundMix] = useState("Stereo");
  const [shootingFormat, setShootingFormat] = useState("");
  const [colourBw, setColourBw] = useState<"Colour" | "Black & white" | "Mixed">("Colour");
  const [premiereStatus, setPremiereStatus] = useState("World premiere");
  const [previousFestivals, setPreviousFestivals] = useState("");
  const [contentWarnings, setContentWarnings] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [aiNotes, setAiNotes] = useState("");

  const [screenerUrl, setScreenerUrl] = useState("");
  const [screenerPassword, setScreenerPassword] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [stillUrls, setStillUrls] = useState<string[]>([]);
  const [posterUrl, setPosterUrl] = useState("");
  const [pressKitUrl, setPressKitUrl] = useState("");
  const [universeOptIn, setUniverseOptIn] = useState(false);

  const [screenerUpload, setScreenerUpload] = useState<UploadSlot>(emptyUpload);
  const [trailerUpload, setTrailerUpload] = useState<UploadSlot>(emptyUpload);
  const [posterUpload, setPosterUpload] = useState<UploadSlot>(emptyUpload);
  const [stillUpload, setStillUpload] = useState<UploadSlot>(emptyUpload);
  const [pressKitUpload, setPressKitUpload] = useState<UploadSlot>(emptyUpload);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival", festivalId],
    queryFn: () => fetch(`/api/creator/festivals/${festivalId}`).then((r) => r.json()),
  });
  const festival = data?.festival;

  const selectedCategory = useMemo(
    () => (festival?.categories ?? []).find((c: { id: string }) => c.id === categoryId) ?? null,
    [festival?.categories, categoryId],
  );

  async function uploadMedia(
    file: File,
    setSlot: (updater: (prev: UploadSlot) => UploadSlot) => void,
    onDone: (url: string) => void,
  ) {
    setSlot(() => ({
      uploading: true,
      progress: 0,
      done: false,
      error: null,
      fileName: file.name,
    }));
    try {
      const payload = await uploadContentMediaViaApiFull(file, {
        onProgress: (pct) =>
          setSlot((prev) => ({ ...prev, uploading: true, progress: pct, error: null })),
      });
      const url = preferredStorageReference(payload, { preferPublicUrl: true });
      if (!url) throw new Error("Upload did not return a URL");
      onDone(url);
      setSlot(() => ({
        uploading: false,
        progress: 100,
        done: true,
        error: null,
        fileName: file.name,
      }));
    } catch (e) {
      setSlot(() => ({
        uploading: false,
        progress: null,
        done: false,
        error: e instanceof Error ? e.message : "Upload failed",
        fileName: file.name,
      }));
    }
  }

  function toggleChip(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!title.trim() || !categoryId) return "Title and category are required.";
      if (!logline.trim()) return "Please add a logline.";
      if (!synopsis.trim()) return "Please add a synopsis.";
    }
    if (current === 2) {
      if (!contactName.trim()) return "Contact name is required.";
      if (!contactEmail.trim() || !contactEmail.includes("@")) return "A valid contact email is required.";
      if (!contactPhone.trim()) return "Phone number is required.";
      if (!city.trim() || !country.trim()) return "City and country are required.";
    }
    if (current === 3) {
      const hasDirector = directors.some((d) => d.firstName.trim() && d.lastName.trim());
      if (!hasDirector) return "At least one director (first and last name) is required.";
    }
    if (current === 4) {
      if (projectTypes.length === 0) return "Select at least one project type.";
      if (genres.length === 0) return "Select at least one genre.";
      if (!runtimeMinutes.trim() || Number(runtimeMinutes) <= 0) {
        return "Enter a valid runtime in minutes.";
      }
    }
    if (current === 5) {
      if (!screenerUrl.trim()) return "Upload a screener file or paste a screener URL.";
    }
    return null;
  }

  async function submit() {
    const stepError = validateStep(5);
    if (stepError) {
      setError(stepError);
      return;
    }
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
          trailerUrl: trailerUrl || null,
          stillUrls: [
            ...(posterUrl ? [posterUrl] : []),
            ...stillUrls,
          ].filter(Boolean),
          universeOptIn,
          contact: {
            name: contactName.trim(),
            email: contactEmail.trim(),
            phone: contactPhone.trim(),
            altPhone: contactAltPhone.trim() || null,
            company: company.trim() || null,
            website: website.trim() || null,
            street: street.trim() || null,
            city: city.trim(),
            province: province.trim() || null,
            postalCode: postalCode.trim() || null,
            country: country.trim(),
          },
          credits: {
            directors,
            producers,
            writers,
            keyCast: keyCast.trim() || null,
            productionCompany: productionCompany.trim() || null,
          },
          specifications: {
            projectTypes,
            genres,
            runtimeMinutes: Number(runtimeMinutes) || null,
            productionYear: productionYear.trim() || null,
            originalLanguage,
            subtitleLanguages: subtitleLanguages.trim() || null,
            completionDate: completionDate || null,
            countryOfOrigin,
            aspectRatio,
            frameRate,
            soundMix,
            shootingFormat: shootingFormat.trim() || null,
            colourBw,
            premiereStatus,
            previousFestivals: previousFestivals.trim() || null,
            contentWarnings: contentWarnings.trim() || null,
            aiUsed,
            aiNotes: aiUsed ? aiNotes.trim() || null : null,
            screenerPassword: screenerPassword.trim() || null,
            pressKitUrl: pressKitUrl || null,
            posterUrl: posterUrl || null,
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

  function renderPeopleEditor(
    label: string,
    people: CreditPerson[],
    setPeople: (next: CreditPerson[]) => void,
    defaultRole: string,
  ) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {people.map((d, i) => (
          <div key={`${label}-${i}`} className="space-y-2 rounded-2xl border border-white/8 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={d.firstName}
                onChange={(e) => {
                  const next = [...people];
                  next[i] = { ...d, firstName: e.target.value };
                  setPeople(next);
                }}
                placeholder="First"
                className={field}
              />
              <input
                value={d.middleName}
                onChange={(e) => {
                  const next = [...people];
                  next[i] = { ...d, middleName: e.target.value };
                  setPeople(next);
                }}
                placeholder="Middle"
                className={field}
              />
              <input
                value={d.lastName}
                onChange={(e) => {
                  const next = [...people];
                  next[i] = { ...d, lastName: e.target.value };
                  setPeople(next);
                }}
                placeholder="Last"
                className={field}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={d.email ?? ""}
                onChange={(e) => {
                  const next = [...people];
                  next[i] = { ...d, email: e.target.value };
                  setPeople(next);
                }}
                placeholder="Email (optional)"
                className={field}
              />
              <input
                value={d.role ?? defaultRole}
                onChange={(e) => {
                  const next = [...people];
                  next[i] = { ...d, role: e.target.value };
                  setPeople(next);
                }}
                placeholder="Role"
                className={field}
              />
            </div>
            {people.length > 1 ? (
              <button
                type="button"
                onClick={() => setPeople(people.filter((_, idx) => idx !== i))}
                className="text-xs text-slate-400 hover:text-red-300"
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPeople([
              ...people,
              { firstName: "", middleName: "", lastName: "", email: "", role: defaultRole },
            ])
          }
          className="text-sm font-medium text-orange-200 hover:text-orange-100"
        >
          + Add {defaultRole.toLowerCase()}
        </button>
      </div>
    );
  }

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
              <p className="mt-1 text-sm text-slate-400">Category, title, story, and language.</p>
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
              <input
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                className={field}
                placeholder="One-sentence pitch"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Synopsis
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={6}
                className={area}
                placeholder="Tell the story…"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Production year
                <input
                  value={productionYear}
                  onChange={(e) => setProductionYear(e.target.value)}
                  className={field}
                  placeholder="2026"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Original language
                <select
                  value={originalLanguage}
                  onChange={(e) => setOriginalLanguage(e.target.value)}
                  className={field}
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Subtitle languages (optional)
              <input
                value={subtitleLanguages}
                onChange={(e) => setSubtitleLanguages(e.target.value)}
                className={field}
                placeholder="e.g. English, isiZulu"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Contact</h2>
              <p className="mt-1 text-sm text-slate-400">
                How the festival can reach the submitting filmmaker or company.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Primary contact name *"
                className={field}
              />
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email *"
                type="email"
                className={field}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone / WhatsApp *"
                className={field}
              />
              <input
                value={contactAltPhone}
                onChange={(e) => setContactAltPhone(e.target.value)}
                placeholder="Alternate phone (optional)"
                className={field}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company / production house"
                className={field}
              />
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Website or IMDb"
                className={field}
              />
            </div>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Street address"
              className={field}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City *" className={field} />
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Province / state"
                className={field}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Postal code"
                className={field}
              />
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country *"
                className={field}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Credits</h2>
              <p className="mt-1 text-sm text-slate-400">Key creative team for the entry form.</p>
            </div>
            {renderPeopleEditor("Directors", directors, setDirectors, "Director")}
            {renderPeopleEditor("Producers", producers, setProducers, "Producer")}
            {writers.length > 0 ? (
              renderPeopleEditor("Writers (optional)", writers, setWriters, "Writer")
            ) : (
              <button
                type="button"
                onClick={() =>
                  setWriters([{ firstName: "", middleName: "", lastName: "", email: "", role: "Writer" }])
                }
                className="text-sm font-medium text-orange-200 hover:text-orange-100"
              >
                + Add writer
              </button>
            )}
            <label className="block text-sm text-slate-300">
              Production company
              <input
                value={productionCompany}
                onChange={(e) => setProductionCompany(e.target.value)}
                className={field}
                placeholder="Production company"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Key cast (optional)
              <textarea
                value={keyCast}
                onChange={(e) => setKeyCast(e.target.value)}
                rows={3}
                className={area}
                placeholder="Lead actors / principal cast"
              />
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Specifications</h2>
              <p className="mt-1 text-sm text-slate-400">
                Format, genre, runtime, technical details, and premiere status.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-300">Project type</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TYPES.map((t) => {
                  const on = projectTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleChip(projectTypes, t, setProjectTypes)}
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
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-300">Genres</p>
              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleChip(genres, g, setGenres)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        on
                          ? "bg-orange-500 text-slate-950"
                          : "border border-white/12 text-slate-300 hover:border-orange-400/40"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Runtime (minutes) *
                <input
                  value={runtimeMinutes}
                  onChange={(e) => setRuntimeMinutes(e.target.value)}
                  placeholder="e.g. 20"
                  inputMode="numeric"
                  className={field}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Completion date
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className={field}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                Country of origin
                <input
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Premiere status
                <select
                  value={premiereStatus}
                  onChange={(e) => setPremiereStatus(e.target.value)}
                  className={field}
                >
                  {[
                    "World premiere",
                    "International premiere",
                    "African premiere",
                    "South African premiere",
                    "Online premiere",
                    "Not a premiere",
                  ].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm text-slate-300">
                Aspect ratio
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className={field}>
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Frame rate
                <select value={frameRate} onChange={(e) => setFrameRate(e.target.value)} className={field}>
                  {FRAME_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r} fps
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Sound mix
                <select value={soundMix} onChange={(e) => setSoundMix(e.target.value)} className={field}>
                  {SOUND_MIXES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Colour
                <select
                  value={colourBw}
                  onChange={(e) => setColourBw(e.target.value as typeof colourBw)}
                  className={field}
                >
                  <option value="Colour">Colour</option>
                  <option value="Black & white">Black & white</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              Shooting format / camera
              <input
                value={shootingFormat}
                onChange={(e) => setShootingFormat(e.target.value)}
                className={field}
                placeholder="e.g. ARRI Alexa, Blackmagic, iPhone"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Previous festival screenings (optional)
              <textarea
                value={previousFestivals}
                onChange={(e) => setPreviousFestivals(e.target.value)}
                rows={2}
                className={area}
                placeholder="List prior festivals if any"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Content warnings (optional)
              <textarea
                value={contentWarnings}
                onChange={(e) => setContentWarnings(e.target.value)}
                rows={2}
                className={area}
                placeholder="Violence, language, nudity, etc."
              />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={aiUsed}
                onChange={(e) => setAiUsed(e.target.checked)}
                className="mt-1"
              />
              <span>
                Generative AI was used in this film
                {aiUsed ? (
                  <textarea
                    value={aiNotes}
                    onChange={(e) => setAiNotes(e.target.value)}
                    rows={2}
                    className={`${area} mt-2`}
                    placeholder="Briefly describe how AI was used"
                  />
                ) : null}
              </span>
            </label>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">Media & checkout</h2>
              <p className="mt-1 text-sm text-slate-400">
                Upload your screener (or paste a private link), then pay the festival fee via Story Time.
              </p>
            </div>

            <MediaDropzone
              label="Screener file *"
              hint="MP4 / MOV preferred. Large files upload directly to secure storage."
              accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/*"
              uploading={screenerUpload.uploading}
              progress={screenerUpload.progress}
              done={screenerUpload.done || Boolean(screenerUrl)}
              error={screenerUpload.error}
              onFile={(file) =>
                void uploadMedia(file, setScreenerUpload, (url) => setScreenerUrl(url))
              }
              onClear={() => {
                setScreenerUrl("");
                setScreenerUpload(emptyUpload());
              }}
            >
              {screenerUpload.fileName || screenerUrl ? (
                <p className="mt-2 truncate text-xs text-emerald-300/90">
                  {screenerUpload.fileName || "Screener ready"}
                </p>
              ) : null}
            </MediaDropzone>
            <input
              value={screenerUrl}
              onChange={(e) => {
                setScreenerUrl(e.target.value);
                if (e.target.value.trim()) {
                  setScreenerUpload((p) => ({ ...p, done: true, error: null }));
                }
              }}
              placeholder="Or paste screener URL (Vimeo, Frame.io, Drive…)"
              className={field}
            />
            <input
              value={screenerPassword}
              onChange={(e) => setScreenerPassword(e.target.value)}
              placeholder="Screener password (if required)"
              className={field}
            />

            <MediaDropzone
              label="Trailer (optional)"
              hint="Short promo cut for programmers."
              accept="video/mp4,video/quicktime,video/webm,video/*"
              uploading={trailerUpload.uploading}
              progress={trailerUpload.progress}
              done={trailerUpload.done || Boolean(trailerUrl)}
              error={trailerUpload.error}
              onFile={(file) =>
                void uploadMedia(file, setTrailerUpload, (url) => setTrailerUrl(url))
              }
              onClear={() => {
                setTrailerUrl("");
                setTrailerUpload(emptyUpload());
              }}
            />
            <input
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              placeholder="Or paste trailer URL"
              className={field}
            />

            <MediaDropzone
              label="Poster / key art (optional)"
              accept="image/jpeg,image/png,image/webp,image/*"
              uploading={posterUpload.uploading}
              progress={posterUpload.progress}
              done={posterUpload.done || Boolean(posterUrl)}
              error={posterUpload.error}
              onFile={(file) => void uploadMedia(file, setPosterUpload, (url) => setPosterUrl(url))}
              onClear={() => {
                setPosterUrl("");
                setPosterUpload(emptyUpload());
              }}
            />
            <input
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="Or paste poster URL"
              className={field}
            />

            <MediaDropzone
              label="Still images (optional)"
              hint="Add production stills one at a time."
              accept="image/jpeg,image/png,image/webp,image/*"
              uploading={stillUpload.uploading}
              progress={stillUpload.progress}
              done={stillUrls.length > 0}
              error={stillUpload.error}
              onFile={(file) =>
                void uploadMedia(file, setStillUpload, (url) => {
                  setStillUrls((prev) => [...prev, url]);
                  setStillUpload(emptyUpload());
                })
              }
              onClear={() => {
                setStillUrls([]);
                setStillUpload(emptyUpload());
              }}
            />
            {stillUrls.length > 0 ? (
              <ul className="space-y-1 text-xs text-slate-400">
                {stillUrls.map((u, i) => (
                  <li key={`${u}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">Still {i + 1}</span>
                    <button
                      type="button"
                      className="text-red-300 hover:text-red-200"
                      onClick={() => setStillUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <MediaDropzone
              label="Press kit / PDF (optional)"
              accept="application/pdf,.pdf"
              uploading={pressKitUpload.uploading}
              progress={pressKitUpload.progress}
              done={pressKitUpload.done || Boolean(pressKitUrl)}
              error={pressKitUpload.error}
              onFile={(file) =>
                void uploadMedia(file, setPressKitUpload, (url) => setPressKitUrl(url))
              }
              onClear={() => {
                setPressKitUrl("");
                setPressKitUpload(emptyUpload());
              }}
            />

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
                const msg = validateStep(step);
                if (msg) {
                  setError(msg);
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
              disabled={loading || !screenerUrl || screenerUpload.uploading}
              onClick={() => void submit()}
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
