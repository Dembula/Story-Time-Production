import { ContentRow } from "@/components/layout/content-row";
import { BrowseSearchWithModoc } from "@/app/browse/browse-search-with-modoc";
import { SearchNotFound } from "./search-not-found";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { VIEWER_MODELS } from "@/lib/viewer-access";
import { rankSearchResults } from "@/lib/browse-search";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

type Props = {
  searchParams: Promise<{ q?: string; type?: string; filter?: string }>;
};

export default async function BrowseSearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = params.type;
  const filter = params.filter;

  let profileAge: number | null = null;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (session?.user?.id && role === "SUBSCRIBER") {
    const cookieStore = await cookies();
    const profileId = cookieStore.get("st_viewer_profile")?.value;
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId: session.user.id },
        select: { age: true, dateOfBirth: true },
      });
      if (profile) profileAge = getViewerProfileAge(profile);
    }
  }

  let isPpvViewer = false;
  if (session?.user?.id && role === "SUBSCRIBER") {
    const latestSubscription = await prisma.viewerSubscription.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { viewerModel: true },
    });
    isPpvViewer = latestSubscription?.viewerModel === VIEWER_MODELS.PPV;
  }

  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};

  const where: Record<string, unknown> = { published: true, ...ageFilter };
  if (type) where.type = type;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
      { category: { contains: q, mode: "insensitive" as const } },
      { tags: { contains: q, mode: "insensitive" as const } },
    ];
  }

  let results: Awaited<
    ReturnType<
      typeof prisma.content.findMany<{
        include: { _count: { select: { ratings: true } }; creator: { select: { name: true } } };
      }>
    >
  > = [];
  let resultCount = 0;

  if (q) {
    try {
      const pool = await prisma.content.findMany({
        where,
        take: 48,
        include: {
          _count: { select: { ratings: true } },
          creator: { select: { name: true } },
        },
      });
      results = rankSearchResults(pool, q).slice(0, 24);
      resultCount = pool.length;
    } catch {
      // keep empty results
    }
  }

  const withPoster = results.map((c) => ({
    ...c,
    posterUrl: getDisplayPosterUrl(c) ?? c.posterUrl,
  }));

  return (
    <div className="min-h-[60vh] pb-16">
      <div className="mx-auto max-w-[1800px] px-4 md:px-12">
        <BrowseSearchWithModoc defaultSearch={q} type={type} filter={filter} sticky />

        {!q && (
          <div className="py-12 text-center">
            <p className="text-lg font-medium text-white">What would you like to watch?</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Search our catalogue of films, series, shows, and podcasts. Start typing and we&apos;ll suggest titles from our library.
            </p>
          </div>
        )}

        {q && withPoster.length > 0 && (
          <div className="mt-2">
            <div className="storytime-panel mb-6 rounded-2xl p-4">
              <p className="text-slate-300">
                Results for{" "}
                <span className="font-semibold text-white">&ldquo;{q}&rdquo;</span>
                <span className="ml-2 text-slate-400">
                  — {resultCount} title{resultCount !== 1 ? "s" : ""} found
                </span>
              </p>
            </div>
            <ContentRow
              title="Search results"
              subtitle={`${withPoster.length} matching title${withPoster.length !== 1 ? "s" : ""}`}
              contents={withPoster}
              ppvMode={isPpvViewer}
            />
          </div>
        )}

        {q && withPoster.length === 0 && <SearchNotFound query={q} />}
      </div>
    </div>
  );
}
