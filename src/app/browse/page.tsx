import { Hero } from "@/components/layout/hero";
import { ContentRow } from "@/components/layout/content-row";
import { MusicRow } from "@/components/layout/music-row";
import { RecommendationsRow } from "@/components/layout/recommendations-row";
import { ContinueWatchingRow } from "@/components/layout/continue-watching-row";
import { MoodBrowseRow } from "@/components/layout/mood-browse-row";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { VIEWER_MODELS } from "@/lib/viewer-access";
import { packBrowseContentList } from "@/lib/browse-media-pack";
import { contentTypePluralLabel } from "@/lib/content-types";

/** Catalogue must reflect admin publish/unpublish immediately. */
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

  if (search?.trim()) {
    const qs = new URLSearchParams({ q: search.trim() });
    if (type) qs.set("type", type);
    if (filter) qs.set("filter", filter);
    redirect(`/browse/search?${qs.toString()}`);
  }

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

  type ContentWithCount = Awaited<ReturnType<typeof prisma.content.findMany<{ include: { _count: { select: { ratings: true } } } }>>>[number];
  type MostPopularItem = ContentWithCount & { _avgRating: number; ratings: { score: number }[] };

  let featured: ContentWithCount[] = [];
  let mostPopular: MostPopularItem[] = [];
  let trending: ContentWithCount[] = [];
  let movies: ContentWithCount[] = [];
  let series: ContentWithCount[] = [];
  let animated: ContentWithCount[] = [];
  let sports: ContentWithCount[] = [];
  let comedySkits: ContentWithCount[] = [];
  let documentaries: ContentWithCount[] = [];
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
        where: { ...where, type: "MOVIE" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SERIES" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "ANIMATION" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SPORTS" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: { in: ["COMEDY_SKIT", "STAND_UP"] } },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "DOCUMENTARY" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SHOW" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "LIVE_EVENT" },
        take: 16,
        include: { _count: { select: { ratings: true } } },
      }),
      prisma.content.findMany({
        where: { ...where, type: "SHOW", category: { contains: "Comedy" } },
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
        where: { ...where, isStudentWork: true },
        take: 16,
        include: { _count: { select: { ratings: true } }, creator: { select: { name: true, isAfdaStudent: true } } },
      }),
      prisma.musicTrack.findMany({
        where: { published: true, isStudentWork: true },
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
    sports = results[6];
    comedySkits = results[7];
    documentaries = results[8];
    shows = results[9];
    liveMusic = results[10];
    comedyShows = results[11];
    podcasts = results[12];
    musicTracks = results[13];
    afdaContent = results[14];
    afdaMusic = results[15];
    allCount = results[16];
  } catch (err) {
    loadError = true;
    if (process.env.NODE_ENV === "development") {
      console.error("Browse page database error:", err);
    }
  }

  const withMedia = async <
    T extends {
      posterUrl: string | null;
      backdropUrl?: string | null;
      videoUrl?: string | null;
      trailerUrl?: string | null;
    },
  >(
    items: T[],
  ) => packBrowseContentList(items);

  featured = await withMedia(featured);
  mostPopular = await withMedia(mostPopular);
  trending = await withMedia(trending);
  movies = await withMedia(movies);
  series = await withMedia(series);
  animated = await withMedia(animated);
  sports = await withMedia(sports);
  comedySkits = await withMedia(comedySkits);
  documentaries = await withMedia(documentaries);
  shows = await withMedia(shows);
  liveMusic = await withMedia(liveMusic);
  comedyShows = await withMedia(comedyShows);
  podcasts = await withMedia(podcasts);
  afdaContent = await withMedia(afdaContent);
  const heroMapped =
    mostPopular.length > 0
      ? mostPopular.map(({ ratings: _r, _avgRating: _a, ...c }) => c)
      : featured;

  // Hero: Most popular films (or featured if no popular)
  const heroContent =
    mostPopular.length > 0 ? heroMapped.slice(0, 5) : featured;

  return (
    <div className="pb-16">
      {loadError && (
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 pt-4">
          <div className="rounded-2xl border border-amber-400/22 bg-amber-500/10 p-4 text-sm text-amber-100 shadow-panel">
            Content could not be loaded. Check that <code className="rounded bg-black/25 px-1.5 py-0.5">DATABASE_URL</code> in .env uses Neon&apos;s pooler port <strong>6543</strong> (e.g. <code className="rounded bg-black/25 px-1.5 py-0.5">...neon.tech:6543/neondb</code>), then restart the dev server.
          </div>
        </div>
      )}
      <Hero content={heroContent} />

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 md:px-12 -mt-10 md:-mt-16 relative z-10">
        {type && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">
              {contentTypePluralLabel(type)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Browse our collection of {contentTypePluralLabel(type).toLowerCase()}
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
                ppvMode={isPpvViewer}
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

        {!type && !filter && (
          <>
            <ContinueWatchingRow />
            <RecommendationsRow />
            <MoodBrowseRow />
            {mostPopular.length > 0 && (
              <ContentRow
                title="Most Popular on Story Time"
                subtitle="Top films by ratings and engagement"
                contents={mostPopular.map(({ ratings, _avgRating, ...c }) => ({
                  ...c,
                  _count: c._count,
                }))}
                ppvMode={isPpvViewer}
              />
            )}
            {trending.length > 0 && (
              <ContentRow
                title="Trending Now"
                subtitle="Popular titles this week"
                contents={trending}
                ppvMode={isPpvViewer}
              />
            )}
            {movies.length > 0 && (
              <ContentRow
                title="Movies"
                subtitle="Feature films and theatrical titles"
                contents={movies}
                ppvMode={isPpvViewer}
              />
            )}
            {series.length > 0 && (
              <ContentRow
                title="Series"
                subtitle="Binge-worthy shows"
                contents={series}
                ppvMode={isPpvViewer}
              />
            )}
            {animated.length > 0 && (
              <ContentRow
                title="Animation"
                subtitle="Animated films, series, and shorts"
                contents={animated}
                ppvMode={isPpvViewer}
              />
            )}
            {sports.length > 0 && (
              <ContentRow
                title="Sports"
                subtitle="Matches, highlights, and sports coverage"
                contents={sports}
                ppvMode={isPpvViewer}
              />
            )}
            {comedySkits.length > 0 && (
              <ContentRow
                title="Comedy"
                subtitle="Skits, sketch comedy, and stand-up"
                contents={comedySkits}
                ppvMode={isPpvViewer}
              />
            )}
            {documentaries.length > 0 && (
              <ContentRow
                title="Documentaries"
                subtitle="True stories and non-fiction features"
                contents={documentaries}
                ppvMode={isPpvViewer}
              />
            )}
            {shows.length > 0 && (
              <ContentRow
                title="Shows"
                subtitle="Variety and entertainment"
                contents={shows}
                ppvMode={isPpvViewer}
              />
            )}
            {liveMusic.length > 0 && (
              <ContentRow
                title="Live Events"
                subtitle="Concerts, festivals, and live captures"
                contents={liveMusic}
                ppvMode={isPpvViewer}
              />
            )}
            {comedyShows.length > 0 && (
              <ContentRow
                title="Comedy Shows"
                subtitle="Comedy entertainment shows"
                contents={comedyShows}
                ppvMode={isPpvViewer}
              />
            )}
            {podcasts.length > 0 && (
              <ContentRow
                title="Podcasts"
                subtitle="Conversations and stories"
                contents={podcasts}
                ppvMode={isPpvViewer}
              />
            )}
            {afdaContent.length > 0 && (
              <ContentRow
                title="Student Films"
                subtitle="Student works from emerging filmmakers"
                contents={afdaContent}
                ppvMode={isPpvViewer}
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

        {type && !filter && (
          <ContentRow
            title={contentTypePluralLabel(type)}
            subtitle={`All ${contentTypePluralLabel(type).toLowerCase()}`}
            contents={trending}
            ppvMode={isPpvViewer}
          />
        )}

        {allCount === 0 && (
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
              className="inline-flex rounded-xl viewer-btn-primary px-6 py-3 font-semibold transition hover:-translate-y-0.5"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
