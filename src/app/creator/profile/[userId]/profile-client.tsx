"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  UserPlus,
  MessageCircle,
  Check,
  Loader2,
  Film,
  FolderKanban,
  BookOpen,
  MapPin,
  Globe,
  GraduationCap,
  Target,
  Briefcase,
} from "lucide-react";

interface ProfileData {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    bio: string | null;
    socialLinks: string | null;
    education: string | null;
    goals: string | null;
    previousWork: string | null;
    isAfdaStudent: boolean;
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
  pitches: { id: string; title: string; type: string; status: string; createdAt: string }[];
  memberships: { id: string; role: string; project: { id: string; title: string; type: string; status: string } }[];
  posts: { id: string; body: string | null; imageUrls: string | null; contentId: string | null; projectId: string | null; createdAt: string }[];
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
        setData((d) => d ? { ...d, following: false, followerCount: Math.max(0, d.followerCount - 1) } : d);
      } else {
        await fetch(`/api/network/follow/${userId}`, { method: "POST" });
        setData((d) => d ? { ...d, following: true, followerCount: d.followerCount + 1 } : d);
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
      setData((d) => d ? { ...d, connectionStatus: "PENDING_SENT" } : d);
    } finally {
      setActionLoading(null);
    }
  }

  const formatDate = (s: string) => new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const roleLabel = (r: string) => r.replace(/_/g, " ");

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const { user, contents, pitches, memberships, posts } = data;
  const isOwnProfile = myId === userId;
  const canFollowOrConnect = myId && !isOwnProfile;

  return (
    <div className="space-y-8">
      {/* Header: avatar, name, headline, location, website, bio, stats, actions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {user.image ? (
              <Image src={user.image} alt="" width={96} height={96} className="object-cover w-full h-full" />
            ) : (
              <span className="text-3xl font-bold text-slate-400">
                {user.name?.[0]?.toUpperCase() ?? "C"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white truncate">
              {user.name ?? "Creator"}
            </h1>
            {user.headline && (
              <p className="text-slate-300">{user.headline}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
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
                  <Globe className="w-4 h-4" /> Website
                </a>
              )}
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">
                {roleLabel(user.role)}
              </span>
            </div>
            {user.bio && (
              <p className="text-slate-400 mt-2 whitespace-pre-wrap">{user.bio}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
              <span>{data.followerCount} followers</span>
              <span>{data.followingCount} following</span>
            </div>
            {canFollowOrConnect && (
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={!!actionLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    data.following
                      ? "bg-slate-700 text-slate-300"
                      : "bg-orange-500 text-white hover:bg-orange-600"
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
                {(data.connectionStatus === "NONE" || data.connectionStatus === "PENDING_RECEIVED") && (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!!actionLoading || data.connectionStatus === "PENDING_SENT"}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 text-white hover:bg-violet-600 text-sm font-medium disabled:opacity-50"
                  >
                    {actionLoading === "connect" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
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
                    href={`/creator/messages?with=${userId}`}
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

      {/* Onboarding / career info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(user.education || user.goals || user.previousWork) && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-orange-400" /> About & career
            </h2>
            <ul className="space-y-2 text-sm text-slate-300">
              {user.education && (
                <li className="flex gap-2">
                  <GraduationCap className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{user.education}</span>
                </li>
              )}
              {user.goals && (
                <li className="flex gap-2">
                  <Target className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{user.goals}</span>
                </li>
              )}
              {user.previousWork && (
                <li className="flex gap-2">
                  <Briefcase className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{user.previousWork}</span>
                </li>
              )}
            </ul>
            {user.isAfdaStudent && (
              <p className="mt-2 text-xs text-orange-400/80">Student films</p>
            )}
          </section>
        )}

        {/* Live on Story Time */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Film className="w-4 h-4 text-orange-400" /> On Story Time
          </h2>
          {contents.length === 0 ? (
            <p className="text-xs text-slate-400">No released content yet.</p>
          ) : (
            <ul className="space-y-2">
              {contents.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/browse/content/${c.id}`}
                    className="flex items-center justify-between gap-2 text-sm text-slate-300 hover:text-orange-400 group"
                  >
                    <span className="truncate">{c.title}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 shrink-0">
                      {c.type}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Projects: pitches + memberships */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-orange-400" /> Projects
        </h2>
        {pitches.length === 0 && memberships.length === 0 ? (
          <p className="text-xs text-slate-400">No projects listed yet.</p>
        ) : (
          <div className="space-y-3">
            {pitches.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm text-slate-300"
              >
                <span className="truncate">{p.title}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                    {p.type}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-500">
                    {p.status}
                  </span>
                </span>
              </div>
            ))}
            {memberships.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 text-sm text-slate-300"
              >
                <span className="truncate">{m.project.title}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-500 text-xs">{m.role}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                    {m.project.type}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Posts */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-xs text-slate-400">No posts yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="py-3 border-b border-slate-800 last:border-0"
              >
                {post.body && (
                  <p className="text-slate-300 whitespace-pre-wrap text-sm">
                    {post.body}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {formatDate(post.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
