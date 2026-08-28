"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Film,
  Search,
  Sparkles,
  Store,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMarketplaceList } from "@/lib/creator-marketplace-fetch";
import {
  getMarketplaceCategory,
  MARKETPLACE_CATEGORIES,
  marketplaceBrowseHref,
  matchesMarketplaceSearch,
  normalizeCastingAgency,
  normalizeCateringCompany,
  normalizeCrewTeam,
  normalizeEquipment,
  normalizeLocation,
  type MarketplaceCategoryId,
  type MarketplaceStoreCard,
} from "@/lib/marketplace-hub";
import {
  useActiveProjectId,
  useDefaultCreatorProjectId,
  useOrderedCreatorProjects,
} from "@/hooks/use-active-project";
import { setActiveProjectId } from "@/lib/active-project";
import { getProjectToolHref } from "@/lib/project-tools";

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
};

const WORKSPACE_TOOL_BY_CATEGORY: Record<MarketplaceCategoryId, string> = {
  casting: "casting-portal",
  crew: "crew-marketplace",
  locations: "location-marketplace",
  equipment: "equipment-planning",
  catering: "on-set-catering",
};

function StoreCard({ card }: { card: MarketplaceStoreCard }) {
  const category = getMarketplaceCategory(card.categoryId)!;
  const Icon = category.icon;

  return (
    <Link
      href={card.href}
      className={`group flex min-w-[260px] max-w-[280px] flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.06] to-black/40 transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_50px_-30px_rgba(249,115,22,0.45)] ${category.accentBorder}`}
    >
      <div className={`relative flex h-32 items-center justify-center ${category.accentBg}`}>
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="h-full w-full object-cover opacity-90" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
            <Icon className={`h-7 w-7 ${category.accent}`} />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${category.accentBg} ${category.accent} ${category.accentBorder}`}
        >
          {category.shortLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-white group-hover:text-orange-100">{card.title}</h3>
        {card.subtitle ? <p className="mt-1 line-clamp-1 text-xs text-slate-400">{card.subtitle}</p> : null}
        {card.location ? (
          <p className="mt-2 line-clamp-1 text-xs text-slate-500">{card.location}</p>
        ) : null}
        {card.meta ? <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">{card.meta}</p> : null}
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-orange-300 opacity-0 transition group-hover:opacity-100">
          Open listing <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function CategoryRow({
  categoryId,
  cards,
  projectId,
  loading,
}: {
  categoryId: MarketplaceCategoryId;
  cards: MarketplaceStoreCard[];
  projectId: string | null;
  loading: boolean;
}) {
  const category = getMarketplaceCategory(categoryId)!;
  const Icon = category.icon;
  const workspaceHref =
    projectId && categoryId !== "catering"
      ? getProjectToolHref(projectId, { phase: "PRE_PRODUCTION", toolSlug: WORKSPACE_TOOL_BY_CATEGORY[categoryId] })
      : projectId && categoryId === "catering"
        ? getProjectToolHref(projectId, { phase: "PRODUCTION", toolSlug: "on-set-catering" })
        : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${category.accentBorder} ${category.accentBg}`}>
              <Icon className={`h-4 w-4 ${category.accent}`} />
            </div>
            <h2 className="text-lg font-semibold text-white md:text-xl">{category.label}</h2>
          </div>
          <p className="max-w-2xl text-sm text-slate-400">{category.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workspaceHref ? (
            <Link
              href={workspaceHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.07]"
            >
              Project workspace
            </Link>
          ) : null}
          <Link
            href={marketplaceBrowseHref(category, projectId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-2 text-xs font-semibold text-orange-200 ring-1 ring-orange-400/25 hover:bg-orange-500/20"
          >
            {category.browseLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 min-w-[260px] rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="storytime-empty-state rounded-2xl border border-dashed border-white/10 p-8 text-sm text-slate-500">
          No {category.shortLabel.toLowerCase()} listings match your search yet. Try another term or browse the full directory.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cards.map((card) => (
            <StoreCard key={`${card.categoryId}-${card.id}`} card={card} />
          ))}
          <Link
            href={marketplaceBrowseHref(category, projectId)}
            className="flex min-w-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center transition hover:border-orange-400/30 hover:bg-orange-500/5"
          >
            <Building2 className="mb-3 h-8 w-8 text-slate-500" />
            <p className="text-sm font-medium text-white">View all companies</p>
            <p className="mt-1 text-xs text-slate-500">Full directory, filters, and booking</p>
          </Link>
        </div>
      )}
    </section>
  );
}

export function UnifiedMarketplaceHub() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategoryId | "all">(
    initialCategory && getMarketplaceCategory(initialCategory) ? (initialCategory as MarketplaceCategoryId) : "all",
  );

  const { data: projectsPayload, isLoading: projectsLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });
  const projects = (projectsPayload?.projects ?? []) as Project[];
  const activeProjectId = useActiveProjectId();
  const defaultProjectId = useDefaultCreatorProjectId(projects);
  const orderedProjects = useOrderedCreatorProjects(projects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const projectId = selectedProjectId || defaultProjectId || activeProjectId || null;
  const selectedProject = projectId ? projects.find((p) => p.id === projectId) : undefined;

  const catalogQuery = useQuery({
    queryKey: ["marketplace-hub-catalog"],
    queryFn: async () => {
      const [casting, crew, locations, equipment, catering] = await Promise.all([
        fetchMarketplaceList("/api/casting-agencies"),
        fetchMarketplaceList("/api/crew-teams"),
        fetchMarketplaceList("/api/locations"),
        fetchMarketplaceList("/api/equipment"),
        fetchMarketplaceList("/api/catering-companies"),
      ]);
      return { casting, crew, locations, equipment, catering };
    },
  });

  const cardsByCategory = useMemo(() => {
    const pid = projectId ?? undefined;
    const casting = (catalogQuery.data?.casting.data ?? []).map((row) =>
      normalizeCastingAgency(row as Parameters<typeof normalizeCastingAgency>[0], pid),
    );
    const crew = (catalogQuery.data?.crew.data ?? []).map((row) =>
      normalizeCrewTeam(row as Parameters<typeof normalizeCrewTeam>[0], pid),
    );
    const locations = (catalogQuery.data?.locations.data ?? []).map((row) =>
      normalizeLocation(row as Parameters<typeof normalizeLocation>[0], pid),
    );
    const equipment = (catalogQuery.data?.equipment.data ?? []).map((row) =>
      normalizeEquipment(row as Parameters<typeof normalizeEquipment>[0], pid),
    );
    const catering = (catalogQuery.data?.catering.data ?? []).map((row) =>
      normalizeCateringCompany(row as Parameters<typeof normalizeCateringCompany>[0], pid),
    );

    const filterCards = (cards: MarketplaceStoreCard[]) =>
      cards.filter((card) => matchesMarketplaceSearch(card, search));

    return {
      casting: filterCards(casting),
      crew: filterCards(crew),
      locations: filterCards(locations),
      equipment: filterCards(equipment),
      catering: filterCards(catering),
    };
  }, [catalogQuery.data, projectId, search]);

  const visibleCategories = MARKETPLACE_CATEGORIES.filter(
    (category) => activeCategory === "all" || category.id === activeCategory,
  );

  const totalListings = Object.values(cardsByCategory).reduce((sum, rows) => sum + rows.length, 0);

  function handleProjectChange(nextId: string) {
    setSelectedProjectId(nextId);
    setActiveProjectId(nextId || null);
  }

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/10 via-black to-violet-500/10 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/90">
            <Store className="h-3.5 w-3.5" />
            Production marketplace
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Hire the teams behind your film
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
            One storefront for casting agencies, crew companies, locations, equipment vendors, and catering partners.
            Link a project first so inquiries, bookings, and requests stay attached to the right production.
          </p>
        </div>
      </header>

      <section className="storytime-section grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)] md:p-6">
        <div>
          <label htmlFor="marketplace-search" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search the marketplace
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="marketplace-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies, locations, gear, cities, specialties…"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-orange-400/40 focus:outline-none focus:ring-1 focus:ring-orange-400/30"
            />
          </div>
        </div>
        <div>
          <label htmlFor="marketplace-project" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active project
          </label>
          {projectsLoading ? (
            <Skeleton className="h-11 rounded-xl bg-white/[0.06]" />
          ) : (
            <div className="relative">
              <Film className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-300/80" />
              <select
                id="marketplace-project"
                value={projectId ?? ""}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white focus:border-orange-400/40 focus:outline-none focus:ring-1 focus:ring-orange-400/30"
              >
                <option value="">No project selected</option>
                {orderedProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedProject ? (
            <p className="mt-2 text-xs text-emerald-300/90">
              Requests and bookings will link to <span className="font-medium text-white">{selectedProject.title}</span>.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Select a project to attach marketplace activity to a production.</p>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            activeCategory === "all"
              ? "bg-orange-500 text-white shadow-glow"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
          }`}
        >
          All departments
        </button>
        {MARKETPLACE_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = cardsByCategory[category.id].length;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeCategory === category.id
                  ? "bg-orange-500 text-white shadow-glow"
                  : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {category.shortLabel}
              <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="storytime-kpi p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Listings visible</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalListings}</p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Departments</p>
          <p className="mt-1 text-2xl font-bold text-white">{MARKETPLACE_CATEGORIES.length}</p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-orange-300" /> Workflow
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Browse here, then open a category for full messaging, quotes, and checkout.
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {visibleCategories.map((category) => (
          <CategoryRow
            key={category.id}
            categoryId={category.id}
            cards={cardsByCategory[category.id].slice(0, 12)}
            projectId={projectId}
            loading={catalogQuery.isLoading}
          />
        ))}
      </div>
    </div>
  );
}
