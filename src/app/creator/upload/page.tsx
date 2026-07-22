"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Upload, Film, Info, Image as ImageIcon, Settings, Users, Music,
  ArrowRight, ArrowLeft, CheckCircle, AlertCircle, Send, Save,
  Clapperboard, Globe, Tag, Clock, Calendar, Star, Tv, Shield, FileText,
  Laugh, Mic2, Trophy, Palette, Video, Radio, Newspaper, GraduationCap,
  Sparkles, ChevronDown, ChevronUp, type LucideIcon,
} from "lucide-react";
import { applyPrefillToUploadForm, type ProjectUploadPrefill } from "@/lib/project-upload-prefill";
import { CheckoutModal } from "@/components/payments/checkout-modal";
import { CREATOR_PER_FILM_UPLOAD_PRICE } from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";
import { MediaDropzone } from "@/components/ecosystem/media-dropzone";
import { defaultMinAgeForRating } from "@/lib/fpb-compliance";
import {
  CONTENT_TYPE_LABELS,
  MORE_UPLOAD_TYPE_VALUES,
  PRIMARY_UPLOAD_TYPE_VALUES,
  UPLOAD_TYPE_DESCRIPTIONS,
  isLongFormType,
} from "@/lib/content-types";
import { SeriesEpisodesUpload, buildSeasonsPayload, type EpisodeDraft } from "@/components/creator/series-episodes-upload";
import { UploadCreditRoleSelect } from "@/components/creator/upload-credit-role-select";
import { GenreMultiSelect } from "@/components/creator/genre-multi-select";
import {
  useCatalogueUpload,
  useJobAssetProgress,
} from "@/components/creator/catalogue-upload-provider";
import {
  clearCatalogueUploadDraft,
  loadCatalogueUploadDraft,
  newCatalogueDraftTempId,
  saveCatalogueUploadDraft,
  type CatalogueUploadDraftSnapshot,
} from "@/lib/catalogue-upload/draft-store";
import type { CatalogueAssetKind, CatalogueUploadAsset } from "@/lib/catalogue-upload/types";
import { catalogueAssetKindLabel } from "@/lib/catalogue-upload/types";

const TYPE_ICONS: Record<string, LucideIcon> = {
  MOVIE: Film,
  SERIES: Tv,
  SHOW: Star,
  DOCUMENTARY: Clapperboard,
  SHORT_FILM: Film,
  PODCAST: Music,
  COMEDY_SKIT: Laugh,
  STAND_UP: Mic2,
  ANIMATION: Palette,
  SPORTS: Trophy,
  MUSIC_VIDEO: Video,
  LIVE_EVENT: Radio,
  REALITY: Sparkles,
  WEB_SERIES: Tv,
  NEWS: Newspaper,
  EDUCATIONAL: GraduationCap,
};

type UploadTypeOption = {
  value: string;
  label: string;
  icon: LucideIcon;
  desc: string;
};

function buildTypeOptions(values: readonly string[]): UploadTypeOption[] {
  return values.map((value) => ({
    value,
    label: CONTENT_TYPE_LABELS[value] ?? value,
    icon: TYPE_ICONS[value] ?? Film,
    desc: UPLOAD_TYPE_DESCRIPTIONS[value] ?? "Catalogue title",
  }));
}

const PRIMARY_TYPES = buildTypeOptions(PRIMARY_UPLOAD_TYPE_VALUES);
const MORE_TYPES = buildTypeOptions(MORE_UPLOAD_TYPE_VALUES);

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
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const {
    ensureJob,
    findJob,
    updateJobMeta,
    enqueueAsset,
    removeAsset,
    requestFinalize,
    jobs,
  } = useCatalogueUpload();
  const projectIdFromUrl = searchParams.get("projectId");
  const contentIdFromUrl = searchParams.get("contentId");
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [draftTempId] = useState(() => newCatalogueDraftTempId());
  const [draftHydrated, setDraftHydrated] = useState(false);
  /** When editing an existing title, wait for server cast/crew/BTS before draft autosave. */
  const [serverContentHydrated, setServerContentHydrated] = useState(() => !contentIdFromUrl);
  const [backgroundSubmitNotice, setBackgroundSubmitNotice] = useState(false);
  const [resubmitMode, setResubmitMode] = useState(false);
  const [linkedProject, setLinkedProject] = useState<{ id: string; title: string } | null>(null);
  const [prefillData, setPrefillData] = useState<ProjectUploadPrefill | null>(null);
  const [dataSourceMode, setDataSourceMode] = useState<"unset" | "platform" | "manual">("unset");
  const [scriptSource, setScriptSource] = useState<"platform" | "upload">("upload");
  const [platformScriptVersionId, setPlatformScriptVersionId] = useState<string | null>(null);
  const [scriptPreview, setScriptPreview] = useState<string | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectIdFromUrl) {
      setLinkedProject(null);
      setPrefillData(null);
      setDataSourceMode("unset");
      return;
    }
    fetch("/api/creator/projects")
      .then((r) => r.json())
      .then((d) => {
        const p = (d.projects ?? []).find((x: { id: string; title: string }) => x.id === projectIdFromUrl);
        setLinkedProject(
          p ? { id: p.id, title: p.title } : { id: projectIdFromUrl, title: "Your project" },
        );
      })
      .catch(() => setLinkedProject({ id: projectIdFromUrl, title: "Linked project" }));

    fetch(`/api/creator/projects/${projectIdFromUrl}/upload-prefill`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProjectUploadPrefill | null) => {
        if (data) {
          setPrefillData(data);
          setDataSourceMode("unset");
        }
      })
      .catch(() => setPrefillData(null));
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (!contentIdFromUrl) {
      setEditingContentId(null);
      setResubmitMode(false);
      setServerContentHydrated(true);
      return;
    }
    setServerContentHydrated(false);
    let cancelled = false;
    fetch(`/api/creator/content?id=${encodeURIComponent(contentIdFromUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.id) return;
        setEditingContentId(data.id);
        setResubmitMode(["REJECTED", "CHANGES_REQUESTED", "UNPUBLISHED"].includes(data.reviewStatus));
        setForm((f) => ({
          ...f,
          title: data.title ?? "",
          description: data.description ?? "",
          type: data.type ?? "",
          posterUrl: data.posterUrl ?? "",
          backdropUrl: data.backdropUrl ?? "",
          videoUrl: data.videoUrl ?? "",
          trailerUrl: data.trailerUrl ?? "",
          scriptUrl: data.scriptUrl ?? "",
          category: data.category ?? "",
          tags: data.tags ?? "",
          language: data.language ?? "",
          country: data.country ?? "South Africa",
          ageRating: data.ageRating ?? "",
          year: data.year ? String(data.year) : f.year,
          duration: data.duration ? String(data.duration) : "",
          episodes: data.episodes ? String(data.episodes) : "",
        }));
        if (data.category) {
          setSelectedGenres(data.category.split(",").map((g: string) => g.trim()).filter(Boolean));
        }

        const crewRows = Array.isArray(data.crewMembers)
          ? data.crewMembers
              .map((c: { name?: string; role?: string }) => ({
                name: typeof c.name === "string" ? c.name : "",
                role: typeof c.role === "string" ? c.role : "",
              }))
              .filter((c: { name: string; role: string }) => c.name || c.role)
          : [];
        setCrew(crewRows.length > 0 ? crewRows : [{ name: "", role: "" }]);

        const btsRows = Array.isArray(data.btsVideos)
          ? data.btsVideos
              .map((b: { title?: string; videoUrl?: string | null; thumbnail?: string | null }) => ({
                title: typeof b.title === "string" ? b.title : "",
                videoUrl: typeof b.videoUrl === "string" ? b.videoUrl : "",
                thumbnail: typeof b.thumbnail === "string" ? b.thumbnail : "",
              }))
              .filter((b: { title: string; videoUrl: string }) => b.title || b.videoUrl)
          : [];
        setBtsVideos(btsRows);

        if (typeof data.minAge === "number" && Number.isFinite(data.minAge)) {
          setMinAge(data.minAge);
        }

        const advisory = data.advisory && typeof data.advisory === "object" ? (data.advisory as Record<string, unknown>) : null;
        if (advisory) {
          const flags: Record<string, boolean> = {};
          for (const [key, value] of Object.entries(advisory)) {
            if (key === "themes" || key === "compliance") continue;
            if (typeof value === "boolean") flags[key] = value;
          }
          setAdvisoryFlags(flags);
          if (typeof advisory.themes === "string") setAdvisoryThemes(advisory.themes);
          if (advisory.compliance && typeof advisory.compliance === "object") {
            setComplianceChecks((c) => ({
              ...c,
              ...(advisory.compliance as Partial<typeof c>),
            }));
          }
        }

        if (data.linkedProject?.id) {
          setLinkedProject({
            id: data.linkedProject.id,
            title: data.linkedProject.title || "Linked project",
          });
        }
        setServerContentHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setServerContentHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contentIdFromUrl]);

  function applyPlatformPrefill() {
    if (!prefillData) return;
    const applied = applyPrefillToUploadForm(prefillData, "platform");
    setForm((f) => ({ ...f, ...applied.formPatch }));
    setSelectedGenres(applied.selectedGenres);
    setCrew(applied.crew);
    setLogline(applied.logline);
    if (applied.platformScriptVersionId) {
      setPlatformScriptVersionId(applied.platformScriptVersionId);
      setScriptSource("platform");
      setScriptPreview(prefillData.script?.preview ?? null);
    }
    setDataSourceMode("platform");
  }

  const [step, setStep] = useState(1);
  const [showMoreTypes, setShowMoreTypes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [releaseContactName, setReleaseContactName] = useState("");
  const [releaseContactEmail, setReleaseContactEmail] = useState("");
  const [releaseContactPhone, setReleaseContactPhone] = useState("");
  const [complianceChecks, setComplianceChecks] = useState({
    rightsOwnershipConfirmed: false,
    thirdPartyClearancesConfirmed: false,
    musicRightsConfirmed: false,
    noUnlicensedBranding: false,
    finalMasterReviewed: false,
  });

  const matchedJob =
    findJob({
      jobId: uploadJobId,
      contentId: editingContentId ?? contentIdFromUrl,
      title: form.title,
    }) ?? null;
  const effectiveJobId = uploadJobId ?? matchedJob?.id ?? null;

  const mainVideoAsset = useJobAssetProgress(effectiveJobId, "mainVideo");
  const trailerAsset = useJobAssetProgress(effectiveJobId, "trailer");
  const posterAsset = useJobAssetProgress(effectiveJobId, "poster");
  const backdropAsset = useJobAssetProgress(effectiveJobId, "backdrop");
  const scriptAsset = useJobAssetProgress(effectiveJobId, "script");

  const [seasonCount, setSeasonCount] = useState(1);
  const [episodesPerSeason, setEpisodesPerSeason] = useState<number[]>([6]);
  const [episodeDrafts, setEpisodeDrafts] = useState<EpisodeDraft[]>([]);
  const longFormUpload = isLongFormType(form.type);

  useEffect(() => {
    if (form.type && (MORE_UPLOAD_TYPE_VALUES as readonly string[]).includes(form.type)) {
      setShowMoreTypes(true);
    }
  }, [form.type]);

  useEffect(() => {
    if (!uploadJobId) return;
    updateJobMeta(uploadJobId, {
      title: form.title.trim() || "Untitled draft",
      contentId: editingContentId,
      linkedProjectId: linkedProject?.id ?? null,
    });
  }, [uploadJobId, form.title, editingContentId, linkedProject?.id, updateJobMeta]);

  // Reattach to the in-memory upload queue when returning to this page
  useEffect(() => {
    const existing = findJob({
      jobId: uploadJobId,
      contentId: editingContentId ?? contentIdFromUrl,
      title: form.title,
    });
    if (!existing) return;
    if (uploadJobId !== existing.id) setUploadJobId(existing.id);
    const hasMediaActivity = existing.assets.some(
      (a) =>
        a.status === "queued" ||
        a.status === "uploading" ||
        a.status === "complete" ||
        a.status === "failed",
    );
    if (hasMediaActivity && step < 3) setStep(3);
  }, [
    findJob,
    uploadJobId,
    editingContentId,
    contentIdFromUrl,
    form.title,
    jobs,
    step,
  ]);

  // Mirror completed queue URLs into the form so submit/draft payloads stay current.
  // While a slot is re-uploading / failed after remove, clear the stale URL.
  // When a slot disappears from the queue (bell Remove), clear that form field too —
  // storage objects are deleted on remove, so keeping the URL would point at a missing file.
  const prevQueueSlotsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const jobId = effectiveJobId;
    if (!jobId) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const slotKey = (kind: CatalogueAssetKind, meta?: CatalogueUploadAsset["meta"]) => {
      if (kind === "episode") return `episode:${meta?.seasonNumber ?? "?"}:${meta?.episodeNumber ?? "?"}`;
      if (kind === "bts") return `bts:${meta?.btsIndex ?? "?"}`;
      return kind;
    };

    const currentSlots = new Set(job.assets.map((a) => slotKey(a.kind, a.meta)));
    for (const prev of prevQueueSlotsRef.current) {
      if (currentSlots.has(prev)) continue;
      if (prev === "mainVideo") setForm((f) => (f.videoUrl ? { ...f, videoUrl: "" } : f));
      if (prev === "trailer") setForm((f) => (f.trailerUrl ? { ...f, trailerUrl: "" } : f));
      if (prev === "poster") setForm((f) => (f.posterUrl ? { ...f, posterUrl: "" } : f));
      if (prev === "backdrop") setForm((f) => (f.backdropUrl ? { ...f, backdropUrl: "" } : f));
      if (prev === "script") setForm((f) => (f.scriptUrl ? { ...f, scriptUrl: "" } : f));
      if (prev.startsWith("episode:")) {
        const [, sRaw, eRaw] = prev.split(":");
        const s = Number(sRaw);
        const e = Number(eRaw);
        if (Number.isFinite(s) && Number.isFinite(e)) {
          setEpisodeDrafts((drafts) =>
            drafts.map((ep) =>
              ep.seasonNumber === s && ep.episodeNumber === e && ep.videoUrl
                ? { ...ep, videoUrl: "" }
                : ep,
            ),
          );
        }
      }
      if (prev.startsWith("bts:")) {
        const idx = Number(prev.split(":")[1]);
        if (Number.isFinite(idx)) {
          setBtsVideos((list) =>
            list.map((b, i) => (i === idx && b.videoUrl ? { ...b, videoUrl: "" } : b)),
          );
        }
      }
    }
    prevQueueSlotsRef.current = currentSlots;

    const syncScalar = (
      kind: CatalogueAssetKind,
      field: "videoUrl" | "trailerUrl" | "posterUrl" | "backdropUrl" | "scriptUrl",
    ) => {
      const assets = job.assets.filter((a) => a.kind === kind);
      const complete = assets.find((a) => a.status === "complete" && a.storageUrl);
      if (complete?.storageUrl) {
        setForm((f) => (f[field] === complete.storageUrl ? f : { ...f, [field]: complete.storageUrl! }));
        return;
      }
      if (assets.some((a) => a.status === "queued" || a.status === "uploading" || a.status === "failed")) {
        setForm((f) => (f[field] ? { ...f, [field]: "" } : f));
      }
    };

    syncScalar("mainVideo", "videoUrl");
    syncScalar("trailer", "trailerUrl");
    syncScalar("poster", "posterUrl");
    syncScalar("backdrop", "backdropUrl");
    syncScalar("script", "scriptUrl");

    for (const asset of job.assets) {
      if (asset.kind === "episode" && asset.meta?.seasonNumber != null && asset.meta?.episodeNumber != null) {
        const s = asset.meta.seasonNumber;
        const e = asset.meta.episodeNumber;
        if (asset.status === "complete" && asset.storageUrl) {
          const url = asset.storageUrl;
          setEpisodeDrafts((prev) =>
            prev.map((ep) =>
              ep.seasonNumber === s && ep.episodeNumber === e && ep.videoUrl !== url
                ? { ...ep, videoUrl: url }
                : ep,
            ),
          );
        } else if (
          asset.status === "queued" ||
          asset.status === "uploading" ||
          asset.status === "failed"
        ) {
          setEpisodeDrafts((prev) =>
            prev.map((ep) =>
              ep.seasonNumber === s && ep.episodeNumber === e && ep.videoUrl
                ? { ...ep, videoUrl: "" }
                : ep,
            ),
          );
        }
      } else if (asset.kind === "bts" && asset.meta?.btsIndex != null) {
        const idx = asset.meta.btsIndex;
        if (asset.status === "complete" && asset.storageUrl) {
          const url = asset.storageUrl;
          setBtsVideos((prev) =>
            prev.map((b, i) => (i === idx && b.videoUrl !== url ? { ...b, videoUrl: url } : b)),
          );
        } else if (
          asset.status === "queued" ||
          asset.status === "uploading" ||
          asset.status === "failed"
        ) {
          setBtsVideos((prev) =>
            prev.map((b, i) => (i === idx && b.videoUrl ? { ...b, videoUrl: "" } : b)),
          );
        }
      }
    }
  }, [jobs, effectiveJobId]);

  // Restore local draft (text/prefill) when not loading a server contentId yet
  useEffect(() => {
    if (!userId || draftHydrated) return;
    if (contentIdFromUrl) {
      const serverDraft = loadCatalogueUploadDraft(userId, contentIdFromUrl);
      if (serverDraft) {
        // Keep cast/crew/BTS for the server hydrate — local drafts often have empty credits after send-back.
        applyDraftSnapshot(serverDraft, { preferServerUrls: false, skipCredits: true });
      }
      setDraftHydrated(true);
      return;
    }
    const local = loadCatalogueUploadDraft(userId, draftTempId);
    if (local) applyDraftSnapshot(local, { preferServerUrls: false });
    setDraftHydrated(true);
  }, [userId, contentIdFromUrl, draftTempId, draftHydrated]);

  function applyDraftSnapshot(
    snap: CatalogueUploadDraftSnapshot,
    opts: { preferServerUrls: boolean; skipCredits?: boolean },
  ) {
    setStep(snap.step || 1);
    setForm((f) => ({
      ...f,
      ...snap.form,
      ...(opts.preferServerUrls
        ? {
            videoUrl: f.videoUrl || snap.form.videoUrl || "",
            trailerUrl: f.trailerUrl || snap.form.trailerUrl || "",
            posterUrl: f.posterUrl || snap.form.posterUrl || "",
            backdropUrl: f.backdropUrl || snap.form.backdropUrl || "",
            scriptUrl: f.scriptUrl || snap.form.scriptUrl || "",
          }
        : {}),
    }));
    setSelectedGenres(snap.selectedGenres ?? []);
    if (!opts.skipCredits) {
      setCrew(snap.crew?.length ? snap.crew : [{ name: "", role: "" }]);
      setBtsVideos(snap.btsVideos ?? []);
      setMinAge(snap.minAge ?? 0);
      setAdvisoryFlags(snap.advisoryFlags ?? {});
      setAdvisoryThemes(snap.advisoryThemes ?? "");
    }
    setLogline(snap.logline ?? "");
    setContentWarnings(snap.contentWarnings ?? "");
    setFestivalHistory(snap.festivalHistory ?? "");
    setDeliveryNotes(snap.deliveryNotes ?? "");
    setReleaseContactName(snap.releaseContactName ?? "");
    setReleaseContactEmail(snap.releaseContactEmail ?? "");
    setReleaseContactPhone(snap.releaseContactPhone ?? "");
    if (snap.complianceChecks) {
      setComplianceChecks((c) => ({ ...c, ...snap.complianceChecks }));
    }
    setSeasonCount(snap.seasonCount ?? 1);
    setEpisodesPerSeason(snap.episodesPerSeason ?? [6]);
    setEpisodeDrafts(snap.episodeDrafts ?? []);
    if (snap.dataSourceMode === "platform" || snap.dataSourceMode === "manual") {
      setDataSourceMode(snap.dataSourceMode);
    }
    if (snap.linkedProjectId) {
      setLinkedProject({
        id: snap.linkedProjectId,
        title: snap.linkedProjectTitle || "Linked project",
      });
    }
    if (snap.platformScriptVersionId) {
      setPlatformScriptVersionId(snap.platformScriptVersionId);
      setScriptSource("platform");
      setScriptPreview(snap.scriptPreview);
    } else if (snap.scriptSource === "upload" || snap.scriptSource === "platform") {
      setScriptSource(snap.scriptSource);
    }
    if (snap.contentId) setEditingContentId(snap.contentId);
  }

  // Debounced localStorage autosave for form text / prefill
  useEffect(() => {
    if (!userId || !draftHydrated) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const keyId = editingContentId || draftTempId;
      const snapshot: CatalogueUploadDraftSnapshot = {
        version: 1,
        tempId: draftTempId,
        contentId: editingContentId,
        step,
        form,
        selectedGenres,
        crew,
        btsVideos,
        logline,
        contentWarnings,
        festivalHistory,
        minAge,
        advisoryFlags,
        advisoryThemes,
        deliveryNotes,
        releaseContactName,
        releaseContactEmail,
        releaseContactPhone,
        complianceChecks,
        seasonCount,
        episodesPerSeason,
        episodeDrafts,
        dataSourceMode,
        linkedProjectId: linkedProject?.id ?? null,
        linkedProjectTitle: linkedProject?.title ?? null,
        platformScriptVersionId,
        scriptSource,
        scriptPreview,
        updatedAt: Date.now(),
      };
      saveCatalogueUploadDraft(userId, keyId, snapshot);
    }, 600);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [
    userId,
    draftHydrated,
    draftTempId,
    editingContentId,
    step,
    form,
    selectedGenres,
    crew,
    btsVideos,
    logline,
    contentWarnings,
    festivalHistory,
    minAge,
    advisoryFlags,
    advisoryThemes,
    deliveryNotes,
    releaseContactName,
    releaseContactEmail,
    releaseContactPhone,
    complianceChecks,
    seasonCount,
    episodesPerSeason,
    episodeDrafts,
    dataSourceMode,
    linkedProject,
    platformScriptVersionId,
    scriptSource,
    scriptPreview,
  ]);

  // Early server DRAFT once title + type exist (so Continue Editing / My catalogue work)
  useEffect(() => {
    if (!form.title.trim() || !form.type || !draftHydrated) return;
    // Never autosave credits until existing titles have reloaded cast/crew from the server.
    if (contentIdFromUrl && !serverContentHydrated) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const hydratedCrew = crew.filter((c) => c.name && c.role);
          const hydratedBts = btsVideos.filter((b) => b.title && b.videoUrl);
          const advisoryPayload =
            Object.keys(advisoryFlags).length > 0 || advisoryThemes.trim()
              ? {
                  ...advisoryFlags,
                  ...(advisoryThemes.trim() && { themes: advisoryThemes.trim() }),
                  compliance: complianceChecks,
                }
              : undefined;
          const res = await fetch("/api/creator/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              category: selectedGenres.join(", ") || form.category,
              published: false,
              reviewStatus: "DRAFT",
              // Only send credits after hydrate so we never wipe DB cast/crew with [].
              ...(serverContentHydrated || !contentIdFromUrl
                ? {
                    crew: hydratedCrew,
                    btsVideos: hydratedBts,
                    minAge,
                    ...(advisoryPayload ? { advisory: advisoryPayload } : {}),
                  }
                : {}),
              ...(linkedProject ? { linkedProjectId: linkedProject.id } : {}),
              ...(editingContentId ? { contentId: editingContentId } : {}),
              ...(longFormUpload && episodeDrafts.some((e) => e.videoUrl)
                ? {
                    seasons: buildSeasonsPayload(episodeDrafts),
                    episodes: episodeDrafts.length,
                    videoUrl: null,
                  }
                : {}),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && (data.id || data.contentId)) {
            const id = (data.id || data.contentId) as string;
            setEditingContentId(id);
            if (uploadJobId) updateJobMeta(uploadJobId, { contentId: id });
          }
        } catch {
          // ignore autosave network errors
        }
      })();
    }, 2500);
    return () => clearTimeout(timer);
  }, [
    form.title,
    form.type,
    form.description,
    form.videoUrl,
    form.posterUrl,
    form.backdropUrl,
    draftHydrated,
    serverContentHydrated,
    contentIdFromUrl,
    // intentionally omit full form to avoid thrashing — title/type/key fields trigger
  ]);

  useEffect(() => {
    if (longFormUpload && episodeDrafts.length === 0) {
      const initial: EpisodeDraft[] = [];
      for (let s = 1; s <= seasonCount; s++) {
        const count = episodesPerSeason[s - 1] ?? 6;
        for (let e = 1; e <= count; e++) {
          initial.push({
            seasonNumber: s,
            episodeNumber: e,
            title: `Episode ${e}`,
            description: "",
            videoUrl: "",
            duration: "",
          });
        }
      }
      setEpisodeDrafts(initial);
    }
  }, [longFormUpload, seasonCount, episodesPerSeason, episodeDrafts.length]);

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

  function enqueueMedia(
    kind: CatalogueAssetKind,
    file: File,
    meta?: { seasonNumber?: number; episodeNumber?: number; btsIndex?: number },
  ) {
    const jobId =
      uploadJobId ??
      ensureJob({
        contentId: editingContentId ?? contentIdFromUrl,
        title: form.title || undefined,
        linkedProjectId: linkedProject?.id ?? null,
      });
    if (!uploadJobId) setUploadJobId(jobId);
    setError("");
    // Clear stale form URL immediately so the UI shows the new upload (not "done" at 0%).
    if (kind === "mainVideo") updateField("videoUrl", "");
    if (kind === "trailer") updateField("trailerUrl", "");
    if (kind === "poster") updateField("posterUrl", "");
    if (kind === "backdrop") updateField("backdropUrl", "");
    if (kind === "script") updateField("scriptUrl", "");
    if (kind === "episode" && meta?.seasonNumber != null && meta?.episodeNumber != null) {
      const s = meta.seasonNumber;
      const e = meta.episodeNumber;
      setEpisodeDrafts((prev) =>
        prev.map((ep) =>
          ep.seasonNumber === s && ep.episodeNumber === e ? { ...ep, videoUrl: "" } : ep,
        ),
      );
    }
    if (kind === "bts" && meta?.btsIndex != null) {
      const idx = meta.btsIndex;
      setBtsVideos((prev) =>
        prev.map((b, i) => (i === idx ? { ...b, videoUrl: "" } : b)),
      );
    }
    enqueueAsset({
      jobId,
      kind,
      label: catalogueAssetKindLabel(kind, meta),
      file,
      meta,
    });
  }

  function clearMediaSlot(
    kind: CatalogueAssetKind,
    meta?: { seasonNumber?: number; episodeNumber?: number; btsIndex?: number },
  ) {
    const jobId =
      uploadJobId ??
      findJob({
        contentId: editingContentId ?? contentIdFromUrl,
        title: form.title,
      })?.id ??
      null;
    if (jobId) {
      removeAsset(jobId, kind, meta);
      if (!uploadJobId) setUploadJobId(jobId);
    }
    if (kind === "mainVideo") updateField("videoUrl", "");
    if (kind === "trailer") updateField("trailerUrl", "");
    if (kind === "poster") updateField("posterUrl", "");
    if (kind === "backdrop") updateField("backdropUrl", "");
    if (kind === "script") updateField("scriptUrl", "");
  }

  function handleMainVideoUpload(file: File) {
    enqueueMedia("mainVideo", file);
  }

  function handleTrailerUpload(file: File) {
    enqueueMedia("trailer", file);
  }

  function canAdvance(): boolean {
    if (step === 1) return !!form.type;
    if (step === 2) return !!form.title && !!form.description;
    if (step === 3) {
      if (longFormUpload) {
        return (
          !!form.backdropUrl &&
          !!form.posterUrl &&
          episodeDrafts.length > 0 &&
          episodeDrafts.every((e) => e.videoUrl.trim())
        );
      }
      return !!form.videoUrl;
    }
    return true;
  }

  function getStepMissing(stepId: number): string[] {
    if (stepId === 1) return form.type ? [] : ["Select a content type"];
    if (stepId === 2) {
      const missing: string[] = [];
      if (!form.title.trim()) missing.push("Title");
      if (!form.description.trim()) missing.push("Synopsis");
      return missing;
    }
    if (stepId === 3) {
      if (longFormUpload) {
        const missing: string[] = [];
        if (!form.backdropUrl.trim()) missing.push("Backdrop image (used on the title page)");
        if (!form.posterUrl.trim()) missing.push("Poster (used in browse catalogue)");
        if (!episodeDrafts.every((e) => e.videoUrl.trim())) missing.push("All episode videos");
        return missing;
      }
      return form.videoUrl.trim() ? [] : ["Main video upload"];
    }
    if (stepId === 4) {
      const missing: string[] = [];
      if (!form.language.trim()) missing.push("Language");
      if (!form.ageRating.trim()) missing.push("Age rating");
      if (form.ageRating.trim() && minAge <= 0 && form.ageRating !== "G") {
        missing.push("Minimum viewer age");
      }
      return missing;
    }
    if (stepId === 6) {
      const missing: string[] = [];
      if (!releaseContactName.trim()) missing.push("Release contact name");
      if (!releaseContactEmail.trim()) missing.push("Release contact email");
      if (
        releaseContactEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(releaseContactEmail.trim())
      ) {
        missing.push("Valid release contact email");
      }
      if (!complianceChecks.rightsOwnershipConfirmed) missing.push("Rights ownership confirmation");
      if (!complianceChecks.thirdPartyClearancesConfirmed) missing.push("Third-party clearances confirmation");
      if (!complianceChecks.musicRightsConfirmed) missing.push("Music rights confirmation");
      if (!complianceChecks.noUnlicensedBranding) missing.push("Unlicensed branding confirmation");
      if (!complianceChecks.finalMasterReviewed) missing.push("Final master QA confirmation");
      return missing;
    }
    return [];
  }

  async function handleSubmit(asDraft: boolean) {
    setError("");
    setBackgroundSubmitNotice(false);
    if (!asDraft) {
      const hasCoreRightsChecks =
        complianceChecks.rightsOwnershipConfirmed &&
        complianceChecks.thirdPartyClearancesConfirmed &&
        complianceChecks.musicRightsConfirmed &&
        complianceChecks.noUnlicensedBranding &&
        complianceChecks.finalMasterReviewed;
      if (!hasCoreRightsChecks) {
        setError("Complete all rights and compliance confirmations before submitting.");
        return;
      }
      if (!releaseContactName.trim() || !releaseContactEmail.trim()) {
        setError("Add a release contact name and email before submitting.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(releaseContactEmail.trim())) {
        setError("Enter a valid release contact email.");
        return;
      }
    }
    setLoading(true);
    try {
      const combinedDescriptionParts = [
        form.description,
        logline && `Logline: ${logline}`,
        contentWarnings && `Content warnings: ${contentWarnings}`,
        festivalHistory && `Festival / awards: ${festivalHistory}`,
        deliveryNotes && `Delivery notes: ${deliveryNotes}`,
        !asDraft && releaseContactName.trim()
          ? `Release contact: ${releaseContactName.trim()} (${releaseContactEmail.trim()}${releaseContactPhone.trim() ? `, ${releaseContactPhone.trim()}` : ""})`
          : "",
      ].filter(Boolean) as string[];

      const advisoryPayload =
        Object.keys(advisoryFlags).length > 0 || advisoryThemes.trim()
          ? {
              ...advisoryFlags,
              ...(advisoryThemes.trim() && { themes: advisoryThemes.trim() }),
              compliance: complianceChecks,
            }
          : undefined;

      const payload = {
        ...form,
        description: combinedDescriptionParts.join("\n\n"),
        category: selectedGenres.join(", ") || form.category,
        tags: [
          form.tags || selectedGenres.join(", "),
          scriptSource === "platform" && platformScriptVersionId
            ? `platform-script-version:${platformScriptVersionId}`
            : "",
        ]
          .filter(Boolean)
          .join(", "),
        published: false,
        reviewStatus: asDraft ? "DRAFT" : "PENDING",
        submittedAt: asDraft ? null : new Date().toISOString(),
        crew: crew.filter((c) => c.name && c.role),
        btsVideos: btsVideos.filter((b) => b.title && b.videoUrl),
        minAge,
        advisory: advisoryPayload,
        ...(linkedProject ? { linkedProjectId: linkedProject.id } : {}),
        ...(longFormUpload && episodeDrafts.length > 0
          ? { seasons: buildSeasonsPayload(episodeDrafts), episodes: episodeDrafts.length, videoUrl: null }
          : {}),
        ...(editingContentId ? { contentId: editingContentId } : {}),
      };

      const jobId =
        uploadJobId ??
        ensureJob({
          contentId: editingContentId,
          title: form.title || undefined,
          linkedProjectId: linkedProject?.id ?? null,
        });
      if (!uploadJobId) setUploadJobId(jobId);

      const result = await requestFinalize(jobId, payload);
      if (!result.ok) {
        setError(result.error || "Submission failed");
        return;
      }

      if (result.contentId) {
        setEditingContentId(result.contentId);
        if (userId) {
          clearCatalogueUploadDraft(userId, draftTempId);
          clearCatalogueUploadDraft(userId, result.contentId);
        }
      }

      if (result.deferred) {
        setBackgroundSubmitNotice(true);
        return;
      }

      if (result.requiresPayment) {
        if (result.checkoutUrl) {
          setCheckoutUrl(result.checkoutUrl);
          setCheckoutOpen(true);
          return;
        }
        setError("Unable to start checkout. Please try again.");
      } else if (result.reviewStatus === "AWAITING_PAYMENT") {
        setError("Payment is required before your film can enter review.");
      } else if (asDraft) {
        setSuccess(true);
        setTimeout(() => router.push("/creator/catalogue"), 1500);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/creator/catalogue"), 2000);
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
          <p className="text-xs text-slate-500">Redirecting to My catalogue…</p>
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
      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        title="Complete film submission payment"
        subtitle={`Pay ${formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)} to submit this title for catalogue review. Your film enters the review queue only after successful payment.`}
        onClose={() => setCheckoutOpen(false)}
      />
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
            <span>
              Uploads keep running if you leave this page — check the notification bell for progress.
              Form text autosaves while you work.
            </span>
          </div>
        </header>

        {resubmitMode && editingContentId ? (
          <div className="creator-glass-panel rounded-xl border border-orange-400/25 bg-orange-500/[0.06] p-4">
            <p className="text-sm font-medium text-orange-100">Revising a returned submission</p>
            <p className="mt-1 text-xs text-slate-400">
              You already paid for this title — resubmission after rejection or requested changes is free.
            </p>
          </div>
        ) : null}

        {backgroundSubmitNotice ? (
          <div className="creator-glass-panel rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
            <p className="text-sm font-medium text-emerald-100">Uploads continuing in the background</p>
            <p className="mt-1 text-xs text-slate-400">
              You can leave this page. Open the notification bell to watch progress — you will get a
              notification when the catalogue entry is saved.
            </p>
            <Link
              href="/creator/catalogue"
              className="mt-2 inline-block text-xs font-medium text-orange-300 hover:text-orange-200"
            >
              Go to My catalogue
            </Link>
          </div>
        ) : null}

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

        {linkedProject && prefillData && dataSourceMode === "unset" && (
          <div className="creator-glass-panel space-y-4 rounded-xl border border-orange-500/25 p-5">
            <div>
              <p className="text-sm font-semibold text-white">How should we prepare this submission?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Your project has work in Story Time tools. Import what you already built, or enter and upload everything
                yourself.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={applyPlatformPrefill}
                className="rounded-xl border border-orange-400/35 bg-orange-500/10 p-4 text-left transition hover:bg-orange-500/15"
              >
                <p className="text-sm font-semibold text-orange-100">Use platform data</p>
                <p className="mt-1 text-xs text-slate-400">
                  Prefill title, synopsis, cast/crew
                  {prefillData.sources.script ? ", and link your Script Writing screenplay" : ""}.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDataSourceMode("manual")}
                className="rounded-xl border border-white/12 bg-white/[0.03] p-4 text-left transition hover:border-white/20"
              >
                <p className="text-sm font-semibold text-white">Enter manually</p>
                <p className="mt-1 text-xs text-slate-400">
                  Start with a blank form and upload your own video, poster, and script files.
                </p>
              </button>
            </div>
          </div>
        )}

        {dataSourceMode === "platform" && (
          <div className="rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-xs text-green-100">
            Platform prefill applied — review each step and upload your master video before submitting.
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
                {getStepMissing(step).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getStepMissing(step).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200"
                      >
                        Missing: {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
                      All current-step requirements complete
                    </span>
                  </div>
                )}
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
          <div>
            <h2 className="text-xl font-semibold text-white">What are you delivering?</h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose the format that best matches your title. More specialised formats are under View more.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PRIMARY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
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

          {!showMoreTypes && MORE_TYPES.some((t) => t.value === form.type) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
              <span>
                Selected format:{" "}
                <strong className="text-orange-200">
                  {CONTENT_TYPE_LABELS[form.type] ?? form.type}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setShowMoreTypes(true)}
                className="rounded-lg border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-200 transition hover:bg-orange-500/25"
              >
                Change
              </button>
            </div>
          )}

          {showMoreTypes && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                More formats
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {MORE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      updateField("type", t.value);
                      setShowMoreTypes(true);
                    }}
                    className={`p-5 rounded-xl border text-left transition space-y-2 ${
                      form.type === t.value
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                    }`}
                  >
                    <t.icon className={`w-7 h-7 ${form.type === t.value ? "text-orange-400" : "text-slate-500"}`} />
                    <p className={`font-semibold ${form.type === t.value ? "text-orange-400" : "text-white"}`}>{t.label}</p>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMoreTypes((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-200"
          >
            {showMoreTypes ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show fewer formats
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                View more formats
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400">
                  {MORE_TYPES.length}
                </span>
              </>
            )}
          </button>
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
            <GenreMultiSelect value={selectedGenres} onChange={setSelectedGenres} />
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
            {longFormUpload
              ? "Upload catalogue poster, a cinematic backdrop for the title page, optional trailer, and all season episodes below."
              : "Upload your master video, BTS clips, poster, backdrop, and script (PDF) using the file pickers below."}
          </p>
          {effectiveJobId &&
          (mainVideoAsset.uploading ||
            trailerAsset.uploading ||
            posterAsset.uploading ||
            backdropAsset.uploading ||
            posterAsset.error ||
            mainVideoAsset.error) ? (
            <div className="rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 text-sm text-sky-100">
              Resumed your in-progress media uploads. Progress stays in the notification bell if you leave this page.
              Failed items (like a poster) can be removed and replaced below.
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              {!longFormUpload && (
              <MediaDropzone
                label="Main Video *"
                hint="Delivery master: MP4 H.264 + AAC, under ~180 Mbps average (not ProRes/uncompressed). Large files up to ~50GB use fast multipart upload; Stream encodes after upload."
                accept="video/*"
                uploading={mainVideoAsset.uploading}
                progress={mainVideoAsset.progress}
                done={(Boolean(form.videoUrl) || mainVideoAsset.done) && !mainVideoAsset.uploading}
                error={mainVideoAsset.error}
                onFile={handleMainVideoUpload}
                onClear={() => clearMediaSlot("mainVideo")}
              >
                <details className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
                    Optional: paste a direct video URL instead
                  </summary>
                  <input
                    value={form.videoUrl}
                    onChange={(e) => updateField("videoUrl", e.target.value)}
                    placeholder="https://… (CDN or direct file)"
                    className="mt-2 w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                  />
                </details>
              </MediaDropzone>
              )}
              <MediaDropzone
                label="Trailer (optional)"
                hint="Upload a short trailer or teaser. MOV/MP4 uploads are processed for adaptive streaming after submission."
                accept="video/*"
                uploading={trailerAsset.uploading}
                progress={trailerAsset.progress}
                done={(Boolean(form.trailerUrl) || trailerAsset.done) && !trailerAsset.uploading}
                error={trailerAsset.error}
                onFile={handleTrailerUpload}
                onClear={() => clearMediaSlot("trailer")}
              >
                <details className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
                    Optional: paste trailer URL instead
                  </summary>
                  <input
                    value={form.trailerUrl}
                    onChange={(e) => updateField("trailerUrl", e.target.value)}
                    placeholder="https://…"
                    className="mt-2 w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                  />
                </details>
              </MediaDropzone>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-orange-400" /> Poster image {longFormUpload ? "*" : ""}
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      enqueueMedia("poster", file);
                      e.target.value = "";
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                  {posterAsset.uploading && (
                    <p className="text-xs text-orange-300">
                      Uploading poster image…
                      {posterAsset.progress != null ? ` ${Math.round(posterAsset.progress)}%` : ""}
                    </p>
                  )}
                  {posterAsset.error ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-red-300">{posterAsset.error}</p>
                      <button
                        type="button"
                        onClick={() => clearMediaSlot("poster")}
                        className="rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5"
                      >
                        Remove failed poster
                      </button>
                    </div>
                  ) : null}
                  {posterAsset.done && !posterAsset.uploading && form.posterUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.posterUrl.startsWith("http") ? form.posterUrl : ""}
                        alt=""
                        className={
                          form.posterUrl.startsWith("http")
                            ? "h-24 w-16 rounded-lg object-cover border border-white/10"
                            : "hidden"
                        }
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-emerald-400">Poster image uploaded</p>
                        <button
                          type="button"
                          onClick={() => clearMediaSlot("poster")}
                          className="rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5"
                        >
                          Remove / replace
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <details className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                    <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
                      Optional: paste poster image URL instead
                    </summary>
                    <input
                      value={form.posterUrl}
                      onChange={(e) => updateField("posterUrl", e.target.value)}
                      placeholder="https://…"
                      className="mt-2 w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                    />
                  </details>
                  <p className="text-xs text-slate-500">
                    Used in the browse catalogue (2:3 ratio, min 500×750px).
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Backdrop / banner image {longFormUpload ? "*" : ""}</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      enqueueMedia("backdrop", file);
                      e.target.value = "";
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                  {backdropAsset.uploading && (
                    <p className="text-xs text-orange-300">
                      Uploading backdrop / banner…
                      {backdropAsset.progress != null ? ` ${Math.round(backdropAsset.progress)}%` : ""}
                    </p>
                  )}
                  {backdropAsset.error ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-red-300">{backdropAsset.error}</p>
                      <button
                        type="button"
                        onClick={() => clearMediaSlot("backdrop")}
                        className="rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5"
                      >
                        Remove failed backdrop
                      </button>
                    </div>
                  ) : null}
                  {backdropAsset.done && !backdropAsset.uploading && form.backdropUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-emerald-400">Backdrop / banner uploaded</p>
                      <button
                        type="button"
                        onClick={() => clearMediaSlot("backdrop")}
                        className="rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5"
                      >
                        Remove / replace
                      </button>
                    </div>
                  ) : null}
                  <details className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                    <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
                      Optional: paste backdrop image URL instead
                    </summary>
                    <input
                      value={form.backdropUrl}
                      onChange={(e) => updateField("backdropUrl", e.target.value)}
                      placeholder="https://…"
                      className="mt-2 w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                    />
                  </details>
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
              Upload the final production script used for this cut, or link the screenplay from Script Writing.
            </p>
            {prefillData?.script && (
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setScriptSource("platform");
                    setPlatformScriptVersionId(prefillData.script!.versionId);
                    setScriptPreview(prefillData.script!.preview);
                    updateField("scriptUrl", "");
                  }}
                  className={[
                    "rounded-lg border px-3 py-1.5",
                    scriptSource === "platform"
                      ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
                      : "border-white/12 text-slate-300",
                  ].join(" ")}
                >
                  Use platform screenplay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScriptSource("upload");
                    setPlatformScriptVersionId(null);
                    setScriptPreview(null);
                  }}
                  className={[
                    "rounded-lg border px-3 py-1.5",
                    scriptSource === "upload"
                      ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
                      : "border-white/12 text-slate-300",
                  ].join(" ")}
                >
                  Upload external PDF
                </button>
              </div>
            )}
            {scriptSource === "platform" && scriptPreview && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {scriptPreview}
                {prefillData?.script && prefillData.script.characterCount > scriptPreview.length ? "…" : null}
              </div>
            )}
            {scriptSource === "upload" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    enqueueMedia("script", file);
                  }}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                />
                {scriptAsset.uploading && (
                  <p className="text-xs text-orange-300">
                    Uploading script (PDF)…
                    {scriptAsset.progress != null ? ` ${Math.round(scriptAsset.progress)}%` : ""}
                  </p>
                )}
                {scriptAsset.done && !scriptAsset.uploading && form.scriptUrl ? (
                  <p className="text-xs text-emerald-400">Script PDF uploaded</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <details className="rounded-lg border border-slate-700/60 bg-slate-900/30 px-3 py-2">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
                    Optional: paste script PDF URL instead
                  </summary>
                  <input
                    value={form.scriptUrl}
                    onChange={(e) => updateField("scriptUrl", e.target.value)}
                    placeholder="https://…"
                    className="mt-2 w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-xs focus:border-orange-500 focus:outline-none transition"
                  />
                </details>
                <p className="text-xs text-slate-500">
                  Accepted format: PDF only.
                </p>
              </div>
            </div>
            )}
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
                  <div className="flex-1 w-full flex flex-col gap-2 min-w-0">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        enqueueMedia("bts", file, { btsIndex: idx });
                      }}
                      className="block w-full max-w-xs text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                    />
                    {uploadJobId &&
                      jobs
                        .find((j) => j.id === uploadJobId)
                        ?.assets.some(
                          (a) =>
                            a.kind === "bts" &&
                            a.meta?.btsIndex === idx &&
                            (a.status === "queued" || a.status === "uploading"),
                        ) && (
                        <span className="text-xs text-slate-400">Uploading…</span>
                      )}
                    <details className="rounded-md border border-slate-700/60 bg-slate-900/40 px-2 py-1.5">
                      <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300 list-none [&::-webkit-details-marker]:hidden">
                        Optional: paste BTS video URL
                      </summary>
                      <input
                        value={b.videoUrl}
                        onChange={(e) =>
                          setBtsVideos((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, videoUrl: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="https://…"
                        className="mt-1.5 w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                      />
                    </details>
                  </div>
                  <div className="flex items-center gap-2">
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

          {longFormUpload && (
            <SeriesEpisodesUpload
              seasonCount={seasonCount}
              episodesPerSeason={episodesPerSeason}
              episodes={episodeDrafts}
              onSeasonCountChange={setSeasonCount}
              onEpisodesPerSeasonChange={setEpisodesPerSeason}
              onEpisodesChange={setEpisodeDrafts}
              onError={setError}
              onUploadEpisode={(seasonNumber, episodeNumber, file) => {
                enqueueMedia("episode", file, {
                  seasonNumber,
                  episodeNumber,
                });
              }}
              episodeUploadProgress={(seasonNumber, episodeNumber) => {
                const asset = uploadJobId
                  ? jobs
                      .find((j) => j.id === uploadJobId)
                      ?.assets.find(
                        (a) =>
                          a.kind === "episode" &&
                          a.meta?.seasonNumber === seasonNumber &&
                          a.meta?.episodeNumber === episodeNumber,
                      )
                  : undefined;
                return {
                  uploading: asset?.status === "queued" || asset?.status === "uploading",
                  progress: asset?.progress ?? null,
                };
              }}
            />
          )}
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
                onChange={(e) => {
                  const rating = e.target.value;
                  updateField("ageRating", rating);
                  const derived = defaultMinAgeForRating(rating);
                  if (derived > 0) setMinAge(derived);
                }}
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
            {(isLongFormType(form.type)) && (
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
          <p className="text-sm text-slate-400">
            Credit everyone who worked on this title — principal cast, ADs, DOP, department heads, and
            post. Industry abbreviations (1st AD, DOP, EP, etc.) are listed with full titles. You can
            add more rows and update credits later from your dashboard.
          </p>
          <div className="space-y-3">
            {crew.map((c, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={c.name}
                  onChange={(e) => updateCrew(i, "name", e.target.value)}
                  placeholder="Full name (as it should appear on screen)"
                  className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:outline-none transition"
                />
                <UploadCreditRoleSelect
                  value={c.role}
                  onChange={(role) => updateCrew(i, "role", role)}
                />
                {crew.length > 1 && (
                  <button onClick={() => removeCrewRow(i)} className="p-2 text-red-400 hover:text-red-300 transition">✕</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addCrewRow} className="text-sm text-orange-400 hover:text-orange-300 transition">
            + Add another cast or crew credit
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
                <div><span className="text-slate-500">Type:</span> <span className="text-white">{form.type ? (CONTENT_TYPE_LABELS[form.type] ?? form.type) : "—"}</span></div>
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

          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-5">
            <h3 className="text-white font-medium mb-2">Release contact & delivery notes</h3>
            <p className="text-xs text-slate-500 mb-4">
              These details help our review team resolve issues quickly and speed up catalogue approval.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Release contact name *</label>
                <input
                  value={releaseContactName}
                  onChange={(e) => setReleaseContactName(e.target.value)}
                  placeholder="Primary release manager"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Release contact email *</label>
                <input
                  value={releaseContactEmail}
                  onChange={(e) => setReleaseContactEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Release contact phone (optional)</label>
                <input
                  value={releaseContactPhone}
                  onChange={(e) => setReleaseContactPhone(e.target.value)}
                  placeholder="+27 …"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Delivery notes (optional)</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={3}
                  placeholder="Version notes, subtitle roadmap, holdbacks, embargoes, or QA notes."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5">
            <h3 className="text-orange-300 font-medium mb-2">Rights & compliance confirmation</h3>
            <p className="text-xs text-slate-400 mb-3">
              Confirm each requirement below before final submission.
            </p>
            <div className="space-y-2">
              {[
                ["rightsOwnershipConfirmed", "I own or control the rights required to distribute this title."],
                ["thirdPartyClearancesConfirmed", "Third-party footage, logos, and likenesses are cleared for release."],
                ["musicRightsConfirmed", "Music rights are cleared (master + publishing where applicable)."],
                ["noUnlicensedBranding", "No unlicensed branding/trademarks remain in the final cut."],
                ["finalMasterReviewed", "Final master was reviewed for sync, audio levels, and technical issues."],
              ].map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-600 bg-slate-900/50 text-orange-500 focus:ring-orange-500/50"
                    checked={Boolean(complianceChecks[key as keyof typeof complianceChecks])}
                    onChange={(e) =>
                      setComplianceChecks((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
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

            </div>

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
                disabled={
                  loading ||
                  !form.title ||
                  !form.type ||
                  !releaseContactName.trim() ||
                  !releaseContactEmail.trim() ||
                  !complianceChecks.rightsOwnershipConfirmed ||
                  !complianceChecks.thirdPartyClearancesConfirmed ||
                  !complianceChecks.musicRightsConfirmed ||
                  !complianceChecks.noUnlicensedBranding ||
                  !complianceChecks.finalMasterReviewed
                }
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
  );
}

export default function DistributionUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <StoryTimeLoader size="sm" hideTrack />
        </div>
      }
    >
      <DistributionUploadInner />
    </Suspense>
  );
}
