import { Hero } from "@/components/layout/hero";
import { ContentRow } from "@/components/layout/content-row";
import { MusicRow } from "@/components/layout/music-row";
import { RecommendationsRow } from "@/components/layout/recommendations-row";
import { BrowseSearchWithModoc } from "@/app/browse/browse-search-with-modoc";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const type = params.type;
  const search = params.search;
  const filter = params.filter;

  let profileAge: number | null = null;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (session?.user?.id && role === "SUBSCRIBER") {
    const profileId = cookies().get("st_viewer_profile")?.value;
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId: session.user.id },
        select: { age: true },
      });
      if (profile) profileAge = profile.age;
    }
  }

  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};

  const where: Record<string, unknown> = { published: true, ...ageFilter };
  if (type) where.type = type;
  if (search) {
    const searchTerm = search.trim();
    where.OR = [
      { title: { contains: searchTerm, mode: "insensitive" as const } },
      { description: { contains: searchTerm, mode: "insensitive" as const } },
      { category: { contains: searchTerm, mode: "insensitive" as const } },
      { tags: { contains: searchTerm, mode: "insensitive" as const } },
    ];
  }

  type ContentWithCount = Awaited<ReturnType<typeof prisma.content.findMany<{ include: { _count: { select: { ratings: true } } } }>>>[number];
  type MostPopularItem = ContentWithCount & { _avgRating: number; ratings: { score: number }[] };

  let featured: ContentWithCount[] = [];
  let mostPopular: MostPopularItem[] = [];
  let trending: ContentWithCount[] = [];
  let movies: ContentWithCount[] = [];
  let series: ContentWithCount[] = [];
  let animated: ContentWithCount[] = [];
  let shows: ContentWithCount[] = [];
  let liveMusic: ContentWithCount[] = [];
  let comedyShows: ContentWithCount[] = [];
  let podcasts: ContentWithCount[] = [];
  let musicTracks: Awaited<ReturnType<typeof prisma.musicTrack.findMany>> = [];
  let afdaContent: ContentWithCount[] = [];
  let afdaMusic: Awaited<ReturnType<typeof prisma.musicTrack.findMany>> = [];
  let allCount = 0;
  let loadError = false;

  try {
    const results = await Promise.all([
      prisma.content.findMany({
        where: { ...where, featured: true },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where,
        take: 8,
        include: {
          _count: { select: { ratings: true } },
          ratings: true,
        },
      }).then((list) =>
        list
          .map((c) => ({
            ...c,
            _avgRating:
              c.ratings.length > 0
                ? c.ratings.reduce((s, r) => s + r.score, 0) / c.ratings.length
                : 0,
          }))
          .sort((a, b) => {
            const scoreA = a._avgRating * 2 + (a._count?.ratings ?? 0) * 0.1;
            const scoreB = b._avgRating * 2 + (b._count?.ratings ?? 0) * 0.1;
            return scoreB - scoreA;
          })
          .slice(0, 8)
      ),
      prisma.content.findMany({
        where,
        take: 16,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "MOVIE", category: { not: "Animated Film" } },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SERIES" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "MOVIE", category: "Animated Film" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SHOW" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SHOW", category: "Live Music" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SHOW", category: "Comedy" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "PODCAST" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.musicTrack.findMany({
        where: { published: true },
        orderBy: { createdAt: "desc" },
        take: 16,
      }),
      prisma.content.findMany({
        where: { ...where, creator: { isAfdaStudent: true } },
        take: 16,
        include: { _count: { select: { ratings: true } }, creator: { select: { name: true, isAfdaStudent: true } } },
      }),
      prisma.musicTrack.findMany({
        where: { published: true, creator: { isAfdaStudent: true } },
        orderBy: { createdAt: "desc" },
        take: 16,
      }),
      prisma.content.count({ where }),
    ]);
    featured = results[0];
    mostPopular = results[1];
    trending = results[2];
    movies = results[3];
    series = results[4];
    animated = results[5];
    shows = results[6];
    liveMusic = results[7];
    comedyShows = results[8];
    podcasts = results[9];
    musicTracks = results[10];
    afdaContent = results[11];
    afdaMusic = results[12];
    allCount = results[13];
  } catch (err) {
    loadError = true;
    if (process.env.NODE_ENV === "development") {
      console.error("Browse page database error:", err);
    }
  }

  // Hero: Most popular films (or featured if no popular)
  const heroContent =
    mostPopular.length > 0
      ? mostPopular.slice(0, 5).map(({ ratings: _r, _avgRating: _a, ...c }) => c)
      : featured;

  return (
    <div className="pb-16">
      {loadError && (
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 pt-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            Content could not be loaded. Check that <code className="bg-slate-800/80 px-1 rounded">DATABASE_URL</code> in .env uses Neon&apos;s pooler port <strong>6543</strong> (e.g. <code className="bg-slate-800/80 px-1 rounded">...neon.tech:6543/neondb</code>), then restart the dev server.
          </div>
        </div>
      )}
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 pt-6">
        <BrowseSearchWithModoc defaultSearch={search} type={type} filter={filter} />
      </div>
      <Hero content={heroContent} />

      <div className="max-w-[1800px] mx-auto px-6 md:px-12 -mt-16 relative z-10">
        {search && (
          <div className="mb-8 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <p className="text-slate-300">
              Showing results for{" "}
              <span className="font-semibold text-white">&quot;{search}&quot;</span>
              {allCount > 0 && (
                <span className="text-slate-400 ml-2">
                  — {allCount} title{allCount !== 1 ? "s" : ""} found
                </span>
              )}
            </p>
          </div>
        )}

        {type && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white capitalize">
              {type.toLowerCase()}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Browse our collection of {type.toLowerCase()}
            </p>
          </div>
        )}

        {filter === "afda" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Student Films</h2>
              <p className="text-slate-400 text-sm mt-1">Student works from emerging filmmakers</p>
            </div>
            {afdaContent.length > 0 && (
              <ContentRow
                title="Student Films & Series"
                subtitle="Award-winning student productions"
                contents={afdaContent}
              />
            )}
            {afdaMusic.length > 0 && (
              <MusicRow
                title="Student Music"
                subtitle="Emerging sound designers and composers"
                tracks={afdaMusic}
              />
            )}
            {afdaContent.length === 0 && afdaMusic.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-slate-400">No student films yet. Check back soon.</p>
              </div>
            )}
          </>
        )}

        {filter === "music" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Music Library</h2>
              <p className="text-slate-400 text-sm mt-1">Tracks from indie creators available for sync licensing & streaming</p>
            </div>
            {musicTracks.length > 0 && (
              <MusicRow
                title="All Music"
                subtitle="Browse the full catalogue"
                tracks={musicTracks}
              />
            )}
            {afdaMusic.length > 0 && (
              <MusicRow
                title="Student Music"
                subtitle="Emerging sound designers and composers"
                tracks={afdaMusic}
              />
            )}
            {musicTracks.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-slate-400">No music tracks yet. Check back soon.</p>
              </div>
            )}
          </>
        )}

        {!type && !search && !filter && (
          <>
            <RecommendationsRow />
            {mostPopular.length > 0 && (
              <ContentRow
                title="Most Popular on Story Time"
                subtitle="Top films by ratings and engagement"
                contents={mostPopular.map(({ ratings, _avgRating, ...c }) => ({
                  ...c,
                  _count: c._count,
                }))}
              />
            )}
            {trending.length > 0 && (
              <ContentRow
                title="Trending Now"
                subtitle="Popular titles this week"
                contents={trending}
              />
            )}
            {movies.length > 0 && (
              <ContentRow
                title="Movies"
                subtitle="Feature films and documentaries"
                contents={movies}
              />
            )}
            {series.length > 0 && (
              <ContentRow
                title="Series"
                subtitle="Binge-worthy shows"
                contents={series}
              />
            )}
            {animated.length > 0 && (
              <ContentRow
                title="Animated Films"
                subtitle="Family favorites and animated adventures"
                contents={animated}
              />
            )}
            {shows.length > 0 && (
              <ContentRow
                title="Shows"
                subtitle="Variety and entertainment"
                contents={shows}
              />
            )}
            {liveMusic.length > 0 && (
              <ContentRow
                title="Live Music"
                subtitle="Concert recordings and performances"
                contents={liveMusic}
              />
            )}
            {comedyShows.length > 0 && (
              <ContentRow
                title="Comedy Shows"
                subtitle="Stand-up and sketch comedy"
                contents={comedyShows}
              />
            )}
            {podcasts.length > 0 && (
              <ContentRow
                title="Podcasts"
                subtitle="Conversations and stories"
                contents={podcasts}
              />
            )}
            {afdaContent.length > 0 && (
              <ContentRow
                title="Student Films"
                subtitle="Student works from emerging filmmakers"
                contents={afdaContent}
              />
            )}
            {musicTracks.length > 0 && (
              <MusicRow
                title="Music Catalogue"
                subtitle="Tracks from indie creators for sync & streaming"
                tracks={musicTracks}
              />
            )}
            {afdaMusic.length > 0 && (
              <MusicRow
                title="Student Music"
                subtitle="Emerging sound designers and composers"
                tracks={afdaMusic}
              />
            )}
          </>
        )}

        {(type || search) && !filter && (
          <>
            {type && !search && (
              <ContentRow
                title={type === "MOVIE" ? "Movies" : type === "SERIES" ? "Series" : type === "SHOW" ? "Shows" : type === "PODCAST" ? "Podcasts" : type}
                subtitle={
                  type === "MOVIE"
                    ? "Feature films and documentaries"
                    : type === "SERIES"
                      ? "Binge-worthy shows"
                      : type === "SHOW"
                        ? "Variety and entertainment"
                        : type === "PODCAST"
                          ? "Conversations and stories"
                          : `All ${type.toLowerCase()}`
                }
                contents={trending}
              />
            )}
            {search && trending.length > 0 && (
              <ContentRow
                title="Search results"
                subtitle={`${allCount} title${allCount !== 1 ? "s" : ""} found`}
                contents={trending}
              />
            )}
          </>
        )}

        {allCount === 0 && !search && (
          <div className="py-24 text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">
              No content yet
            </h2>
            <p className="text-slate-400 max-w-md mx-auto mb-8">
              Content is being added regularly. Check back soon or sign up to get
              notified when new titles arrive.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex px-6 py-3 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
            >
              Create Account
            </Link>
          </div>
        )}

        {allCount === 0 && search && (
          <div className="py-16 text-center">
            <p className="text-slate-400">
              No results matched your search. Try different keywords.
            </p>
            <Link
              href="/browse"
              className="inline-block mt-4 text-orange-500 hover:text-orange-400 font-medium"
            >
              Clear search
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
