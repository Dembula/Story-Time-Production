"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, UserPlus, MessageCircle, Check, Loader2, Film, MapPin, Globe } from "lucide-react";
import { resolveNetworkDisplayName, networkDisplayInitial } from "@/lib/network-display-name";
import { NativeSafeVideo } from "@/components/player/native-safe-video";
import { FilmographyCard } from "@/components/network/filmography-card";
import type { NetworkFilmographyItem } from "@/lib/network-filmography";

interface ProfileData {
  user: {
    id: string;
    name: string | null;
    displayName?: string;
    handle?: string | null;
    image: string | null;
    bio: string | null;
    socialLinks: string | null;
    previousWork: string | null;
    role: string;
    headline: string | null;
    location: string | null;
    website: string | null;
  };
  following: boolean;
  connectionStatus: string;
  followerCount: number;
  followingCount: number;
  filmography: NetworkFilmographyItem[];
  posts: Array<{
    id: string;
    body: string | null;
    postType: string;
    imageUrls: string | null;
    videoUrls: string | null;
    createdAt: string;
  }>;
}

export function CreatorProfileClient({
  userId,
  returnTo,
}: {
  userId: string;
  returnTo: string | null;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  const backHref = returnTo ?? "/creator/network?tab=discover";
  const backLabel = returnTo?.includes("tab=discover")
    ? "Back to Discover"
    : returnTo?.includes("tab=feed")
      ? "Back to Feed"
      : returnTo?.includes("tab=chats")
        ? "Back to Chats"
        : "Back to Network";

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => u?.id && setMyId(u.id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/network/profile/${userId}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Profile unavailable");
        }
        return r.json();
      })
      .then(setData)
      .catch((err: Error) => {
        setData(null);
        setLoadError(err.message);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  async function toggleFollow() {
    if (!data || actionLoading) return;
    setActionLoading("follow");
    try {
      if (data.following) {
        await fetch(`/api/network/follow/${userId}`, { method: "DELETE" });
        setData((d) => (d ? { ...d, following: false, followerCount: Math.max(0, d.followerCount - 1) } : d));
      } else {
        await fetch(`/api/network/follow/${userId}`, { method: "POST" });
        setData((d) => (d ? { ...d, following: true, followerCount: d.followerCount + 1 } : d));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConnect() {
    if (!data || actionLoading) return;
    setActionLoading("connect");
    try {
      await fetch(`/api/network/connect/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      });
      setData((d) => (d ? { ...d, connectionStatus: "PENDING_SENT" } : d));
    } finally {
      setActionLoading(null);
    }
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const roleLabel = (r: string) => r.replace(/_/g, " ");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-orange-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <p className="text-sm text-slate-300">{loadError ?? "This profile is unavailable."}</p>
        </div>
      </div>
    );
  }

  const { user, filmography, posts } = data;
  const isOwnProfile = myId === userId;
  const canFollowOrConnect = myId && !isOwnProfile;
  const displayName = user.displayName ?? resolveNetworkDisplayName(user);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-orange-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-violet-500" />
        <div className="p-5 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-lg sm:h-28 sm:w-28">
              {user.image ? (
                <Image src={user.image} alt="" width={112} height={112} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-slate-400">{networkDisplayInitial(user)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">{displayName}</h1>
              {user.handle && <p className="mt-0.5 text-sm text-orange-300/90">@{user.handle}</p>}
              {isOwnProfile && (
                <Link
                  href="/creator/account?tab=public"
                  className="mt-2 inline-block text-xs text-slate-400 hover:text-orange-300"
                >
                  Edit public profile &amp; handle →
                </Link>
              )}
              {user.headline && <p className="mt-2 text-slate-300">{user.headline}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                {user.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {user.location}
                  </span>
                )}
                {user.website && (
                  <a
                    href={user.website.startsWith("http") ? user.website : `https://${user.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-orange-400 hover:text-orange-300"
                  >
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                  {roleLabel(user.role)}
                </span>
              </div>
              {user.bio && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{user.bio}</p>
              )}
              {user.previousWork && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">
                  <span className="font-medium text-slate-400">Background: </span>
                  {user.previousWork}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                <span>
                  <span className="font-medium text-slate-300">{data.followerCount}</span> followers
                </span>
                <span>
                  <span className="font-medium text-slate-300">{data.followingCount}</span> following
                </span>
              </div>
              {isOwnProfile && (
                <Link
                  href="/creator/network"
                  className="mt-3 inline-flex text-xs font-medium text-orange-400 hover:text-orange-300"
                >
                  Open Network →
                </Link>
              )}
              {canFollowOrConnect && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleFollow}
                    disabled={!!actionLoading}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      data.following ? "bg-slate-700 text-slate-300" : "bg-orange-500 text-white hover:bg-orange-600"
                    } disabled:opacity-50`}
                  >
                    {actionLoading === "follow" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : data.following ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {data.following ? "Following" : "Follow"}
                  </button>
                  {(data.connectionStatus === "NONE" ||
                    data.connectionStatus === "PENDING_RECEIVED" ||
                    data.connectionStatus === "PENDING_SENT") && (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={!!actionLoading || data.connectionStatus === "PENDING_SENT"}
                      className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                    >
                      {actionLoading === "connect" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                      {data.connectionStatus === "PENDING_SENT"
                        ? "Request sent"
                        : data.connectionStatus === "PENDING_RECEIVED"
                          ? "Respond to request"
                          : "Connect"}
                    </button>
                  )}
                  {data.connectionStatus === "ACCEPTED" && (
                    <Link
                      href={`/creator/network?chatWith=${userId}`}
                      className="flex items-center gap-2 rounded-lg bg-violet-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                    >
                      <MessageCircle className="h-4 w-4" /> Message
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {filmography.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Film className="h-4 w-4 text-orange-400" />
            On Story Time
            <span className="ml-1 text-xs font-normal text-slate-500">({filmography.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {filmography.map((item) => (
              <FilmographyCard key={`${item.contentId}-${item.role}`} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-xs text-slate-400">No posts yet.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-orange-400/90">
                    {post.postType.replaceAll("_", " ")}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatDate(post.createdAt)}</span>
                </div>
                {post.body && <p className="whitespace-pre-wrap text-sm text-slate-200">{post.body}</p>}
                {post.videoUrls &&
                  (() => {
                    try {
                      const urls = JSON.parse(post.videoUrls) as string[];
                      if (Array.isArray(urls) && urls[0]) {
                        return (
                          <div className="mt-2 aspect-video w-full max-w-lg overflow-hidden rounded-lg border border-slate-800 bg-black">
                            <NativeSafeVideo videoUrl={urls[0]} controls className="h-full w-full" />
                          </div>
                        );
                      }
                    } catch {
                      /* ignore */
                    }
                    return null;
                  })()}
                {post.imageUrls &&
                  (() => {
                    try {
                      const urls = JSON.parse(post.imageUrls) as string[];
                      if (Array.isArray(urls) && urls.length > 0) {
                        return (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {urls.slice(0, 4).map((url, i) => (
                              <div
                                key={i}
                                className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-800"
                              >
                                <Image src={url} alt="" width={96} height={96} className="object-cover" />
                              </div>
                            ))}
                          </div>
                        );
                      }
                    } catch {
                      return null;
                    }
                  })()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
