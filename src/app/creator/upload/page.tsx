"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Upload, Film, Info, Image as ImageIcon, Settings, Users, Music,
  ArrowRight, ArrowLeft, CheckCircle, AlertCircle, Send, Save,
  Clapperboard, Globe, Tag, Clock, Calendar, Star, Tv, Shield, FileText,
} from "lucide-react";

const TYPES = [
  { value: "MOVIE", label: "Movie", icon: Film, desc: "Feature or short film" },
  { value: "SERIES", label: "Series", icon: Tv, desc: "Multi-episode series" },
  { value: "SHOW", label: "Show", icon: Star, desc: "Live show, variety, or reality" },
  { value: "PODCAST", label: "Podcast", icon: Music, desc: "Audio or video podcast" },
];

const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "Horror", "Musical", "Mystery",
  "Romance", "Sci-Fi", "Thriller", "War", "Western", "Afro-Futurism",
  "Township Drama", "Coming-of-Age", "Social Commentary", "Experimental",
];

const LANGUAGES = [
  "English", "isiZulu", "isiXhosa", "Afrikaans", "Sesotho", "Setswana",
  "Sepedi", "Xitsonga", "siSwati", "Tshivenda", "isiNdebele",
  "French", "Portuguese", "Swahili", "Other",
];

const AGE_RATINGS = ["G", "PG", "PG-13", "16", "18", "R"];

const ADVISORY_OPTIONS = [
  { key: "violence", label: "Violence" },
  { key: "language", label: "Strong language" },
  { key: "sex", label: "Sexual content" },
  { key: "nudity", label: "Nudity" },
  { key: "drugs", label: "Drug / substance use" },
  { key: "selfHarm", label: "Self-harm / suicide" },
  { key: "horror", label: "Horror / frightening" },
  { key: "discrimination", label: "Discrimination / hate" },
] as const;

const STEPS = [
  { id: 1, label: "Content Type", icon: Clapperboard },
  { id: 2, label: "Details", icon: Info },
  { id: 3, label: "Media & Assets", icon: ImageIcon },
  { id: 4, label: "Metadata", icon: Settings },
  { id: 5, label: "Cast & Crew", icon: Users },
  { id: 6, label: "Review & Submit", icon: Send },
];

interface CrewEntry { name: string; role: string; }
interface BtsEntry { title: string; videoUrl: string; }

const inputClass =
  "storytime-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none";
const selectClass =
  "storytime-select w-full rounded-xl px-4 py-3 text-sm text-white focus:border-orange-500 focus:outline-none";

function DistributionUploadInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const [linkedProject, setLinkedProject] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!projectIdFromUrl) {
      setLinkedProject(null);
      return;
    }
    fetch("/api/creator/projects")
      .then((r) => r.json())
      .then((d) => {
        const p = (d.projects ?? []).find((x: { id: string }) => x.id === projectIdFromUrl);
        setLinkedProject(
          p ? { id: p.id, title: p.title } : { id: projectIdFromUrl, title: "Your project" },
        );
      })
      .catch(() => setLinkedProject({ id: projectIdFromUrl, title: "Linked project" }));
  }, [projectIdFromUrl]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "",
    posterUrl: "",
    backdropUrl: "",
    videoUrl: "",
    trailerUrl: "",
    scriptUrl: "",
    category: "",
    tags: "",
    language: "",
    country: "South Africa",
    ageRating: "",
    year: new Date().getFullYear().toString(),
    duration: "",
    episodes: "",
  });

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [crew, setCrew] = useState<CrewEntry[]>([{ name: "", role: "" }]);
  const [btsVideos, setBtsVideos] = useState<BtsEntry[]>([]);
  const [logline, setLogline] = useState("");
  const [contentWarnings, setContentWarnings] = useState("");
  const [festivalHistory, setFestivalHistory] = useState("");
  const [minAge, setMinAge] = useState<number>(0);
  const [advisoryFlags, setAdvisoryFlags] = useState<Record<string, boolean>>({});
  const [advisoryThemes, setAdvisoryThemes] = useState("");

  const [uploadingMainVideo, setUploadingMainVideo] = useState(false);
  const [uploadingTrailer, setUploadingTrailer] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingBackdrop, setUploadingBackdrop] = useState(false);
  const [uploadingScript, setUploadingScript] = useState(false);
  const [uploadingBtsIndex, setUploadingBtsIndex] = useState<number | null>(null);

  function toggleGenre(g: string) {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function addCrewRow() {
    setCrew((prev) => [...prev, { name: "", role: "" }]);
  }

  function updateCrew(idx: number, field: "name" | "role", value: string) {
    setCrew((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function removeCrewRow(idx: number) {
    setCrew((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadToStorage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload/content-media", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    return data.publicUrl as string;
  }

  function canAdvance(): boolean {
    if (step === 1) return !!form.type;
    if (step === 2) return !!form.title && !!form.description;
    if (step === 3) return !!form.videoUrl;
    return true;
  }

  async function handleSubmit(asDraft: boolean) {
    setError("");
    setLoading(true);
    try {
      const combinedDescriptionParts = [
        form.description,
        logline && `Logline: ${logline}`,
        contentWarnings && `Content warnings: ${contentWarnings}`,
        festivalHistory && `Festival / awards: ${festivalHistory}`,
      ].filter(Boolean) as string[];

      const advisoryPayload =
        Object.keys(advisoryFlags).length > 0 || advisoryThemes.trim()
          ? { ...advisoryFlags, ...(advisoryThemes.trim() && { themes: advisoryThemes.trim() }) }
          : undefined;

      const payload = {
        ...form,
        description: combinedDescriptionParts.join("\n\n"),
        category: selectedGenres.join(", ") || form.category,
        tags: form.tags || selectedGenres.join(", "),
        published: false,
        reviewStatus: asDraft ? "DRAFT" : "PENDING",
        submittedAt: asDraft ? null : new Date().toISOString(),
        crew: crew.filter((c) => c.name && c.role),
        btsVideos: btsVideos.filter((b) => b.title && b.videoUrl),
        minAge,
        advisory: advisoryPayload,
        ...(linkedProject ? { linkedProjectId: linkedProject.id } : {}),
      };

      const res = await fetch("/api/creator/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.requiresPayment && data?.payment) {
        setError("Payments are currently disabled on this platform.");
      } else if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/creator/dashboard"), 2000);
      } else {
        setError(data.error || "Submission failed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="storytime-plan-card max-w-md space-y-4 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-white">Submission received</h2>
          <p className="text-sm text-slate-400">
            Your content is in review. Our team will vet it before it can go live in the catalogue.
          </p>
          <p className="text-xs text-slate-500">Redirecting to My Projects…</p>
        </div>
      </div>
    );
  }

  function stepComplete(id: number): boolean {
    if (id === 1) return !!form.type;
    if (id === 2) return !!form.title && !!form.description;
    if (id === 3) return !!form.videoUrl;
    if (id === 4) return !!form.language && !!form.ageRating;
    if (id === 5) return true;
    return false;
  }

  return (
    <div className="px-6 py-8 md:px-12 md:py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="storytime-plan-card p-5 md:p-6 lg:p-8">
          <Link
            href="/creator/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Projects
          </Link>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
            Distribution &amp; delivery
          </p>
          <h1 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            <Upload className="h-8 w-8 shrink-0 text-orange-500" />
            Catalogue submission
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
            Six guided steps — same rhythm as the rest of the creator hub. Add masters, metadata, and cast &amp; crew,
            then submit for vetting. Nothing goes public until approved.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
            <Link href="/creator/post-production" className="text-orange-400 hover:text-orange-300">
              Post-production hub
            </Link>
            <span className="text-slate-600">·</span>
            <span>Autosave intent: use Save draft on the last step until you are ready.</span>
          </div>
        </header>

        {linkedProject && (
          <div className="creator-glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-200/80">Linked pipeline</p>
              <p className="text-sm font-medium text-white">Project: {linkedProject.title}</p>
              <p className="text-xs text-slate-400">
                This submission is associated with your film for your own tracking. Catalogue listing is still subject
                to review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.replace("/creator/upload")}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]"
            >
              Clear link
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:col-span-4">
            <div className="creator-glass-panel space-y-3 p-4 lg:sticky lg:top-24">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Submission steps</p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                {STEPS.map((s) => {
                  const active = step === s.id;
                  const past = s.id < step;
                  const complete = stepComplete(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (s.id <= step || canAdvance()) setStep(s.id);
                      }}
                      className={[
                        "flex w-full min-w-[140px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition lg:min-w-0",
                        active
                          ? "border-orange-500/50 bg-orange-500/15 text-white shadow-glow"
                          : past && complete
                            ? "border-green-500/30 bg-green-500/10 text-green-200"
                            : past
                              ? "border-white/10 bg-white/[0.05] text-slate-300"
                              : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20",
                      ].join(" ")}
                    >
                      {past && complete ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                      ) : (
                        <s.icon className="h-4 w-4 shrink-0 opacity-80" />
                      )}
                      <span className="truncate">
                        <span className="text-[10px] text-slate-500 lg:hidden">Step {s.id} · </span>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-white/10 pt-3 text-xs text-slate-500">
                Step {step} of {STEPS.length}
                {linkedProject && (
                  <>
                    <br />
                    <span className="text-orange-200/80">Linked: {linkedProject.title}</span>
                  </>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="creator-glass-panel rounded-2xl border border-white/10 p-5 md:p-8">

      {/* Step 1: Content Type */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">What are you delivering?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => updateField("type", t.value)}
                className={`p-6 rounded-xl border text-left transition space-y-2 ${
                  form.type === t.value
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                }`}
              >
                <t.icon className={`w-8 h-8 ${form.type === t.value ? "text-orange-400" : "text-slate-500"}`} />
                <p className={`font-semibold ${form.type === t.value ? "text-orange-400" : "text-white"}`}>{t.label}</p>
                <p className="text-xs text-slate-500">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Content Details</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Enter the title of your content"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Synopsis / Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={5}
                placeholder="Write a compelling synopsis that will appear on the content page. Include the storyline, themes, and what makes this unique..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">{form.description.length} / 2000 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Logline</label>
              <input
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                placeholder="One-sentence hook that captures the core of your story"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Content warnings</label>
                <input
                  value={contentWarnings}
                  onChange={(e) => setContentWarnings(e.target.value)}
                  placeholder="Violence, strong language, suicide, etc."
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Festival / awards history</label>
                <input
                  value={festivalHistory}
                  onChange={(e) => setFestivalHistory(e.target.value)}
                  placeholder="Festivals, selections and awards (optional)"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Genres (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      selectedGenres.includes(g)
                        ? "bg-orange-500 text-white"
                        : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-orange-500/50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tags</label>
              <input
                value={form.tags}
                onChange={(e) => updateField("tags", e.target.value)}
                placeholder="indie, south-african, debut, festival-winner (comma-separated)"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Media & Assets */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Media & Assets</h2>
          <p className="text-sm text-slate-400">
            Upload your master video, BTS material and script, or paste existing URLs. These files are used by Story Time
            admins during vetting and for delivery to viewers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-orange-400" /> Main Video *
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingMainVideo(true);
                        const url = await uploadToStorage(file);
                        updateField("videoUrl", url);
                      } catch (err) {
                        console.error(err);
                        setError("Failed to upload main video. Please try again.");
                      } finally {
                        setUploadingMainVideo(false);
                      }
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-orange-600 file:text-white hover:file:bg-orange-500 cursor-pointer"
                  />
                  <p className="text-xs text-slate-500">
                    Recommended: final delivery master in MP4 (H.264/H.265), 1080p or higher.
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={form.videoUrl}
                      onChange={(e) => updateField("videoUrl", e.target.value)}
                      placeholder="Or paste an existing streaming/storage URL"
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                    />
                    {uploadingMainVideo && (
                      <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">Uploading…</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Trailer (optional)</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingTrailer(true);
                        const url = await uploadToStorage(file);
                        updateField("trailerUrl", url);
                      } catch (err) {
                        console.error(err);
                        setError("Failed to upload trailer. Please try again.");
                      } finally {
                        setUploadingTrailer(false);
                      }
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={form.trailerUrl}
                      onChange={(e) => updateField("trailerUrl", e.target.value)}
                      placeholder="Or paste trailer URL"
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                    />
                    {uploadingTrailer && (
                      <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">Uploading…</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-orange-400" /> Poster image
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingPoster(true);
                        const url = await uploadToStorage(file);
                        updateField("posterUrl", url);
                      } catch (err) {
                        console.error(err);
                        setError("Failed to upload poster. Please try again.");
                      } finally {
                        setUploadingPoster(false);
                      }
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={form.posterUrl}
                      onChange={(e) => updateField("posterUrl", e.target.value)}
                      placeholder="Or paste poster image URL"
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                    />
                    {uploadingPoster && (
                      <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">Uploading…</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Recommended: 2:3 ratio, at least 500×750px, no key art cropping.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Backdrop / banner image</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingBackdrop(true);
                        const url = await uploadToStorage(file);
                        updateField("backdropUrl", url);
                      } catch (err) {
                        console.error(err);
                        setError("Failed to upload backdrop. Please try again.");
                      } finally {
                        setUploadingBackdrop(false);
                      }
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={form.backdropUrl}
                      onChange={(e) => updateField("backdropUrl", e.target.value)}
                      placeholder="Or paste backdrop image URL"
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                    />
                    {uploadingBackdrop && (
                      <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">Uploading…</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Recommended: 16:9 ratio, at least 1920×1080px.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Script upload */}
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-orange-400" /> Script (PDF)
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Upload the final production script used for this cut. This is only visible to Story Time admins for review.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingScript(true);
                      const url = await uploadToStorage(file);
                      updateField("scriptUrl", url);
                    } catch (err) {
                      console.error(err);
                      setError("Failed to upload script PDF. Please try again.");
                    } finally {
                      setUploadingScript(false);
                    }
                  }}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                />
                {uploadingScript && (
                  <span className="text-xs text-slate-400 whitespace-nowrap">Uploading script…</span>
                )}
              </div>
              <div className="space-y-1">
                <input
                  value={form.scriptUrl}
                  onChange={(e) => updateField("scriptUrl", e.target.value)}
                  placeholder="Or paste existing script URL"
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                />
                <p className="text-xs text-slate-500">
                  Accepted format: PDF only.
                </p>
              </div>
            </div>
          </div>

          {/* BTS videos */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-slate-200">Behind-the-scenes videos (optional)</h3>
                <p className="text-xs text-slate-500">
                  Add making-of clips, set diaries or interviews. These can be surfaced as extras around your main title.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setBtsVideos((prev) => [...prev, { title: "", videoUrl: "" }])
                }
                className="text-xs text-orange-400 hover:text-orange-300"
              >
                + Add BTS video
              </button>
            </div>
            <div className="space-y-3">
              {btsVideos.map((b, idx) => (
                <div
                  key={idx}
                  className="flex flex-col md:flex-row items-start md:items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-900/40 p-3"
                >
                  <input
                    value={b.title}
                    onChange={(e) =>
                      setBtsVideos((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, title: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="BTS title (e.g. On set: Day 1)"
                    className="w-full md:flex-1 px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                  />
                  <div className="flex-1 w-full flex items-center gap-2">
                    <input
                      value={b.videoUrl}
                      onChange={(e) =>
                        setBtsVideos((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, videoUrl: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Paste BTS video URL or upload below"
                      className="flex-1 px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                    />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setUploadingBtsIndex(idx);
                          const url = await uploadToStorage(file);
                          setBtsVideos((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, videoUrl: url } : item,
                            ),
                          );
                        } catch (err) {
                          console.error(err);
                          setError("Failed to upload BTS video. Please try again.");
                        } finally {
                          setUploadingBtsIndex(null);
                        }
                      }}
                      className="block w-40 text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadingBtsIndex === idx && (
                      <span className="text-xs text-slate-400">Uploading…</span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setBtsVideos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Metadata */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Metadata & Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-orange-400" /> Language
              </label>
              <select
                value={form.language}
                onChange={(e) => updateField("language", e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none transition"
              >
                <option value="">Select language</option>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-orange-400" /> Country of Origin
              </label>
              <input
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                placeholder="South Africa"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-orange-400" /> Age Rating
              </label>
              <select
                value={form.ageRating}
                onChange={(e) => updateField("ageRating", e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none transition"
              >
                <option value="">Select rating</option>
                {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-orange-400" /> Minimum viewer age
              </label>
              <input
                type="number"
                min={0}
                max={21}
                value={minAge}
                onChange={(e) => setMinAge(Math.max(0, Math.min(21, Number(e.target.value) || 0)))}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-1">Profiles younger than this age will not see this title in the catalogue.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">Content advisories (age disclaimer)</label>
              <p className="text-xs text-slate-500 mb-3">Select all that apply. Used for viewer censorship and transparency.</p>
              <div className="flex flex-wrap gap-3">
                {ADVISORY_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!advisoryFlags[key]}
                      onChange={(e) => setAdvisoryFlags((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-slate-600 bg-slate-900/50 text-orange-500 focus:ring-orange-500/50"
                    />
                    <span className="text-sm text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
              <input
                value={advisoryThemes}
                onChange={(e) => setAdvisoryThemes(e.target.value)}
                placeholder="Other themes (optional)"
                className="mt-3 w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-orange-400" /> Release Year
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => updateField("year", e.target.value)}
                placeholder="2026"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-400" /> Duration (minutes)
              </label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => updateField("duration", e.target.value)}
                placeholder="90"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
              />
            </div>
            {(form.type === "SERIES" || form.type === "PODCAST") && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-orange-400" /> Number of Episodes
                </label>
                <input
                  type="number"
                  value={form.episodes}
                  onChange={(e) => updateField("episodes", e.target.value)}
                  placeholder="8"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Cast & Crew */}
      {step === 5 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Cast & Crew</h2>
          <p className="text-sm text-slate-400">Add key cast and crew members. You can update this later from your dashboard.</p>
          <div className="space-y-3">
            {crew.map((c, i) => (
              <div key={i} className="flex gap-3 items-center">
                <input
                  value={c.name}
                  onChange={(e) => updateCrew(i, "name", e.target.value)}
                  placeholder="Full name"
                  className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
                />
                <select
                  value={c.role}
                  onChange={(e) => updateCrew(i, "role", e.target.value)}
                  className="w-48 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none transition"
                >
                  <option value="">Select role</option>
                  <option value="Director">Director</option>
                  <option value="Producer">Producer</option>
                  <option value="Lead Actor">Lead Actor</option>
                  <option value="Supporting Actor">Supporting Actor</option>
                  <option value="Director of Photography">Director of Photography</option>
                  <option value="Editor">Editor</option>
                  <option value="Sound Designer">Sound Designer</option>
                  <option value="Production Designer">Production Designer</option>
                  <option value="Costume Designer">Costume Designer</option>
                  <option value="Composer">Composer</option>
                  <option value="VFX Supervisor">VFX Supervisor</option>
                  <option value="Script Supervisor">Script Supervisor</option>
                  <option value="Camera Operator">Camera Operator</option>
                  <option value="Gaffer">Gaffer</option>
                  <option value="Grip">Grip</option>
                  <option value="Other">Other</option>
                </select>
                {crew.length > 1 && (
                  <button onClick={() => removeCrewRow(i)} className="p-2 text-red-400 hover:text-red-300 transition">✕</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addCrewRow} className="text-sm text-orange-400 hover:text-orange-300 transition">
            + Add another crew member
          </button>
        </div>
      )}

      {/* Step 6: Review & Submit */}
      {step === 6 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Review & Submit</h2>
          <p className="text-sm text-slate-400">Review your submission before sending it for admin approval. Content will not appear in the catalogue until approved.</p>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl divide-y divide-slate-700/50">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Clapperboard className="w-5 h-5 text-orange-400" />
                <h3 className="text-white font-medium">Basic Info</h3>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div><span className="text-slate-500">Title:</span> <span className="text-white">{form.title || "—"}</span></div>
                <div><span className="text-slate-500">Type:</span> <span className="text-white">{form.type || "—"}</span></div>
                <div><span className="text-slate-500">Genres:</span> <span className="text-white">{selectedGenres.join(", ") || "—"}</span></div>
                <div><span className="text-slate-500">Language:</span> <span className="text-white">{form.language || "—"}</span></div>
                <div><span className="text-slate-500">Country:</span> <span className="text-white">{form.country || "—"}</span></div>
                <div><span className="text-slate-500">Age Rating:</span> <span className="text-white">{form.ageRating || "—"}</span></div>
                <div><span className="text-slate-500">Min. age:</span> <span className="text-white">{minAge > 0 ? `${minAge}+` : "—"}</span></div>
                {(Object.keys(advisoryFlags).filter((k) => advisoryFlags[k]).length > 0 || advisoryThemes.trim()) && (
                  <div className="col-span-2"><span className="text-slate-500">Advisories:</span>{" "}
                    <span className="text-amber-200/90 text-xs">
                      {Object.entries(advisoryFlags)
                        .filter(([, v]) => v)
                        .map(([k]) => ADVISORY_OPTIONS.find((o) => o.key === k)?.label ?? k)
                        .join(", ")}
                      {advisoryThemes.trim() && ` · ${advisoryThemes.trim()}`}
                    </span>
                  </div>
                )}
                <div><span className="text-slate-500">Year:</span> <span className="text-white">{form.year || "—"}</span></div>
                <div><span className="text-slate-500">Duration:</span> <span className="text-white">{form.duration ? `${form.duration} min` : "—"}</span></div>
                {form.episodes && <div><span className="text-slate-500">Episodes:</span> <span className="text-white">{form.episodes}</span></div>}
              </div>
            </div>
            <div className="p-5">
              <h3 className="text-white font-medium mb-2">Synopsis</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{form.description || "No description provided."}</p>
            </div>
            <div className="p-5">
              <h3 className="text-white font-medium mb-2">Media</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div><span className="text-slate-500">Video:</span> <span className={form.videoUrl ? "text-green-400" : "text-red-400"}>{form.videoUrl ? "Provided" : "Missing"}</span></div>
                <div><span className="text-slate-500">Trailer:</span> <span className={form.trailerUrl ? "text-green-400" : "text-slate-500"}>{form.trailerUrl ? "Provided" : "Not provided"}</span></div>
                <div><span className="text-slate-500">Poster:</span> <span className={form.posterUrl ? "text-green-400" : "text-slate-500"}>{form.posterUrl ? "Provided" : "Not provided"}</span></div>
                <div><span className="text-slate-500">Backdrop:</span> <span className={form.backdropUrl ? "text-green-400" : "text-slate-500"}>{form.backdropUrl ? "Provided" : "Not provided"}</span></div>
              </div>
            </div>
            {crew.filter((c) => c.name && c.role).length > 0 && (
              <div className="p-5">
                <h3 className="text-white font-medium mb-2">Cast & Crew ({crew.filter((c) => c.name && c.role).length})</h3>
                <div className="flex flex-wrap gap-2">
                  {crew.filter((c) => c.name && c.role).map((c, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-slate-700/50 text-xs text-slate-300">
                      {c.name} — <span className="text-orange-400">{c.role}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-orange-400 mt-0.5" />
              <div>
                <h3 className="text-orange-400 font-medium text-sm">Vetting Process</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Once submitted, our admin team will review your content for quality, compliance, and catalogue readiness.
                  You&apos;ll be notified when the review is complete. Approved content will go live on the public catalogue.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-700/50">
        <div>
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50 transition text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step === 6 ? (
            <>
              <button
                onClick={() => handleSubmit(true)}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50 transition text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {loading ? "Saving..." : "Save as Draft"}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={loading || !form.title || !form.type}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition text-sm font-medium disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {loading ? "Submitting..." : "Submit for Review"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition text-sm font-medium disabled:opacity-50"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DistributionUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <DistributionUploadInner />
    </Suspense>
  );
}
