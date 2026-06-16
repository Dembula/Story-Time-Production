"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Play, Lock, GraduationCap, Globe, BookOpen, Target, Briefcase, Music, Users as UsersIcon, X, Film } from "lucide-react";
import { BtsSection } from "@/components/player/bts-section";
import { CommentsSection } from "@/components/player/comments-section";
import { RatingsSection } from "@/components/player/ratings-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentDetailHero } from "@/components/browse/content-detail-hero";
import { ContentInfoModal } from "@/components/browse/content-info-modal";
import { ContentEpisodesSection, type SeasonItem } from "@/components/browse/content-episodes-section";
import { isLongFormType } from "@/lib/content-types";
import { CheckoutModal } from "@/components/payments/checkout-modal";
import { CastCrewMemberCard } from "@/components/browse/cast-crew-member-card";
import { useWatchlist } from "@/hooks/use-watchlist";
import { usePlaybackPrefetch } from "@/hooks/use-playback-prefetch";
import { startDownload, getDownload } from "@/lib/offline/download-manager";
import { displayCreatorGoals } from "@/lib/creator-profile-goals";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

type Content = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  videoUrl: string | null;
  trailerUrl: string | null;
  category: string | null;
  tags: string | null;
  language: string | null;
  country: string | null;
  year: number | null;
  duration: number | null;
  episodes: number | null;
  createdAt: string;
  submittedAt: string | null;
  isStudentWork?: boolean;
  creator: {
    id: string;
    name: string | null;
    image: string | null;
    bio?: string | null;
    socialLinks?: string | null;
    education?: string | null;
    goals?: string | null;
    previousWork?: string | null;
    isAfdaStudent?: boolean;
  };
  btsVideos: { id: string; title: string; videoUrl: string | null; thumbnail: string | null }[];
  ratingStats?: { average: number; count: number };
  otherCreatorContent?: { id: string; title: string; posterUrl: string | null; type: string; year: number | null }[];
  soundtrack?: { id: string; title: string; artistName: string; genre: string | null; coverUrl: string | null; creatorId: string }[];
  crewMembers?: { id: string; name: string; role: string; bio: string | null }[];
  minAge?: number;
  ageRating?: string | null;
  advisory?: unknown | null;
};

export function ContentDetailClient({
  content,
  seasons = [],
  autoPlay = false,
  subscriptionExpired = false,
  ageRestricted = false,
  contentMinAge = 0,
  viewerModel = "SUBSCRIPTION",
  hasActivePpvAccess = false,
  hasPlaybackAccess = false,
  ppvEligible = false,
}: {
  content: Content;
  subscriptionExpired?: boolean;
  ageRestricted?: boolean;
  contentMinAge?: number;
  viewerModel?: "SUBSCRIPTION" | "PPV";
  hasActivePpvAccess?: boolean;
  hasPlaybackAccess?: boolean;
  ppvEligible?: boolean;
  seasons?: SeasonItem[];
  autoPlay?: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { deviceClass } = useAdaptiveUi();
  const isMobile = deviceClass === "mobile";
  const isTv = deviceClass === "tv";
  const [showSubscriptionEndedModal, setShowSubscriptionEndedModal] = useState(false);
  const [showPpvModal, setShowPpvModal] = useState(false);
  const [ppvLoading, setPpvLoading] = useState(false);
  const [ppvError, setPpvError] = useState("");
  const [ppvCheckoutUrl, setPpvCheckoutUrl] = useState("");
  const [ppvCheckoutOpen, setPpvCheckoutOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const isSubscriber = (session?.user as { role?: string } | undefined)?.role === "SUBSCRIBER";
  const { inList, toggle: toggleWatchlist } = useWatchlist(content.id);
  const preparePlayback = usePlaybackPrefetch();
  const [downloadState, setDownloadState] = useState<string | null>(null);
  const [creditsExpanded, setCreditsExpanded] = useState(false);

  useEffect(() => {
    const d = getDownload(content.id);
    setDownloadState(d?.status ?? null);
    const onChange = () => setDownloadState(getDownload(content.id)?.status ?? null);
    window.addEventListener("storytime-downloads-changed", onChange);
    return () => window.removeEventListener("storytime-downloads-changed", onChange);
  }, [content.id]);

  const handleDownload = async () => {
    if (!content.videoUrl) return;
    await startDownload({
      contentId: content.id,
      title: content.title,
      posterUrl: content.posterUrl,
      videoUrl: content.videoUrl,
    });
    setDownloadState("downloading");
  };
  const canPlay = isSubscriber && hasPlaybackAccess && !ageRestricted;
  const canPurchasePpv = isSubscriber && viewerModel === "PPV" && ppvEligible && !hasActivePpvAccess && !ageRestricted;
  const isLongForm = isLongFormType(content.type);
  const firstEpisode = seasons.flatMap((s) => s.episodes).find((e) => e.videoUrl);
  const playTarget = isLongForm && firstEpisode
    ? `/browse/content/${content.id}/watch?episode=${firstEpisode.id}`
    : `/browse/content/${content.id}/watch`;
  const trailerTarget = `/browse/content/${content.id}/watch?trailer=1`;
  const playLabel = isLongForm ? "Play First Episode" : "Play";

  const warmPlayback = useCallback(() => {
    const episodeVideo = firstEpisode?.videoUrl ?? content.videoUrl;
    preparePlayback({
      contentId: content.id,
      watchHref: playTarget,
      videoUrl: episodeVideo,
      episodeId: firstEpisode?.id ?? null,
    });
  }, [preparePlayback, content.id, content.videoUrl, playTarget, firstEpisode?.id, firstEpisode?.videoUrl]);

  const warmTrailer = useCallback(() => {
    if (!content.trailerUrl) return;
    preparePlayback({
      contentId: content.id,
      watchHref: trailerTarget,
      videoUrl: content.trailerUrl,
      episodeId: null,
      trailer: true,
    });
  }, [preparePlayback, content.id, content.trailerUrl, trailerTarget]);

  useEffect(() => {
    if (!canPlay) return;
    warmPlayback();
  }, [canPlay, warmPlayback]);

  function handlePlay() {
    if (canPlay) {
      warmPlayback();
      router.push(playTarget);
      return;
    }
    if (canPurchasePpv) setShowPpvModal(true);
    else if (subscriptionExpired) setShowSubscriptionEndedModal(true);
  }

  function handleLockedPlay() {
    handlePlay();
  }

  let socialLinks: Record<string, string> = {};
  try {
    if (content.creator?.socialLinks) {
      socialLinks = JSON.parse(content.creator.socialLinks);
    }
  } catch {}

  async function handlePpvPurchase() {
    setPpvError("");
    setPpvLoading(true);
    try {
      const res = await fetch("/api/viewer/ppv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: content.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Payment failed");
      }

      if (data?.alreadyOwned) {
        setShowPpvModal(false);
        router.push(`/browse/content/${content.id}/watch`);
        router.refresh();
        return;
      }

      if (data?.requiresPayment && typeof data?.checkoutUrl === "string" && data.checkoutUrl) {
        setShowPpvModal(false);
        setPpvCheckoutUrl(data.checkoutUrl);
        setPpvCheckoutOpen(true);
        return;
      }

      throw new Error("Payment session could not be started.");
    } catch (error) {
      setPpvError(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPpvLoading(false);
    }
  }

  return (
    <div
      className={`mx-auto w-full ${
        isTv
          ? "adaptive-tv-surface max-w-[1800px] px-8 pb-16 md:px-12"
          : isMobile
            ? "max-w-6xl px-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "max-w-6xl px-4 pb-16 md:px-6"
      }`}
    >
      <ContentInfoModal
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        content={{
          title: content.title,
          type: content.type,
          category: content.category,
          description: content.description,
          year: content.year,
          duration: content.duration,
          language: content.language,
          country: content.country,
          ageRating: content.ageRating ?? null,
          minAge: content.minAge,
          advisory: content.advisory as Record<string, boolean | string> | null,
          tags: content.tags,
          createdAt: content.createdAt,
          submittedAt: content.submittedAt,
          creatorName: content.creator?.name ?? null,
          isStudentWork: content.isStudentWork,
          episodes: content.episodes,
        }}
      />
      <CheckoutModal
        open={ppvCheckoutOpen}
        checkoutUrl={ppvCheckoutUrl}
        title="Complete PPV payment"
        subtitle={`Unlock ${content.title} for 30 days after successful payment.`}
        onClose={() => setPpvCheckoutOpen(false)}
      />
      {showSubscriptionEndedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-xl relative">
            <button
              type="button"
              onClick={() => setShowSubscriptionEndedModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold text-white mb-2 pr-10">Your subscription has ended</h3>
            <p className="text-slate-400 text-sm mb-6">
              Go to Account to pay for your subscription and resume watching.
            </p>
            <Link
              href="/browse/account/renew"
              className="inline-flex rounded-xl viewer-btn-primary px-6 py-3 font-medium transition"
            >
              Go to Account &amp; renew
            </Link>
          </div>
        </div>
      )}
      {showPpvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
            <button
              type="button"
              onClick={() => setShowPpvModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-10 text-xl font-semibold text-white">Unlock this title</h3>
            <p className="mt-2 text-sm text-slate-400">
              Pay R49.99 now to unlock <span className="font-medium text-white">{content.title}</span> for 30 days
              on this PPV account.
            </p>
            <div className="mt-6 rounded-xl border border-orange-400/20 bg-orange-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-orange-200/80">Pay now</p>
              <p className="mt-1 text-3xl font-bold text-white">R49.99</p>
            </div>
            {ppvError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {ppvError}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPpvModal(false)}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-3 font-medium text-slate-300 transition hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePpvPurchase}
                disabled={ppvLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl viewer-btn-primary px-4 py-3 font-semibold transition disabled:opacity-50"
              >
                {ppvLoading ? "Processing..." : "Pay now"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ContentDetailHero
        contentId={content.id}
        title={content.title}
        type={content.type}
        category={content.category}
        year={content.year}
        duration={content.duration}
        description={content.description}
        backdropUrl={content.backdropUrl}
        trailerUrl={content.trailerUrl}
        autoPlay={autoPlay}
        canPlay={canPlay && !ageRestricted}
        inList={inList}
        onToggleList={toggleWatchlist}
        onInfoOpen={() => setShowInfoModal(true)}
        onPlay={handlePlay}
        onLockedPlay={handleLockedPlay}
        playLabel={playLabel}
        playHref={playTarget}
        onPreparePlay={warmPlayback}
        onPrepareTrailer={warmTrailer}
        hasDownload={Boolean(content.videoUrl && !isLongForm)}
        downloadState={downloadState}
        onDownload={handleDownload}
        isSubscriber={Boolean(isSubscriber)}
      />

      <div className={`${isMobile ? "px-4" : ""} ${isTv ? "mt-10" : "mt-8"} px-1`}>
        {ageRestricted && isSubscriber && (
          <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            This title isn&apos;t available for your profile (age {contentMinAge}+).{" "}
            <Link href="/profiles" className="font-medium underline hover:text-white">Switch profile</Link>
          </div>
        )}

        {content.trailerUrl && (
          <section className={`${isTv ? "mb-12" : "mb-10"}`}>
            <h2 className={`mb-3 font-display font-semibold text-white ${isTv ? "text-2xl" : "text-lg"}`}>Trailers</h2>
            <Link
              href={trailerTarget}
              onPointerDown={warmTrailer}
              onFocus={warmTrailer}
              className={`group relative block aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-900 ${
                isMobile ? "w-full" : "max-w-md"
              } ${isTv ? "max-w-xl rounded-2xl" : ""}`}
            >
              {content.backdropUrl ? (
                <Image src={content.backdropUrl} alt="" fill sizes="400px" className="object-cover opacity-80 transition group-hover:opacity-100" />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                  <Play className="h-5 w-5 fill-slate-900 text-slate-900" />
                </span>
              </div>
              <span className="absolute bottom-3 left-3 text-sm font-medium text-white">Official Trailer</span>
            </Link>
          </section>
        )}

        {isLongForm && seasons.length > 0 && (
          <ContentEpisodesSection
            contentId={content.id}
            seasons={seasons}
            canPlay={canPlay && !ageRestricted}
            onLockedPlay={handleLockedPlay}
          />
        )}

        {!isSubscriber && (
          <div className="mb-10 flex flex-wrap gap-3">
            <Link href="/auth/signup" className="flex items-center gap-2 rounded-xl viewer-btn-primary px-6 py-3 font-semibold transition">
              <Lock className="h-5 w-5" /> Sign up to watch
            </Link>
            <Link href="/auth/signin" className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/50 px-6 py-3 font-semibold text-white transition hover:bg-slate-700/50">
              Sign In
            </Link>
          </div>
        )}

        {viewerModel === "PPV" && hasActivePpvAccess && (
          <div className="mb-6 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Unlocked on this PPV account
          </div>
        )}

        {content.creator?.name && (
          <p className="mb-8 text-sm text-slate-400">
            By <span className="font-medium text-orange-400">{content.creator.name}</span>
            {content.ratingStats && content.ratingStats.count > 0 && (
              <span className="ml-3 text-orange-300">★ {content.ratingStats.average.toFixed(1)}</span>
            )}
          </p>
        )}
      </div>

      {/* Creator Profile Card */}
      {content.creator && (() => {
        const creatorGoalsPlain = displayCreatorGoals(content.creator.goals);
        return content.creator.bio || content.creator.education || creatorGoalsPlain || content.creator.previousWork;
      })() && (
        <div className="mt-12 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            About the Creator
            {content.isStudentWork && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium">
                <GraduationCap className="w-3 h-3" /> Student Film
              </span>
            )}
          </h3>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                {content.creator.image ? (
                  <Image
                    src={content.creator.image}
                    alt=""
                    fill
                    sizes="80px"
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-orange-500">{(content.creator.name || "?")[0]}</span>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <p className="font-semibold text-white text-lg">{content.creator.name}</p>
              {content.creator.bio && <p className="text-slate-400 text-sm leading-relaxed">{content.creator.bio}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.creator.education && (
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Education</p>
                      <p className="text-sm text-slate-300">{content.creator.education}</p>
                    </div>
                  </div>
                )}
                {content.creator.previousWork && (
                  <div className="flex items-start gap-2">
                    <Briefcase className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Previous Work</p>
                      <p className="text-sm text-slate-300">{content.creator.previousWork}</p>
                    </div>
                  </div>
                )}
                {displayCreatorGoals(content.creator.goals) ? (
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Goals</p>
                      <p className="text-sm text-slate-300">{displayCreatorGoals(content.creator.goals)}</p>
                    </div>
                  </div>
                ) : null}
                {Object.keys(socialLinks).length > 0 && (
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Social Media</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(socialLinks).map(([platform, handle]) => (
                          <span key={platform} className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-300">
                            {platform}: {handle}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Other works by this creator */}
          {content.otherCreatorContent && content.otherCreatorContent.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="text-sm font-medium text-slate-400 mb-3">More from {content.creator.name}</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {content.otherCreatorContent.map((c) => (
                  <Link key={c.id} href={`/browse/content/${c.id}`} className="flex-shrink-0 group">
                    <div className="w-28 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 border border-slate-700/50 group-hover:border-orange-500/50 transition">
                      {c.posterUrl ? (
                        <Image
                          src={c.posterUrl}
                          alt={c.title}
                          fill
                          sizes="112px"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">{c.title}</div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 truncate w-28 group-hover:text-white transition">{c.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Soundtrack Section */}
      {content.soundtrack && content.soundtrack.length > 0 && (
        <div className="mt-8 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Music className="w-5 h-5 text-orange-500" /> Soundtrack
          </h3>
          <div className="space-y-3">
            {content.soundtrack.map((track, i) => (
              <div key={track.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:border-orange-500/30 transition">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                  {track.coverUrl ? (
                    <Image src={track.coverUrl} alt="" fill sizes="48px" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-5 h-5 text-slate-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{track.title}</p>
                  <p className="text-sm text-slate-400">{track.artistName}{track.genre ? ` · ${track.genre}` : ""}</p>
                </div>
                <span className="text-xs text-slate-500">#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew Members */}
      {content.crewMembers && content.crewMembers.length > 0 && (() => {
        const previewCount = isTv ? 12 : isMobile ? 6 : 8;
        const visibleMembers = creditsExpanded ? content.crewMembers : content.crewMembers.slice(0, previewCount);
        const hiddenCount = Math.max(0, content.crewMembers.length - visibleMembers.length);
        return (
        <div className="mt-8 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-emerald-500" /> Cast & Crew
            </h3>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              {content.crewMembers.length} credit{content.crewMembers.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {visibleMembers.map((member) => (
              <CastCrewMemberCard
                key={member.id}
                member={member}
                excludeContentId={content.id}
              />
            ))}
          </div>
          {content.crewMembers.length > previewCount ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setCreditsExpanded((v) => !v)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-orange-400/35 hover:bg-orange-500/10"
                aria-expanded={creditsExpanded}
              >
                {creditsExpanded ? "Show fewer credits" : `View all credits${hiddenCount ? ` (+${hiddenCount})` : ""}`}
              </button>
            </div>
          ) : null}
        </div>
        );
      })()}

      {isSubscriber && subscriptionExpired && (
        <div className="mt-10 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/50">
          <div className="aspect-video relative flex items-center justify-center">
            <div className="relative z-10 text-center p-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 mb-6">
                <Lock className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Your subscription has ended</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8">Pay in Account to resume watching.</p>
              <Link href="/browse/account/renew" className="inline-flex px-8 py-3.5 rounded-lg viewer-btn-primary font-semibold transition">
                Go to Account &amp; renew
              </Link>
            </div>
          </div>
        </div>
      )}

      {isSubscriber && viewerModel === "PPV" && !ageRestricted && !hasActivePpvAccess && ppvEligible && (
        <div className="mt-10 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50">
          <div className="aspect-video relative flex items-center justify-center">
            <div className="relative z-10 p-12 text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20">
                <Film className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">Pay now to unlock this title</h3>
              <p className="mx-auto mb-8 max-w-md text-slate-400">
                This PPV account pays per title. Unlock this movie, show, or other title for R49.99 and keep access for 30 days.
              </p>
              <button
                type="button"
                onClick={() => setShowPpvModal(true)}
                className="inline-flex rounded-lg viewer-btn-primary px-8 py-3.5 font-semibold transition"
              >
                Pay now
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubscriber && viewerModel === "PPV" && !ageRestricted && !ppvEligible && (
        <div className="mt-10 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50">
          <div className="aspect-video relative flex items-center justify-center">
            <div className="relative z-10 p-12 text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-slate-600 bg-slate-800">
                <Lock className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">This title needs a subscription</h3>
              <p className="mx-auto mb-8 max-w-md text-slate-400">
                Pay Per View only unlocks one title at a time. Switch this viewer account to a subscription plan for full catalogue access.
              </p>
              <Link href="/browse/account/renew" className="inline-flex rounded-lg viewer-btn-primary px-8 py-3.5 font-semibold transition">
                Choose a subscription plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {isSubscriber && ageRestricted && !subscriptionExpired && (
        <div className="mt-10 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/50">
          <div className="aspect-video relative flex items-center justify-center">
            <div className="relative z-10 text-center p-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 mb-6">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">This title isn&apos;t available for your profile</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                This content is restricted to viewers aged {contentMinAge} and above. Switch to an adult profile from Who&apos;s watching? to watch.
              </p>
              <Link href="/profiles" className="inline-flex px-8 py-3.5 rounded-lg viewer-btn-primary font-semibold transition">
                Switch profile
              </Link>
            </div>
          </div>
        </div>
      )}

      {!isSubscriber && (
        <div className="mt-10 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/50">
          <div className="aspect-video relative flex items-center justify-center">
            {(content.posterUrl || content.backdropUrl) && (
              <Image
                src={content.posterUrl || content.backdropUrl || ""}
                alt=""
                fill
                sizes="100vw"
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div className="relative z-10 text-center p-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 border border-slate-600 mb-6">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Subscribe to watch</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                Create a free account to stream all content.
              </p>
              <Link href="/auth/signup" className="inline-flex px-8 py-3.5 rounded-lg viewer-btn-primary font-semibold transition">
                Sign Up Free
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mt-16">
        <Tabs defaultValue="comments" className="w-full">
          <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1">
            <TabsTrigger value="comments" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Comments</TabsTrigger>
            <TabsTrigger value="ratings" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Ratings</TabsTrigger>
            <TabsTrigger value="bts" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">Behind the Scenes</TabsTrigger>
          </TabsList>
          <TabsContent value="bts" className="mt-6">
            <BtsSection btsVideos={content.btsVideos} />
          </TabsContent>
          <TabsContent value="comments" className="mt-6">
            <CommentsSection contentId={content.id} />
          </TabsContent>
          <TabsContent value="ratings" className="mt-6">
            <RatingsSection contentId={content.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
