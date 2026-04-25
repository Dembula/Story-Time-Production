"use client";

import { useQuery } from "@tanstack/react-query";
import { Film, Eye, Users, Clock, DollarSign, Star, MessageSquare, TrendingUp, Wrench, Megaphone, UsersRound, CheckCircle, XCircle, AlertTriangle, FileText, Send, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY,
  getCreatorLicenseConfig,
  normalizeCreatorLicenseType,
} from "@/lib/pricing";

export function CreatorDashboardClient() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["creator-stats"],
    queryFn: () => fetch("/api/creator/stats").then((r) => r.json()),
  });

  const { data: contents, isLoading: contentLoading } = useQuery({
    queryKey: ["creator-content"],
    queryFn: () => fetch("/api/creator/content").then((r) => r.json()),
  });

  const { data: competitionStats } = useQuery({
    queryKey: ["competition-creator-stats"],
    queryFn: () => fetch("/api/competition/creator-stats").then((r) => r.json()),
    refetchInterval: 20000,
  });

  const { data: licenseData } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const license = licenseData?.license;

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Skeleton className="mb-8 h-10 w-64 bg-white/[0.06]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 bg-white/[0.06]" />)}
        </div>
      </div>
    );
  }

  const totalRatings = contents?.reduce((s: number, c: { _count?: { ratings: number } }) => s + (c._count?.ratings ?? 0), 0) ?? 0;
  const totalComments = contents?.reduce((s: number, c: { _count?: { comments: number } }) => s + (c._count?.comments ?? 0), 0) ?? 0;
  const allRatings = contents?.flatMap((c: { ratings?: { score: number }[] }) => c.ratings || []) ?? [];
  const overallAvg = allRatings.length > 0
    ? (allRatings.reduce((s: number, r: { score: number }) => s + r.score, 0) / allRatings.length).toFixed(1)
    : "—";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Creator Dashboard</h1>
          {license && (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-300">
              {normalizeCreatorLicenseType(license.type) === "YEARLY"
                ? `Yearly license (R${getCreatorLicenseConfig("YEARLY").price.toFixed(2)})`
                : `Pay per upload (R${getCreatorLicenseConfig("PER_UPLOAD").price.toFixed(2)})`}
            </span>
          )}
        </div>
        <p className="mt-2 text-slate-300/78">
          Track your content performance, audience engagement, and revenue. Data that Netflix would never show you.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <Card className="storytime-kpi border-l-4 border-l-cyan-500/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Views</CardTitle>
            <Eye className="w-5 h-5 text-cyan-400/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.totalViews ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">All-time plays</p>
          </CardContent>
        </Card>
        <Card className="storytime-kpi border-l-4 border-l-emerald-500/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Unique Watchers</CardTitle>
            <Users className="w-5 h-5 text-emerald-400/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats?.uniqueWatchers ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">Distinct viewers</p>
          </CardContent>
        </Card>
        <Card className="storytime-kpi border-l-4 border-l-violet-500/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg Watch Time</CardTitle>
            <Clock className="w-5 h-5 text-violet-400/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              {stats?.averageWatchTime ? `${Math.floor(stats.averageWatchTime / 60)}m` : "0m"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Per session</p>
          </CardContent>
        </Card>
        <Card className="storytime-kpi border-l-4 border-l-orange-500/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Revenue (This Month)</CardTitle>
            <DollarSign className="w-5 h-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">${(stats?.revenue ?? 0).toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">{stats?.revenueShare ?? 0}% of platform attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <Card className="storytime-section">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Overall Rating</CardTitle>
            <Star className="w-5 h-5 text-yellow-400/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">★ {overallAvg}</p>
            <p className="text-xs text-slate-500 mt-1">{totalRatings} total ratings</p>
          </CardContent>
        </Card>
        <Card className="storytime-section">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Comments</CardTitle>
            <MessageSquare className="w-5 h-5 text-blue-400/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{totalComments}</p>
            <p className="text-xs text-slate-500 mt-1">Community engagement</p>
          </CardContent>
        </Card>
        <Card className="storytime-section">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Catalogue Size</CardTitle>
            <Film className="w-5 h-5 text-pink-400/80" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{contents?.length ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">Published titles</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <Link href="/creator/equipment" className="storytime-section group p-5 hover:-translate-y-1 hover:border-orange-400/22">
          <Wrench className="w-8 h-8 text-orange-500 mb-3 group-hover:scale-110 transition" />
          <h3 className="font-semibold text-white mb-1">Equipment Repository</h3>
          <p className="text-sm text-slate-400">Find cameras, lighting, sound gear, and more from rental companies</p>
        </Link>
        <Link href="/creator/crew" className="storytime-section group p-5 hover:-translate-y-1 hover:border-emerald-400/22">
          <UsersRound className="w-8 h-8 text-emerald-500 mb-3 group-hover:scale-110 transition" />
          <h3 className="font-semibold text-white mb-1">Crew & Cast</h3>
          <p className="text-sm text-slate-400">Manage your production team, actors, and crew members</p>
        </Link>
        <Link href="/creator/auditions" className="storytime-section group p-5 hover:-translate-y-1 hover:border-violet-400/22">
          <Megaphone className="w-8 h-8 text-violet-500 mb-3 group-hover:scale-110 transition" />
          <h3 className="font-semibold text-white mb-1">Auditions</h3>
          <p className="text-sm text-slate-400">Post casting calls and manage shortlisted talent</p>
        </Link>
      </div>

      {/* Viewer Choice Competition */}
      {competitionStats?.period && (
        <Card className="storytime-kpi mb-10 border-l-4 border-l-amber-500/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" /> Viewer Choice Competition</CardTitle>
            <Link href="/browse/competition" className="text-xs text-orange-300 hover:text-orange-200">View page</Link>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">#{competitionStats.rank ?? "—"} · {competitionStats.voteCount ?? 0} votes</p>
            <p className="text-xs text-slate-500 mt-1">{competitionStats.period.name} · Ends {new Date(competitionStats.period.endDate).toLocaleDateString()}</p>
            {competitionStats.voters?.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">Voted by: {competitionStats.voters.slice(0, 5).map((v: { name: string }) => v.name).join(", ")}{competitionStats.voters.length > 5 ? ` +${competitionStats.voters.length - 5} more` : ""}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submission Tracking */}
      {(() => {
        type ContentWithReview = {
          id: string; title: string; type: string;
          reviewStatus?: string; reviewNote?: string | null;
          submittedAt?: string | null; published?: boolean;
          _count?: { watchSessions: number; ratings: number; comments: number };
          ratings?: { score: number }[];
        };
        const pendingItems = (contents as ContentWithReview[] | undefined)?.filter((c) => c.reviewStatus === "PENDING") ?? [];
        const drafts = (contents as ContentWithReview[] | undefined)?.filter((c) => c.reviewStatus === "DRAFT") ?? [];
        const changesRequested = (contents as ContentWithReview[] | undefined)?.filter((c) => c.reviewStatus === "CHANGES_REQUESTED") ?? [];
        const rejected = (contents as ContentWithReview[] | undefined)?.filter((c) => c.reviewStatus === "REJECTED") ?? [];
        const needsAttention = [...pendingItems, ...changesRequested, ...rejected, ...drafts];

        const statusIcon = (s: string) => {
          if (s === "PENDING") return <Clock className="w-4 h-4 text-yellow-400" />;
          if (s === "APPROVED") return <CheckCircle className="w-4 h-4 text-green-400" />;
          if (s === "REJECTED") return <XCircle className="w-4 h-4 text-red-400" />;
          if (s === "CHANGES_REQUESTED") return <AlertTriangle className="w-4 h-4 text-orange-400" />;
          return <FileText className="w-4 h-4 text-slate-400" />;
        };
        const statusLabel = (s: string) => {
          const map: Record<string, { label: string; cls: string }> = {
            DRAFT: { label: "Draft", cls: "bg-slate-500/10 text-slate-400" },
            PENDING: { label: "Pending Review", cls: "bg-yellow-500/10 text-yellow-400" },
            APPROVED: { label: "Published", cls: "bg-green-500/10 text-green-400" },
            REJECTED: { label: "Rejected", cls: "bg-red-500/10 text-red-400" },
            CHANGES_REQUESTED: { label: "Changes Requested", cls: "bg-orange-500/10 text-orange-400" },
          };
          const m = map[s] || map.DRAFT;
          return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.cls}`}>{m.label}</span>;
        };

        return needsAttention.length > 0 ? (
          <Card className="storytime-kpi mb-10 border-l-4 border-l-yellow-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Send className="w-5 h-5 text-yellow-400" />
                Submission Tracker
              </CardTitle>
              <p className="text-sm text-slate-400">{needsAttention.length} item{needsAttention.length !== 1 && "s"} needing your attention</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {needsAttention.map((c) => (
                <div key={c.id} className="flex items-start justify-between rounded-xl border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start gap-3">
                    {statusIcon(c.reviewStatus || "DRAFT")}
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-white">{c.title}</p>
                        {statusLabel(c.reviewStatus || "DRAFT")}
                      </div>
                      <p className="text-xs text-slate-500">{c.type}{c.submittedAt ? ` · Submitted ${new Date(c.submittedAt).toLocaleDateString()}` : " · Not yet submitted"}</p>
                      {c.reviewNote && (
                        <div className="mt-2 rounded-xl border border-orange-400/18 bg-orange-500/6 p-2">
                          <p className="text-xs text-orange-400 font-medium">Admin feedback:</p>
                          <p className="text-xs text-slate-400 mt-0.5">{c.reviewNote}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {c.reviewStatus === "DRAFT" && (
                    <Link href="/creator/upload">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs">Continue Editing</Button>
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* Content List */}
      <Card className="storytime-section">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Film className="w-5 h-5 text-slate-400" />
              Your Content
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">Performance breakdown per title</p>
          </div>
          <Link href="/creator/upload">
            <Button>Upload Content</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {contentLoading ? (
            <Skeleton className="h-48 bg-white/[0.06]" />
          ) : contents?.length > 0 ? (
            <div className="space-y-3">
              {contents.map((c: {
                id: string;
                title: string;
                type: string;
                reviewStatus?: string;
                published?: boolean;
                _count?: { watchSessions: number; ratings: number; comments: number };
                ratings?: { score: number }[];
              }) => {
                const avgRating =
                  c.ratings?.length && c.ratings.length > 0
                    ? (c.ratings.reduce((s: number, r: { score: number }) => s + r.score, 0) / c.ratings.length).toFixed(1)
                    : "—";
                const rs = c.reviewStatus || "APPROVED";
                const statusCls: Record<string, string> = {
                  DRAFT: "bg-slate-500/10 text-slate-400",
                  PENDING: "bg-yellow-500/10 text-yellow-400",
                  APPROVED: "bg-green-500/10 text-green-400",
                  REJECTED: "bg-red-500/10 text-red-400",
                  CHANGES_REQUESTED: "bg-orange-500/10 text-orange-400",
                };
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.035] p-4 hover:bg-white/[0.05]">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-white">{c.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls[rs] || statusCls.DRAFT}`}>
                          {rs === "APPROVED" ? "Published" : rs === "CHANGES_REQUESTED" ? "Changes Req." : rs.charAt(0) + rs.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{c.type}</p>
                      <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" /> {avgRating}</span>
                        <span>{c._count?.ratings ?? 0} ratings</span>
                        <span>{c._count?.comments ?? 0} comments</span>
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {c._count?.watchSessions ?? 0} views</span>
                      </div>
                    </div>
                    <Link href={`/browse/content/${c.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Film className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No content yet. Upload your first piece to start earning.</p>
              <Link href="/creator/upload">
                <Button>Upload Content</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
