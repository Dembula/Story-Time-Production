"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserPlus, MessageCircle, Check, Loader2, Film, MapPin, Globe } from "lucide-react";

interface ProfileData {
  user: {
    id: string;
    name: string | null;
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
  contents: { id: string; title: string; type: string; posterUrl: string | null; createdAt: string }[];
  posts: Array<{
    id: string;
    body: string | null;
    postType: string;
    imageUrls: string | null;
    videoUrls: string | null;
    createdAt: string;
  }>;
}

export function CreatorProfileClient({ userId }: { userId: string }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => u?.id && setMyId(u.id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/network/profile/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
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

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const { user, contents, posts } = data;
  const isOwnProfile = myId === userId;
  const canFollowOrConnect = myId && !isOwnProfile;
  const displayName = user.name || "Creator";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {user.image ? (
              <Image src={user.image} alt="" width={112} height={112} className="object-cover w-full h-full" />
            ) : (
              <span className="text-3xl font-bold text-slate-400">{displayName[0]?.toUpperCase() ?? "C"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white">{displayName}</h1>
            {user.headline && <p className="text-slate-300 mt-1">{user.headline}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-2">
              {user.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {user.location}
                </span>
              )}
              {user.website && (
                <a
                  href={user.website.startsWith("http") ? user.website : `https://${user.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300"
                >
                  <Globe className="w-4 h-4" /> Link
                </a>
              )}
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">{roleLabel(user.role)}</span>
            </div>
            {user.bio && <p className="text-slate-400 mt-3 whitespace-pre-wrap text-sm leading-relaxed">{user.bio}</p>}
            {user.previousWork && (
              <p className="text-slate-500 mt-2 text-sm whitespace-pre-wrap">
                <span className="text-slate-400 font-medium">Background: </span>
                {user.previousWork}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
              <span>{data.followerCount} followers</span>
              <span>{data.followingCount} following</span>
            </div>
            {isOwnProfile && (
              <Link href="/creator/network" className="inline-flex mt-3 text-xs text-orange-400 hover:text-orange-300 font-medium">
                Open Network →
              </Link>
            )}
            {canFollowOrConnect && (
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={!!actionLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    data.following ? "bg-slate-700 text-slate-300" : "bg-orange-500 text-white hover:bg-orange-600"
                  } disabled:opacity-50`}
                >
                  {actionLoading === "follow" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : data.following ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
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
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 text-white hover:bg-violet-600 text-sm font-medium disabled:opacity-50"
                  >
                    {actionLoading === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
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
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/80 text-white hover:bg-violet-500 text-sm font-medium"
                  >
                    <MessageCircle className="w-4 h-4" /> Message
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {contents.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Film className="w-4 h-4 text-orange-400" /> On Story Time
          </h2>
          <ul className="space-y-2">
            {contents.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/browse/content/${c.id}`}
                  className="flex items-center justify-between gap-2 text-sm text-slate-300 hover:text-orange-400"
                >
                  <span className="truncate">{c.title}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 shrink-0">{c.type}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-xs text-slate-400">No posts yet.</p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-orange-400/90">{post.postType.replaceAll("_", " ")}</span>
                  <span className="text-[11px] text-slate-500">{formatDate(post.createdAt)}</span>
                </div>
                {post.body && <p className="text-slate-200 text-sm whitespace-pre-wrap">{post.body}</p>}
                {post.videoUrls &&
                  (() => {
                    try {
                      const urls = JSON.parse(post.videoUrls) as string[];
                      if (Array.isArray(urls) && urls[0]) {
                        return (
                          <div className="mt-2 aspect-video w-full max-w-lg rounded-lg overflow-hidden bg-black border border-slate-800">
                            <video src={urls[0]} controls className="h-full w-full" playsInline />
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
                              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-800">
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
