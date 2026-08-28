"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle,
  FileText,
  MapPin,
  MessageCircle,
  Send,
  Users,
} from "lucide-react";
import { BackButton } from "@/components/layout/back-button";
import {
  CreatorProjectContextBanner,
  useCreatorProjectContext,
  usePrefillProjectName,
} from "@/components/creator/creator-project-context";
import { SecureImage } from "@/components/files/secure-image";
import { fetchMarketplaceList, postMarketplaceJson } from "@/lib/creator-marketplace-fetch";
import {
  getMarketplaceCategory,
  type MarketplaceCategoryId,
} from "@/lib/marketplace-hub";
import { getProjectToolHref } from "@/lib/project-tools";
import { formatZar } from "@/lib/format-currency-zar";
import { cn } from "@/lib/utils";

type TalentRow = {
  id: string;
  name: string;
  plainBio?: string | null;
  bio?: string | null;
  headshotUrl?: string | null;
  previewImageUrl?: string | null;
  ageRange?: string | null;
  skills?: string | null;
  pastWork?: string | null;
  profile?: { dailyRate?: number | null; location?: string | null } | null;
};

type CrewMemberRow = {
  id: string;
  name: string;
  role: string;
  department?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  dailyRate?: number | null;
};

type ListingDetail = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  type?: string | null;
  category?: string | null;
  dailyRate?: number | null;
  amenities?: string | null;
  photoUrls?: string | null;
  imageUrl?: string | null;
  previewImageUrl?: string | null;
  galleryUrls?: string[];
  menuHighlights?: string[];
  serviceTypes?: string[];
  specializations?: string | null;
  user?: { id: string; name?: string | null; email?: string | null };
  company?: { id?: string; name?: string | null; email?: string | null };
  talent?: TalentRow[];
  members?: CrewMemberRow[];
  _count?: { talent?: number; members?: number; bookings?: number };
};

function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const CATEGORY_QUERY: Record<
  MarketplaceCategoryId,
  { detailApi: (id: string) => string; toolSlug: string; accent: "violet" | "emerald" | "orange" | "cyan" | "amber" }
> = {
  casting: {
    detailApi: (id) => `/api/casting-agencies/${id}`,
    toolSlug: "casting-portal",
    accent: "violet",
  },
  crew: {
    detailApi: (id) => `/api/crew-teams/${id}`,
    toolSlug: "crew-marketplace",
    accent: "emerald",
  },
  locations: {
    detailApi: (id) => `/api/locations`,
    toolSlug: "location-marketplace",
    accent: "amber",
  },
  equipment: {
    detailApi: (id) => `/api/equipment`,
    toolSlug: "equipment-planning",
    accent: "amber",
  },
  catering: {
    detailApi: (id) => `/api/catering-companies/${id}`,
    toolSlug: "on-set-catering",
    accent: "orange",
  },
};

function normalizeDetail(categoryId: MarketplaceCategoryId, raw: Record<string, unknown>): ListingDetail {
  if (categoryId === "casting") {
    return {
      id: String(raw.id),
      title: String(raw.agencyName ?? "Casting agency"),
      subtitle: (raw.tagline as string) ?? null,
      description: (raw.description as string) ?? null,
      city: (raw.city as string) ?? null,
      country: (raw.country as string) ?? null,
      user: raw.user as ListingDetail["user"],
      talent: (raw.talent as TalentRow[]) ?? [],
      _count: raw._count as ListingDetail["_count"],
    };
  }
  if (categoryId === "crew") {
    return {
      id: String(raw.id),
      title: String(raw.companyName ?? "Crew team"),
      subtitle: (raw.tagline as string) ?? (raw.specializations as string) ?? null,
      description: (raw.description as string) ?? null,
      city: (raw.city as string) ?? null,
      country: (raw.country as string) ?? null,
      user: raw.user as ListingDetail["user"],
      members: (raw.members as CrewMemberRow[]) ?? [],
      _count: raw._count as ListingDetail["_count"],
    };
  }
  if (categoryId === "locations") {
    const gallery = parsePhotoUrls(raw.photoUrls as string | undefined);
    return {
      id: String(raw.id),
      title: String(raw.name ?? "Location"),
      subtitle: (raw.type as string) ?? null,
      description: (raw.description as string) ?? null,
      city: (raw.city as string) ?? null,
      country: (raw.country as string) ?? null,
      type: (raw.type as string) ?? null,
      dailyRate: typeof raw.dailyRate === "number" ? raw.dailyRate : null,
      amenities: (raw.amenities as string) ?? null,
      photoUrls: (raw.photoUrls as string) ?? null,
      previewImageUrl: (raw.previewImageUrl as string) ?? gallery[0] ?? null,
      galleryUrls: gallery,
      company: raw.company as ListingDetail["company"],
    };
  }
  if (categoryId === "equipment") {
    const image = (raw.previewImageUrl as string) ?? (raw.imageUrl as string) ?? null;
    return {
      id: String(raw.id),
      title: String(raw.companyName ?? "Equipment"),
      subtitle: (raw.category as string) ?? null,
      description: (raw.plainDescription as string) ?? (raw.description as string) ?? null,
      location: (raw.location as string) ?? null,
      category: (raw.category as string) ?? null,
      dailyRate: typeof raw.dailyRate === "number" ? raw.dailyRate : null,
      previewImageUrl: image,
      galleryUrls: image ? [image] : [],
      company: raw.company as ListingDetail["company"],
    };
  }
  const profile = raw.profile as Record<string, unknown> | undefined;
  const gallery = (profile?.galleryUrls as string[] | undefined) ?? [];
  return {
    id: String(raw.id),
    title: String(raw.companyName ?? "Catering"),
    subtitle: (raw.tagline as string) ?? null,
    description:
      (profile?.plainDescription as string) ?? (raw.description as string) ?? (raw.specializations as string) ?? null,
    city: (raw.city as string) ?? null,
    country: (raw.country as string) ?? null,
    previewImageUrl: (raw.previewImageUrl as string) ?? (raw.logoUrl as string) ?? gallery[0] ?? null,
    galleryUrls: gallery,
    menuHighlights: (profile?.menuHighlights as string[]) ?? [],
    serviceTypes: (profile?.serviceTypes as string[]) ?? [],
    specializations: (raw.specializations as string) ?? null,
    user: raw.user as ListingDetail["user"],
    _count: raw._count as ListingDetail["_count"],
  };
}

export function MarketplaceListingDetail({
  categoryId,
  listingId,
}: {
  categoryId: MarketplaceCategoryId;
  listingId: string;
}) {
  const category = getMarketplaceCategory(categoryId)!;
  const Icon = category.icon;
  const cfg = CATEGORY_QUERY[categoryId];
  const { projectId, projectTitle } = useCreatorProjectContext({
    phase: "PRE_PRODUCTION",
    toolSlug: cfg.toolSlug,
  });
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    projectName: "",
    roleName: "",
    message: "",
    talentId: "",
    memberId: "",
  });

  usePrefillProjectName(projectTitle, (title) => {
    setForm((f) => (f.projectName.trim() ? f : { ...f, projectName: title }));
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (categoryId === "locations" || categoryId === "equipment") {
          const { data, error: listError } = await fetchMarketplaceList<Record<string, unknown>>(category.listApi);
          if (listError) throw new Error(listError);
          const row = data.find((r) => String(r.id) === listingId);
          if (!row) throw new Error("Listing not found");
          if (!cancelled) setDetail(normalizeDetail(categoryId, row));
        } else {
          const res = await fetch(cfg.detailApi(listingId));
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error || "Listing not found");
          if (!cancelled) setDetail(normalizeDetail(categoryId, data));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load listing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, listingId, category.listApi, cfg]);

  useEffect(() => {
    const talentId = searchParams.get("talentId");
    const memberId = searchParams.get("memberId");
    if (talentId) setForm((f) => ({ ...f, talentId }));
    if (memberId) setForm((f) => ({ ...f, memberId }));
  }, [searchParams]);

  const locationLabel = useMemo(() => {
    if (!detail) return null;
    if (detail.location) return detail.location;
    return [detail.city, detail.country].filter(Boolean).join(", ") || null;
  }, [detail]);

  const contractsHref = projectId
    ? getProjectToolHref(projectId, { phase: "PRE_PRODUCTION", toolSlug: "legal-contracts" })
    : "/creator/pre/legal-contracts";

  const browseHref = projectId
    ? `${category.browsePath}?projectId=${encodeURIComponent(projectId)}`
    : category.browsePath;

  const submitInquiry = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    try {
      if (categoryId === "casting") {
        const { error } = await postMarketplaceJson("/api/casting-agencies/inquiries", {
          agencyId: detail.id,
          projectId: projectId || undefined,
          projectName: form.projectName || projectTitle || undefined,
          roleName: form.roleName || undefined,
          message: form.message || undefined,
          talentId: form.talentId || undefined,
        });
        if (error) throw new Error(error);
        setSuccess(
          form.talentId
            ? "Free inquiry sent for the selected talent. No payment required — the agency will respond, and you can message once they accept the deal."
            : "Free inquiry sent. No payment required — select talent above to request a specific actor, or message once the agency accepts your deal.",
        );
      } else if (categoryId === "crew") {
        const member = detail.members?.find((m) => m.id === form.memberId);
        const crewMessage = [
          form.message,
          member ? `Interested in working with crew member: ${member.name} (${member.role})` : null,
        ]
          .filter(Boolean)
          .join("\n\n");
        const { error } = await postMarketplaceJson("/api/crew-teams/requests", {
          crewTeamId: detail.id,
          projectId: projectId || undefined,
          projectName: form.projectName || projectTitle || undefined,
          message: crewMessage || undefined,
        });
        if (error) throw new Error(error);
        setSuccess(
          member
            ? `Free crew request sent for ${member.name}. No payment required — message opens once the team accepts your deal.`
            : "Free crew request sent. No payment required — pick a crew member above to name someone specific, or message once the team accepts.",
        );
      } else {
        window.location.href = `${browseHref}${browseHref.includes("?") ? "&" : "?"}${
          categoryId === "locations"
            ? `locationId=${detail.id}`
            : categoryId === "equipment"
              ? `equipmentId=${detail.id}`
              : `companyId=${detail.id}`
        }`;
        return;
      }
      setTimeout(() => setSuccess(""), 8000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, [detail, categoryId, projectId, projectTitle, form, browseHref]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <BackButton fallback="/creator/marketplace" />
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error || "Listing not found"}
        </p>
        <Link href="/creator/marketplace" className="mt-4 inline-flex text-sm text-orange-300 hover:text-orange-200">
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <BackButton fallback={browseHref} />
      <CreatorProjectContextBanner phase="PRE_PRODUCTION" toolSlug={cfg.toolSlug} accent={cfg.accent} />

      {success ? (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{success}</p>
            {projectId ? (
              <Link href={contractsHref} className="mt-2 inline-flex items-center gap-1 text-orange-300 hover:text-orange-200">
                Open Legal Contracts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black">
        <div className={cn("relative flex min-h-[200px] items-end p-6 md:p-8", category.accentBg)}>
          {detail.previewImageUrl || detail.imageUrl ? (
            <SecureImage
              fileRef={detail.previewImageUrl || detail.imageUrl || ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          ) : null}
          <div className="relative z-10 flex w-full flex-wrap items-end justify-between gap-4">
            <div>
              <span
                className={cn(
                  "mb-3 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  category.accentBorder,
                  category.accent,
                  category.accentBg,
                )}
              >
                {category.shortLabel}
              </span>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {detail.title}
              </h1>
              {detail.subtitle ? <p className="mt-2 text-sm text-slate-300">{detail.subtitle}</p> : null}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                {locationLabel ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {locationLabel}
                  </span>
                ) : null}
                {detail.dailyRate != null ? <span>From {formatZar(detail.dailyRate)} / day</span> : null}
                {detail.talent?.length ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {detail.talent.length} talent
                  </span>
                ) : null}
                {detail.members?.length ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {detail.members.length} crew
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-black/40">
              <Icon className={cn("h-8 w-8", category.accent)} />
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">About</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {detail.description?.trim() || "No description provided yet."}
              </p>
              {detail.amenities ? (
                <p className="mt-3 text-xs text-slate-500">Amenities: {detail.amenities}</p>
              ) : null}
            </section>

            {detail.talent && detail.talent.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Talent roster</h2>
                <p className="mt-1 text-xs text-slate-500">Select an actor to include them in your casting inquiry.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {detail.talent.map((t) => {
                    const selected = form.talentId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, talentId: selected ? "" : t.id }))}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          selected
                            ? "border-orange-500/40 bg-orange-500/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20",
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                            {t.headshotUrl || t.previewImageUrl ? (
                              <SecureImage
                                fileRef={t.headshotUrl || t.previewImageUrl || ""}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-slate-500">
                                <Users className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{t.name}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                              {t.plainBio || t.bio || t.skills || "Talent"}
                            </p>
                            {t.profile?.dailyRate != null ? (
                              <p className="mt-1 text-[11px] text-orange-300/90">{formatZar(t.profile.dailyRate)}/day</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : categoryId === "casting" ? (
              <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">
                This agency has not published talent profiles yet. You can still send a general inquiry.
              </section>
            ) : null}

            {detail.galleryUrls && detail.galleryUrls.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  {categoryId === "locations" ? "Location photos" : categoryId === "catering" ? "Gallery" : "Photos"}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {detail.galleryUrls.map((url) => (
                    <div key={url} className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-slate-900">
                      <SecureImage fileRef={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {detail.menuHighlights && detail.menuHighlights.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Menu highlights</h2>
                <ul className="mt-3 space-y-2">
                  {detail.menuHighlights.map((item) => (
                    <li key={item} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.serviceTypes && detail.serviceTypes.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Services</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.serviceTypes.map((s) => (
                    <span key={s} className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-0.5 text-xs text-orange-200">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {detail.members && detail.members.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Crew members</h2>
                <p className="mt-1 text-xs text-slate-500">Optional — select someone specific for your request.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {detail.members.map((m) => {
                    const selected = form.memberId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, memberId: selected ? "" : m.id }))}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          selected
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20",
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                            {m.photoUrl ? (
                              <SecureImage fileRef={m.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-slate-500">
                                <Users className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{m.name}</p>
                            <p className="text-[11px] text-slate-400">
                              {[m.role, m.department].filter(Boolean).join(" · ")}
                            </p>
                            {m.dailyRate != null ? (
                              <p className="mt-1 text-[11px] text-orange-300">{formatZar(m.dailyRate)}/day</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : categoryId === "crew" ? (
              <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">
                This crew team has not published member profiles yet. You can still send a general request.
              </section>
            ) : null}

            <section className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-orange-200">
                <FileText className="h-4 w-4" /> Production flow
              </h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-400">
                <li>Send a free inquiry or booking request linked to your project — no payment at this step.</li>
                <li>Once the stakeholder accepts or approves, coordinate in Messages.</li>
                <li>When you are ready to confirm the deal, pay through escrow — then Story Time syncs roster, vendors, and draft contracts.</li>
                <li>Review, send for e-sign, and manage everything in Legal Contracts.</li>
              </ol>
              {projectId ? (
                <Link
                  href={contractsHref}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-300 hover:text-orange-200"
                >
                  Open Legal Contracts workspace <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Link a project from the marketplace hub so deals update that production automatically.
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
              <h2 className="text-sm font-semibold text-white">
                {categoryId === "casting"
                  ? "Send casting inquiry"
                  : categoryId === "crew"
                    ? "Request this crew team"
                    : "Continue to booking"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {projectTitle
                  ? `Linked to ${projectTitle} · inquiries are free`
                  : "Add a project name — inquiries and requests never require payment upfront."}
              </p>

              {(categoryId === "casting" || categoryId === "crew") && (
                <div className="mt-4 space-y-3">
                  <input
                    value={form.projectName}
                    onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                    placeholder="Project name"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                  {categoryId === "casting" ? (
                    <input
                      value={form.roleName}
                      onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))}
                      placeholder="Role name"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                    />
                  ) : null}
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Message"
                    rows={4}
                    className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                  {form.talentId ? (
                    <p className="text-[11px] text-violet-300">
                      Targeting talent: {detail.talent?.find((t) => t.id === form.talentId)?.name}
                    </p>
                  ) : null}
                  {form.memberId ? (
                    <p className="text-[11px] text-emerald-300">
                      Targeting crew: {detail.members?.find((m) => m.id === form.memberId)?.name}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitInquiry()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {busy ? "Sending…" : categoryId === "casting" ? "Send inquiry" : "Send request"}
                  </button>
                </div>
              )}

              {categoryId !== "casting" && categoryId !== "crew" ? (
                <button
                  type="button"
                  onClick={() => void submitInquiry()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Open booking workspace <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400">
              <p className="flex items-center gap-2 font-medium text-slate-300">
                <Building2 className="h-3.5 w-3.5" /> Contact
              </p>
              <p className="mt-2">
                {detail.user?.email || detail.company?.email || "Available after you inquire"}
              </p>
              <Link
                href={browseHref}
                className="mt-3 inline-flex items-center gap-1 text-orange-300 hover:text-orange-200"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Browse all {category.shortLabel.toLowerCase()}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
