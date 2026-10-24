"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
};

const emptyUpload = (): UploadSlot => ({
  uploading: false,
  progress: null,
  done: false,
  error: null,
});

const PROJECT_TYPES = [
  "Short",
  "Feature",
  "Documentary",
  "Animation",
  "Student",
  "Experimental",
  "Music video",
  "Series / episode",
];

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
  "Other",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function peopleFrom(value: unknown, fallbackRole: string): CreditPerson[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ firstName: "", middleName: "", lastName: "", email: "", role: fallbackRole }];
  }
  return value.map((p) => {
    const row = asRecord(p) ?? {};
    return {
      firstName: str(row.firstName),
      middleName: str(row.middleName),
      lastName: str(row.lastName),
      email: str(row.email),
      role: str(row.role) || fallbackRole,
    };
  });
}

export default function EditFestivalSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = String(params.submissionId);
  const field = festivalFieldClassName();
  const area = festivalTextareaClassName();

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [logline, setLogline] = useState("");
  const [synopsis, setSynopsis] = useState("");
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
  const [keyCast, setKeyCast] = useState("");
  const [productionCompany, setProductionCompany] = useState("");
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [runtimeMinutes, setRuntimeMinutes] = useState("");
  const [originalLanguage, setOriginalLanguage] = useState("English");
  const [premiereStatus, setPremiereStatus] = useState("World premiere");
  const [contentWarnings, setContentWarnings] = useState("");
  const [screenerUrl, setScreenerUrl] = useState("");
  const [screenerPassword, setScreenerPassword] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [stillUrls, setStillUrls] = useState<string[]>([]);
  const [universeOptIn, setUniverseOptIn] = useState(false);
  const [screenerUpload, setScreenerUpload] = useState<UploadSlot>(emptyUpload);
  const [trailerUpload, setTrailerUpload] = useState<UploadSlot>(emptyUpload);
  const [posterUpload, setPosterUpload] = useState<UploadSlot>(emptyUpload);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival-submission", submissionId],
    queryFn: () => fetch(`/api/creator/festivals/submissions/${submissionId}`).then((r) => r.json()),
  });

  const { data: festivalData } = useQuery({
    queryKey: ["creator-festival", data?.submission?.festivalId],
    queryFn: () =>
      fetch(`/api/creator/festivals/${data.submission.festivalId}`).then((r) => r.json()),
    enabled: Boolean(data?.submission?.festivalId),
  });

  useEffect(() => {
    if (!data?.submission || hydrated) return;
    const s = data.submission;
    const payload = asRecord(s.formPayload) ?? {};
    const contact = asRecord(payload.contact) ?? {};
    const credits = asRecord(payload.credits) ?? {};
    const specs = asRecord(payload.specifications) ?? {};

    setTitle(s.title || "");
    setCategoryId(s.categoryId || "");
    setLogline(s.logline || "");
    setSynopsis(s.synopsis || "");
    setContactName(str(contact.name));
    setContactEmail(str(contact.email));
    setContactPhone(str(contact.phone));
    setContactAltPhone(str(contact.altPhone));
    setCompany(str(contact.company));
    setWebsite(str(contact.website));
    setStreet(str(contact.street));
    setCity(str(contact.city));
    setProvince(str(contact.province));
    setPostalCode(str(contact.postalCode));
    setCountry(str(contact.country) || "South Africa");
    setDirectors(peopleFrom(credits.directors, "Director"));
    setProducers(peopleFrom(credits.producers, "Producer"));
    setKeyCast(str(credits.keyCast));
    setProductionCompany(str(credits.productionCompany));
    setProjectTypes(Array.isArray(specs.projectTypes) ? specs.projectTypes.map(str) : []);
    setGenres(
      Array.isArray(specs.genres)
        ? specs.genres.map(str)
        : str(specs.genres)
          ? str(specs.genres)
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : [],
    );
    setRuntimeMinutes(specs.runtimeMinutes != null ? str(specs.runtimeMinutes) : "");
    setOriginalLanguage(str(specs.originalLanguage) || "English");
    setPremiereStatus(str(specs.premiereStatus) || "World premiere");
    setContentWarnings(str(specs.contentWarnings));
    setScreenerUrl(s.screenerUrl || "");
    setScreenerPassword(str(specs.screenerPassword));
    setTrailerUrl(s.trailerUrl || "");
    setPosterUrl(str(specs.posterUrl));
    setStillUrls(Array.isArray(s.stillUrls) ? s.stillUrls.filter((u: unknown) => typeof u === "string") : []);
    setUniverseOptIn(Boolean(s.universeOptIn));
    setHydrated(true);
  }, [data, hydrated]);

  async function uploadMedia(
    file: File,
    setSlot: (updater: (prev: UploadSlot) => UploadSlot) => void,
    onDone: (url: string) => void,
  ) {
    setSlot(() => ({ uploading: true, progress: 0, done: false, error: null }));
    try {
      const payload = await uploadContentMediaViaApiFull(file, {
        onProgress: (pct) => setSlot((prev) => ({ ...prev, uploading: true, progress: pct })),
      });
      const url = preferredStorageReference(payload, { preferPublicUrl: true });
      if (!url) throw new Error("Upload did not return a URL");
      onDone(url);
      setSlot(() => ({ uploading: false, progress: 100, done: true, error: null }));
    } catch (e) {
      setSlot(() => ({
        uploading: false,
        progress: null,
        done: false,
        error: e instanceof Error ? e.message : "Upload failed",
      }));
    }
  }

  function toggleChip(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function save(andPay: boolean) {
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!contactEmail.includes("@") || !contactPhone.trim()) {
      setError("Contact email and phone are required.");
      return;
    }
    if (!screenerUrl.trim()) {
      setError("Screener file or URL is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/creator/festivals/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          title,
          logline,
          synopsis,
          screenerUrl,
          trailerUrl: trailerUrl || null,
          stillUrls: [...(posterUrl ? [posterUrl] : []), ...stillUrls].filter(Boolean),
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
            keyCast: keyCast.trim() || null,
            productionCompany: productionCompany.trim() || null,
          },
          specifications: {
            projectTypes,
            genres,
            runtimeMinutes: Number(runtimeMinutes) || null,
            originalLanguage,
            premiereStatus,
            contentWarnings: contentWarnings.trim() || null,
            screenerPassword: screenerPassword.trim() || null,
            posterUrl: posterUrl || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save");

      if (andPay) {
        const payRes = await fetch(`/api/creator/festivals/submissions/${submissionId}/pay`, {
          method: "POST",
        });
        const payJson = await payRes.json();
        if (!payRes.ok) throw new Error(payJson.error || "Could not start payment");
        if (payJson.requiresPayment && payJson.checkoutUrl) {
          window.location.href = payJson.checkoutUrl;
          return;
        }
      }
      router.push("/creator/festivals/submissions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <FestivalBrowseShell>
        <div className="h-64 animate-pulse rounded-3xl border border-white/8 bg-white/[0.03]" />
      </FestivalBrowseShell>
    );
  }

  if (!data?.submission) {
    return (
      <FestivalBrowseShell>
        <FestivalEmptyState
          title="Submission not found"
          body="This entry may have been removed."
          href="/creator/festivals/submissions"
          actionLabel="My submissions"
        />
      </FestivalBrowseShell>
    );
  }

  if (!data.editable) {
    return (
      <FestivalBrowseShell>
        <FestivalEmptyState
          title="Editing locked"
          body="This submission is already paid. Contact the festival if you need changes."
          href="/creator/festivals/submissions"
          actionLabel="Back to submissions"
        />
      </FestivalBrowseShell>
    );
  }

  const festival = festivalData?.festival ?? data.submission.festival;
  const categories = festival?.categories ?? (data.submission.category ? [data.submission.category] : []);

  return (
    <FestivalBrowseShell>
      <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-black/40 to-transparent p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
          Incomplete entry
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
          Edit submission
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          {festival?.name || "Festival"} · Fix details, then complete payment when ready.
        </p>
      </div>

      <div className="cinematic-glass space-y-8 rounded-3xl border border-white/8 p-5 shadow-panel md:p-7">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Project</h2>
          <label className="block text-sm text-slate-300">
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
              {categories.map((c: { id: string; name: string; currentFeeZar?: number }) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.currentFeeZar != null ? ` — R${Number(c.currentFeeZar).toFixed(2)}` : ""}
                </option>
              ))}
            </select>
          </label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={field} />
          <input value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="Logline" className={field} />
          <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={5} placeholder="Synopsis" className={area} />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name *" className={field} />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email *" className={field} />
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone *" className={field} />
            <input value={contactAltPhone} onChange={(e) => setContactAltPhone(e.target.value)} placeholder="Alt phone" className={field} />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className={field} />
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" className={field} />
          </div>
          <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street" className={field} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={field} />
            <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Province" className={field} />
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" className={field} />
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className={field} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Credits</h2>
          {directors.map((d, i) => (
            <div key={`d-${i}`} className="grid gap-2 sm:grid-cols-3">
              <input
                value={d.firstName}
                onChange={(e) => {
                  const next = [...directors];
                  next[i] = { ...d, firstName: e.target.value };
                  setDirectors(next);
                }}
                placeholder="Director first"
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
          <input
            value={productionCompany}
            onChange={(e) => setProductionCompany(e.target.value)}
            placeholder="Production company"
            className={field}
          />
          <textarea value={keyCast} onChange={(e) => setKeyCast(e.target.value)} rows={2} placeholder="Key cast" className={area} />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Specs</h2>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES.map((t) => {
              const on = projectTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleChip(projectTypes, t, setProjectTypes)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    on ? "bg-orange-500 text-slate-950" : "border border-white/12 text-slate-300"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((g) => {
              const on = genres.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleChip(genres, g, setGenres)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    on ? "bg-orange-500 text-slate-950" : "border border-white/12 text-slate-300"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={runtimeMinutes}
              onChange={(e) => setRuntimeMinutes(e.target.value)}
              placeholder="Runtime (minutes)"
              className={field}
            />
            <input
              value={originalLanguage}
              onChange={(e) => setOriginalLanguage(e.target.value)}
              placeholder="Language"
              className={field}
            />
          </div>
          <input
            value={premiereStatus}
            onChange={(e) => setPremiereStatus(e.target.value)}
            placeholder="Premiere status"
            className={field}
          />
          <textarea
            value={contentWarnings}
            onChange={(e) => setContentWarnings(e.target.value)}
            rows={2}
            placeholder="Content warnings"
            className={area}
          />
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Media</h2>
          <MediaDropzone
            label="Screener *"
            accept="video/*"
            uploading={screenerUpload.uploading}
            progress={screenerUpload.progress}
            done={screenerUpload.done || Boolean(screenerUrl)}
            error={screenerUpload.error}
            onFile={(file) => void uploadMedia(file, setScreenerUpload, setScreenerUrl)}
            onClear={() => {
              setScreenerUrl("");
              setScreenerUpload(emptyUpload());
            }}
          />
          <input
            value={screenerUrl}
            onChange={(e) => setScreenerUrl(e.target.value)}
            placeholder="Or paste screener URL"
            className={field}
          />
          <input
            value={screenerPassword}
            onChange={(e) => setScreenerPassword(e.target.value)}
            placeholder="Screener password"
            className={field}
          />
          <MediaDropzone
            label="Trailer"
            accept="video/*"
            uploading={trailerUpload.uploading}
            progress={trailerUpload.progress}
            done={trailerUpload.done || Boolean(trailerUrl)}
            error={trailerUpload.error}
            onFile={(file) => void uploadMedia(file, setTrailerUpload, setTrailerUrl)}
            onClear={() => {
              setTrailerUrl("");
              setTrailerUpload(emptyUpload());
            }}
          />
          <MediaDropzone
            label="Poster"
            accept="image/*"
            uploading={posterUpload.uploading}
            progress={posterUpload.progress}
            done={posterUpload.done || Boolean(posterUrl)}
            error={posterUpload.error}
            onFile={(file) => void uploadMedia(file, setPosterUpload, setPosterUrl)}
            onClear={() => {
              setPosterUrl("");
              setPosterUpload(emptyUpload());
            }}
          />
          <label className="flex items-start gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] p-4 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={universeOptIn}
              onChange={(e) => setUniverseOptIn(e.target.checked)}
              className="mt-1"
            />
            <span>After this festival ends, consider my film for Story Time Universe.</span>
          </label>
        </section>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5">
          <Link
            href="/creator/festivals/submissions"
            className="rounded-xl border border-white/12 px-4 py-2.5 text-sm text-slate-300"
          >
            Cancel
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white hover:border-orange-400/40 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(true)}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
            >
              {saving ? "Working…" : "Save & pay"}
            </button>
          </div>
        </div>
      </div>
    </FestivalBrowseShell>
  );
}
