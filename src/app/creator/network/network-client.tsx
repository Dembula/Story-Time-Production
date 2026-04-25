"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Compass,
  PenLine,
  UserPlus,
  MessageCircle,
  Check,
  Loader2,
  Film,
  Send,
  MessageSquare,
  Upload,
  X,
} from "lucide-react";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

type Tab = "feed" | "discover" | "chats";

interface PostAuthor {
  id: string;
  name: string | null;
  image: string | null;
  headline: string | null;
}

interface FeedPost {
  id: string;
  authorId: string;
  body: string | null;
  imageUrls: string | null;
  contentId: string | null;
  createdAt: string;
  author: PostAuthor;
  content?: { id: string; title: string; type: string; posterUrl: string | null } | null;
}

interface CreatorCard {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  previousWork: string | null;
  headline?: string | null;
  location?: string | null;
  role: string;
  following?: boolean;
  connectionStatus?: string;
  followerCount?: number;
}

interface ProjectOption {
  id: string;
  title: string;
}

/** Supports JSON array, JSON-encoded string, or a single raw https URL stored in DB. */
function parseFeedPostImageUrls(imageUrls: string | null | undefined): string[] {
  if (imageUrls == null) return [];
  const s = String(imageUrls).trim();
  if (!s) return [];
  try {
    const parsed: unknown = JSON.parse(s);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u) => u.trim());
    }
    if (typeof parsed === "string" && parsed.trim().length > 0) return [parsed.trim()];
  } catch {
    /* not JSON */
  }
  if (/^https?:\/\//i.test(s)) return [s];
  return [];
}

function mapApiRowToFeedPost(p: Record<string, unknown>): FeedPost {
  return {
    id: p.id as string,
    authorId: p.authorId as string,
    body: (p.body as string) ?? null,
    imageUrls: typeof p.imageUrls === "string" ? p.imageUrls : p.imageUrls != null ? String(p.imageUrls) : null,
    contentId: (p.contentId as string) ?? null,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(p.createdAt as Date).toISOString(),
    author: (p.author as PostAuthor) ?? {
      id: p.authorId as string,
      name: null,
      image: null,
      headline: null,
    },
    content: p.content as FeedPost["content"],
  };
}

export function NetworkClient() {
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [postBody, setPostBody] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [postImageLocalPreview, setPostImageLocalPreview] = useState<string | null>(null);
  const [postImageUploading, setPostImageUploading] = useState(false);
  const [postImageError, setPostImageError] = useState("");
  const [pasteImageUrlOpen, setPasteImageUrlOpen] = useState(false);
  const [pasteImageUrlDraft, setPasteImageUrlDraft] = useState("");
  const imageUploadGen = useRef(0);
  const [brokenPostImages, setBrokenPostImages] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteRole, setInviteRole] = useState("Collaborator");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const searchParams = useSearchParams();

  const [connectionRequests, setConnectionRequests] = useState<{
    received: { id: string; fromId: string; from: { id: string; name: string | null; image: string | null } }[];
  }>({ received: [] });
  const [chats, setChats] = useState<
    {
      id: string;
      participants: { id: string; name: string | null; image: string | null }[];
      lastMessage: {
        id: string;
        body: string;
        createdAt: string;
        sender: { id: string; name: string | null };
      } | null;
    }[]
  >([]);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { id: string; body: string; createdAt: string; sender: { id: string; name: string | null } }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    fetch("/api/network/connections")
      .then((r) => r.json())
      .then((d) => setConnectionRequests({ received: d.received ?? [] }))
      .catch(() => {});
  }, [tab]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => {
        if (u?.id) setMyId(u.id);
        if (u?.role) setMyRole(u.role);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (myRole === "CONTENT_CREATOR" || myRole === "ADMIN") {
      fetch("/api/creator/projects")
        .then((r) => (r.ok ? r.json() : { projects: [] }))
        .then((d) =>
          setProjects((d.projects ?? []).map((p: { id: string; title: string }) => ({ id: p.id, title: p.title }))),
        )
        .catch(() => setProjects([]));
    }
  }, [myRole]);

  useEffect(() => {
    const chatWith = searchParams.get("chatWith");
    if (chatWith) {
      setTab("chats");
      setActiveChatUserId(chatWith);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    if (tab === "feed") {
      fetch(`/api/network/posts?mode=feed&limit=30`)
        .then((r) => r.json())
        .then((d) => {
          const raw = d.posts ?? [];
          setPosts(raw.map((p: Record<string, unknown>) => mapApiRowToFeedPost(p)));
        })
        .catch(() => setPosts([]))
        .finally(() => setLoading(false));
    } else if (tab === "discover") {
      fetch("/api/network/creators")
        .then((r) => r.json())
        .then((d) => setCreators(d.creators ?? []))
        .catch(() => setCreators([]))
        .finally(() => setLoading(false));
    } else if (tab === "chats") {
      fetch("/api/network/chats")
        .then((r) => (r.ok ? r.json() : { conversations: [] }))
        .then((d) => setChats(d.conversations ?? []))
        .catch(() => setChats([]))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "feed") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/network/posts?mode=feed&limit=30`)
        .then((r) => r.json())
        .then((d) => {
          const raw = d.posts ?? [];
          setPosts(raw.map((p: Record<string, unknown>) => mapApiRowToFeedPost(p)));
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tab]);

  useEffect(() => {
    if (tab !== "chats" || !activeChatUserId) {
      setChatMessages([]);
      return;
    }
    setChatLoading(true);
    fetch(`/api/network/chats/${activeChatUserId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setChatMessages(d?.messages ?? []))
      .catch(() => setChatMessages([]))
      .finally(() => setChatLoading(false));
  }, [tab, activeChatUserId]);

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChatUserId || !chatInput.trim()) return;
    const body = chatInput.trim();
    setChatInput("");
    const res = await fetch(`/api/network/chats/${activeChatUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const msg = await res.json();
      setChatMessages((prev) => [...prev, msg]);
    }
  }

  async function handleFollow(creatorId: string) {
    if (!myId) return;
    await fetch(`/api/network/follow/${creatorId}`, { method: "POST" });
    setCreators((prev) => prev.map((c) => (c.id === creatorId ? { ...c, following: true } : c)));
  }

  async function handleUnfollow(creatorId: string) {
    await fetch(`/api/network/follow/${creatorId}`, { method: "DELETE" });
    setCreators((prev) => prev.map((c) => (c.id === creatorId ? { ...c, following: false } : c)));
  }

  async function handleConnect(creatorId: string) {
    if (!myId) return;
    await fetch(`/api/network/connect/${creatorId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    setCreators((prev) => prev.map((c) => (c.id === creatorId ? { ...c, connectionStatus: "PENDING_SENT" } : c)));
  }

  async function sendProjectInvite() {
    if (!inviteTargetId || !inviteProjectId || inviteSending) return;
    setInviteSending(true);
    setInviteMessage("");
    try {
      const res = await fetch("/api/network/invite-to-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: inviteProjectId,
          inviteeUserId: inviteTargetId,
          role: inviteRole.trim() || "Collaborator",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInviteMessage("Invite sent. They’ll see it under My Projects → collaboration invites.");
        setInviteTargetId(null);
        setInviteProjectId("");
      } else {
        setInviteMessage(data.error || "Could not send invite.");
      }
    } finally {
      setInviteSending(false);
    }
  }

  function clearPostAttachment() {
    setPostImageLocalPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setPostImageUrl("");
    setPostImageError("");
    setPasteImageUrlDraft("");
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    const hasText = postBody.trim().length > 0;
    const hasImage = postImageUrl.trim().length > 0;
    if ((!hasText && !hasImage) || posting || postImageUploading) return;
    setPosting(true);
    try {
      const imageUrls = postImageUrl.trim() ? [postImageUrl.trim()] : undefined;
      const res = await fetch("/api/network/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: hasText ? postBody.trim() : null,
          ...(imageUrls ? { imageUrls } : {}),
        }),
      });
      if (res.ok) {
        const row = (await res.json()) as Record<string, unknown>;
        const post = mapApiRowToFeedPost(row);
        setPostBody("");
        setPostImageLocalPreview((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setPostImageUrl("");
        setPosts((prev) => [post, ...prev]);
      }
    } finally {
      setPosting(false);
    }
  }

  async function respondToRequest(requestId: string, accept: boolean) {
    await fetch(`/api/network/connections/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: accept ? "accept" : "decline" }),
    });
    setConnectionRequests((prev) => ({
      ...prev,
      received: prev.received.filter((r) => r.id !== requestId),
    }));
  }

  const formatDate = (s: string) => {
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-4 md:p-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Network</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Follow people you like, connect to start chats, and share what you are working on.
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-700/60 shadow-[0_0_40px_rgba(248,113,113,0.08)]">
          <button
            type="button"
            onClick={() => setTab("feed")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "feed" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Feed
          </button>
          <button
            type="button"
            onClick={() => setTab("discover")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "discover" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="w-4 h-4" /> Discover
          </button>
          <button
            type="button"
            onClick={() => setTab("chats")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "chats" ? "bg-orange-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Chats
          </button>
        </div>
      </div>

      {inviteMessage && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">{inviteMessage}</div>
      )}

      {connectionRequests.received.length > 0 && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-violet-400" />
            Connection requests
          </h3>
          <ul className="space-y-2">
            {connectionRequests.received.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/50 last:border-0"
              >
                <Link href={`/creator/profile/${r.fromId}`} className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {r.from?.image ? (
                      <Image src={r.from.image} alt="" width={32} height={32} className="object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-slate-300">{r.from?.name?.[0] ?? "?"}</span>
                    )}
                  </div>
                  <span className="text-sm text-white truncate">{r.from?.name ?? "Someone"}</span>
                </Link>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => respondToRequest(r.id, true)}
                    className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium hover:bg-violet-600"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToRequest(r.id, false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-600"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "feed" && (
        <>
          <form
            onSubmit={submitPost}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(15,23,42,0.8)]"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                <PenLine className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share an update, behind-the-scenes moment, or thought…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  maxLength={2000}
                />
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 shrink-0">
                      {postImageUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {postImageUploading ? "Uploading in background…" : "Attach image"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setPostImageError("");
                          imageUploadGen.current += 1;
                          const gen = imageUploadGen.current;
                          setPostImageLocalPreview((prev) => {
                            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(file);
                          });
                          setPostImageUrl("");
                          setPostImageUploading(true);
                          void (async () => {
                            try {
                              const publicUrl = await uploadContentMediaViaApi(file);
                              if (gen !== imageUploadGen.current) return;
                              setPostImageLocalPreview((prev) => {
                                if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                                return null;
                              });
                              setPostImageUrl(publicUrl);
                            } catch (uploadErr) {
                              if (gen !== imageUploadGen.current) return;
                              setPostImageError(
                                uploadErr instanceof Error ? uploadErr.message : "Image upload failed.",
                              );
                              setPostImageLocalPreview((prev) => {
                                if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                                return null;
                              });
                            } finally {
                              if (gen === imageUploadGen.current) setPostImageUploading(false);
                            }
                          })();
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPasteImageUrlOpen((o) => !o);
                        setPostImageError("");
                      }}
                      className="text-xs text-slate-400 hover:text-orange-400 underline-offset-2 hover:underline"
                    >
                      {pasteImageUrlOpen ? "Hide paste URL" : "Paste image URL instead"}
                    </button>
                  </div>
                  {postImageLocalPreview || postImageUrl ? (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/80 p-3">
                      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-800 ring-1 ring-slate-600/80">
                        {/* eslint-disable-next-line @next/next/no-img-element -- blob: and arbitrary storage URLs */}
                        <img
                          src={postImageLocalPreview || postImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {postImageUploading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px]">
                            <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs text-slate-400">
                          {postImageUploading
                            ? "You can keep writing your post while the image uploads."
                            : postImageUrl
                              ? "Image ready to post."
                              : null}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            imageUploadGen.current += 1;
                            clearPostAttachment();
                            setPostImageUploading(false);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          <X className="h-3 w-3" />
                          Remove image
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {pasteImageUrlOpen ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={pasteImageUrlDraft}
                        onChange={(e) => setPasteImageUrlDraft(e.target.value)}
                        placeholder="https://… (direct image link)"
                        className="w-full min-w-0 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const u = pasteImageUrlDraft.trim();
                          if (!/^https?:\/\//i.test(u)) {
                            setPostImageError("Paste a full image URL (https://…)");
                            return;
                          }
                          imageUploadGen.current += 1;
                          setPostImageLocalPreview((prev) => {
                            if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                            return null;
                          });
                          setPostImageUrl(u);
                          setPostImageError("");
                          setPostImageUploading(false);
                        }}
                        className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
                      >
                        Use URL
                      </button>
                    </div>
                  ) : null}
                </div>
                {postImageError ? <p className="text-xs text-amber-300">{postImageError}</p> : null}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  (!postBody.trim() && !postImageUrl.trim()) || posting || postImageUploading
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 disabled:pointer-events-none"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post
              </button>
            </div>
          </form>

          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-white">No posts in your feed yet</p>
                <p className="text-sm mt-1">
                  Follow creators from Discover to see their updates here, or share your own posts below—they stay in
                  your feed.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("discover")}
                  className="mt-4 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-sm font-medium"
                >
                  Discover creators
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 hover:border-orange-500/40 hover:bg-slate-900 transition"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Link
                      href={`/creator/profile/${post.authorId}`}
                      className="shrink-0 w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden"
                    >
                      {post.author?.image ? (
                        <Image src={post.author.image} alt="" width={40} height={40} className="object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-slate-300">
                          {post.author?.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/creator/profile/${post.authorId}`}
                        className="font-semibold text-white hover:text-orange-400 truncate block"
                      >
                        {post.author?.name ?? "Creator"}
                      </Link>
                      {(post.author?.headline || post.createdAt) && (
                        <p className="text-xs text-slate-500 truncate">
                          {post.author?.headline || formatDate(post.createdAt)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{formatDate(post.createdAt)}</span>
                  </div>
                  {post.body && <p className="text-slate-200 whitespace-pre-wrap break-words mb-3">{post.body}</p>}
                  {(() => {
                    const urls = parseFeedPostImageUrls(post.imageUrls);
                    if (urls.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {urls.slice(0, 4).map((url, i) => (
                          <div key={`${post.id}-${i}`} className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800">
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={() => setBrokenPostImages((prev) => ({ ...prev, [url]: true }))}
                            />
                            {brokenPostImages[url] ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute inset-0 flex items-center justify-center bg-slate-900/85 px-1 text-center text-[10px] text-orange-300 underline"
                              >
                                Open file
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {post.content && (
                    <Link
                      href={`/browse/content/${post.content.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm"
                    >
                      <Film className="w-3.5 h-3.5" />
                      {post.content.title}
                    </Link>
                  )}
                </article>
              ))
            )}
          </div>
        </>
      )}

      {tab === "discover" && (
        <div className="space-y-4">
          {inviteTargetId && projects.length > 0 && (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm">
              <p className="text-white font-medium mb-2">Invite to project</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={inviteProjectId}
                  onChange={(e) => setInviteProjectId(e.target.value)}
                  className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-xs"
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <input
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  placeholder="Role on project"
                  className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-xs min-w-[140px]"
                />
                <button
                  type="button"
                  disabled={inviteSending || !inviteProjectId}
                  onClick={sendProjectInvite}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-medium disabled:opacity-50"
                >
                  {inviteSending ? "Sending…" : "Send invite"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInviteTargetId(null);
                    setInviteProjectId("");
                  }}
                  className="px-3 py-2 text-slate-400 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            ) : (
              creators.map((creator) => (
                <div
                  key={creator.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 hover:border-orange-500/40 transition flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Link
                      href={`/creator/profile/${creator.id}`}
                      className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0"
                    >
                      {creator.image ? (
                        <Image src={creator.image} alt="" width={48} height={48} className="object-cover" />
                      ) : (
                        <span className="text-lg font-semibold text-slate-300">
                          {creator.name?.[0]?.toUpperCase() ?? "C"}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/creator/profile/${creator.id}`}
                        className="font-semibold text-white hover:text-orange-400 block truncate"
                      >
                        {creator.name ?? "Creator"}
                      </Link>
                      {(creator.headline || creator.location) && (
                        <p className="text-xs text-slate-500 truncate">
                          {[creator.headline, creator.location].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {creator.bio && <p className="text-sm text-slate-400 line-clamp-3 mb-2">{creator.bio}</p>}
                  {creator.previousWork && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">Recent: {creator.previousWork}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-auto pt-3 border-t border-slate-800">
                    <Link
                      href={`/creator/profile/${creator.id}`}
                      className="flex-1 text-center py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium"
                    >
                      Profile
                    </Link>
                    {creator.id !== myId && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            creator.following ? handleUnfollow(creator.id) : handleFollow(creator.id)
                          }
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                            creator.following
                              ? "bg-slate-700 text-slate-300"
                              : "bg-orange-500 text-white hover:bg-orange-600"
                          }`}
                        >
                          {creator.following ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                          {creator.following ? "Following" : "Follow"}
                        </button>
                        {(creator.connectionStatus === "NONE" || !creator.connectionStatus) && (
                          <button
                            type="button"
                            onClick={() => handleConnect(creator.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/80 text-white hover:bg-violet-500 text-sm font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Connect
                          </button>
                        )}
                        {creator.connectionStatus === "PENDING_SENT" && (
                          <span className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-500 text-sm">Pending</span>
                        )}
                        {creator.connectionStatus === "ACCEPTED" && (
                          <Link
                            href={`/creator/network?chatWith=${creator.id}`}
                            className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 text-sm font-medium"
                          >
                            Chat
                          </Link>
                        )}
                        {(myRole === "CONTENT_CREATOR" || myRole === "ADMIN") && projects.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setInviteTargetId(creator.id);
                              setInviteProjectId("");
                            }}
                            className="px-3 py-2 rounded-lg border border-orange-500/40 text-orange-200 text-xs font-medium hover:bg-orange-500/10"
                          >
                            Invite to project
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {!loading && creators.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400">
              No other creators found yet. As more join Story Time, they’ll appear here.
            </div>
          )}
        </div>
      )}

      {tab === "chats" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-400" />
                Creator chats
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chats unlock when both creators accept a connection request.
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              No chats yet. Connect from Discover — once accepted you can chat here.
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4 border-r border-slate-800/80 md:pr-3">
                <ul className="divide-y divide-slate-800">
                  {chats.map((c) => {
                    const first = c.participants[0];
                    const othersLabel =
                      c.participants.length > 1
                        ? `${c.participants[0]?.name ?? "Creator"} +${c.participants.length - 1}`
                        : first?.name ?? "Creator";
                    const isActive = activeChatUserId && first && activeChatUserId === first.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => first && setActiveChatUserId(first.id)}
                          className={[
                            "w-full flex items-center justify-between gap-3 py-3 px-2 rounded-xl text-left transition",
                            isActive ? "bg-slate-800" : "hover:bg-slate-800/60",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {first?.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={first.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-semibold text-slate-300">
                                  {first?.name?.[0]?.toUpperCase() ?? "C"}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{othersLabel}</p>
                              {c.lastMessage && (
                                <p className="text-xs text-slate-400 truncate">
                                  {c.lastMessage.sender.name ? `${c.lastMessage.sender.name}: ` : ""}
                                  {c.lastMessage.body}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="col-span-12 md:col-span-8 flex flex-col border-t md:border-t-0 md:pl-1">
                {!activeChatUserId ? (
                  <div className="flex items-center justify-center flex-1 text-sm text-slate-400 py-8">
                    Select a conversation.
                  </div>
                ) : chatLoading ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[360px]">
                      {chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center flex-1 text-xs text-slate-500 py-8">
                          No messages yet. Say hi.
                        </div>
                      ) : (
                        chatMessages.map((m) => (
                          <div key={m.id} className={`flex ${m.sender.id === myId ? "justify-end" : "justify-start"}`}>
                            <div
                              className={[
                                "max-w-[70%] rounded-2xl px-3 py-2 text-xs",
                                m.sender.id === myId
                                  ? "bg-orange-500/20 text-orange-100"
                                  : "bg-slate-800 text-slate-100",
                              ].join(" ")}
                            >
                              <p className="font-medium mb-0.5 opacity-80">{m.sender.name ?? "You"}</p>
                              <p className="text-[13px]">{m.body}</p>
                              <p className="mt-1 opacity-50 text-[10px]">{new Date(m.createdAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form onSubmit={sendChatMessage} className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
