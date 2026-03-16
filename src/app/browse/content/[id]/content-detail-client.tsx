"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Play, Plus, Lock, GraduationCap, Globe, BookOpen, Target, Briefcase, Music, Users as UsersIcon, X, AlertTriangle } from "lucide-react";
import { BtsSection } from "@/components/player/bts-section";
import { CommentsSection } from "@/components/player/comments-section";
import { RatingsSection } from "@/components/player/ratings-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackButton } from "@/components/layout/back-button";

type Content = {
  id: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  videoUrl: string | null;
  category: string | null;
  year: number | null;
  duration: number | null;
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
  subscriptionExpired = false,
  ageRestricted = false,
  contentMinAge = 0,
}: {
  content: Content;
  subscriptionExpired?: boolean;
  ageRestricted?: boolean;
  contentMinAge?: number;
}) {
  const { data: session } = useSession();
  const [showSubscriptionEndedModal, setShowSubscriptionEndedModal] = useState(false);
  const isSubscriber = !!session;
  const canPlay = isSubscriber && !subscriptionExpired && !ageRestricted;

  let socialLinks: Record<string, string> = {};
  try {
    if (content.creator?.socialLinks) {
      socialLinks = JSON.parse(content.creator.socialLinks);
    }
  } catch {}

  return (
    <div className="max-w-6xl mx-auto px-6 pb-16">
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
              className="inline-flex px-6 py-3 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
            >
              Go to Account &amp; renew
            </Link>
          </div>
        </div>
      )}
      <div className="pt-20">
        <BackButton fallback="/browse" />
      </div>

      <div className="relative -mx-6 h-[45vh] min-h-[320px]">
        {(content.backdropUrl || content.posterUrl) ? (
          <img src={content.backdropUrl || content.posterUrl || ""} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1222] via-[#0c1222]/60 to-transparent" />
      </div>

      <div className="flex flex-col md:flex-row gap-8 -mt-36 relative z-10 px-2">
        <div className="flex-shrink-0">
          <div className="w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-2xl border border-slate-700/50">
            {content.posterUrl ? (
              <img src={content.posterUrl} alt={content.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">No poster</div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <h1 className="text-4xl md:text-5xl font-semibold text-white">{content.title}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-slate-400 text-sm items-center">
            {content.category && <span>{content.category}</span>}
            {content.year && <span>{content.year}</span>}
            {content.duration && <span>{Math.floor(content.duration / 60)}h {content.duration % 60}m</span>}
            {(content.minAge != null && content.minAge > 0) && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                Age {content.minAge}+
              </span>
            )}
            {content.ageRating && (
              <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 text-xs">{content.ageRating}</span>
            )}
            {content.ratingStats && content.ratingStats.count > 0 && (
              <span className="flex items-center gap-1 text-orange-400 font-medium">
                ★ {content.ratingStats.average.toFixed(1)} ({content.ratingStats.count} ratings)
              </span>
            )}
          </div>
          {(() => {
            const adv = content.advisory as Record<string, boolean | string> | undefined | null;
            if (!adv || typeof adv !== "object") return null;
            const labels: Record<string, string> = {
              violence: "Violence",
              language: "Strong language",
              sex: "Sexual content",
              nudity: "Nudity",
              drugs: "Drug/substance use",
              selfHarm: "Self-harm",
              horror: "Horror",
              discrimination: "Discrimination",
            };
            const active = Object.entries(adv)
              .filter(([k, v]) => k !== "themes" && v === true)
              .map(([k]) => labels[k] || k);
            const themes = typeof adv.themes === "string" ? adv.themes.trim() : "";
            if (active.length === 0 && !themes) return null;
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-slate-500">Content advisories:</span>
                {active.map((label) => (
                  <span key={label} className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                    {label}
                  </span>
                ))}
                {themes && (
                  <span className="text-slate-400 text-xs">{themes}</span>
                )}
              </div>
            );
          })()}
          {content.creator?.name && (
            <p className="mt-3 text-slate-300">
              By{" "}
              <span className="text-orange-500 font-medium">{content.creator.name}</span>
              {content.creator.isAfdaStudent && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium">
                  <GraduationCap className="w-3 h-3" /> Student Films
                </span>
              )}
            </p>
          )}
          {content.description && (
            <p className="mt-4 text-slate-400 max-w-2xl leading-relaxed">{content.description}</p>
          )}
          <div className="mt-8 flex flex-wrap gap-4">
            {isSubscriber ? (
              <>
                {ageRestricted ? (
                  <div className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600 cursor-not-allowed">
                    <Lock className="w-5 h-5" /> Not available for this profile (age {contentMinAge}+)
                  </div>
                ) : subscriptionExpired ? (
                  <button
                    type="button"
                    onClick={() => setShowSubscriptionEndedModal(true)}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition"
                  >
                    <Play className="w-5 h-5 fill-current" /> Play
                  </button>
                ) : (
                  <Link
                    href={`/browse/content/${content.id}/watch`}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition"
                  >
                    <Play className="w-5 h-5 fill-current" /> Play
                  </Link>
                )}
                <button className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-slate-700/50 text-white font-semibold hover:bg-slate-600/50 transition border border-slate-600">
                  <Plus className="w-5 h-5" /> My List
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signup" className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition">
                  <Lock className="w-5 h-5" /> Subscribe to Watch
                </Link>
                <Link href="/auth/signin" className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-slate-700/50 text-white font-semibold hover:bg-slate-600/50 transition border border-slate-600">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Creator Profile Card */}
      {content.creator && (content.creator.bio || content.creator.education || content.creator.goals) && (
        <div className="mt-12 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            About the Creator
            {content.creator.isAfdaStudent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium">
                <GraduationCap className="w-3 h-3" /> Student Films
              </span>
            )}
          </h3>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                {content.creator.image ? (
                  <img src={content.creator.image} alt="" className="w-full h-full rounded-2xl object-cover" />
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
                {content.creator.goals && (
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Goals</p>
                      <p className="text-sm text-slate-300">{content.creator.goals}</p>
                    </div>
                  </div>
                )}
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
                        <img src={c.posterUrl} alt={c.title} className="w-full h-full object-cover" />
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
                    <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
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
      {content.crewMembers && content.crewMembers.length > 0 && (
        <div className="mt-8 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-emerald-500" /> Cast & Crew
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {content.crewMembers.map((member) => (
              <div key={member.id} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
                <p className="text-white font-medium text-sm">{member.name}</p>
                <p className="text-xs text-orange-400">{member.role}</p>
                {member.bio && <p className="text-xs text-slate-500 mt-1">{member.bio}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSubscriber && subscriptionExpired && (
        <div className="mt-10 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/50">
          <div className="aspect-video relative flex items-center justify-center">
            <div className="relative z-10 text-center p-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 mb-6">
                <Lock className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Your subscription has ended</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8">Pay in Account to resume watching.</p>
              <Link href="/browse/account/renew" className="inline-flex px-8 py-3.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition">
                Go to Account &amp; renew
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
              <Link href="/profiles" className="inline-flex px-8 py-3.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition">
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
              <img src={content.posterUrl || content.backdropUrl || ""} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1222] to-transparent" />
            <div className="relative z-10 text-center p-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 border border-slate-600 mb-6">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Subscribe to watch</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                Create a free account to stream all content.
              </p>
              <Link href="/auth/signup" className="inline-flex px-8 py-3.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition">
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
