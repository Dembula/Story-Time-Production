"use client";

import { useEffect, useState } from "react";
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
  FolderKanban,
  Send,
  MessageSquare,
} from "lucide-react";

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
  projectId: string | null;
  createdAt: string;
  author: PostAuthor;
  content?: { id: string; title: string; type: string; posterUrl: string | null } | null;
  project?: { id: string; title: string; type: string; posterUrl: string | null } | null;
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

export function NetworkClient() {
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [postBody, setPostBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
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

  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/network/connections")
      .then((r) => r.json())
      .then((d) => setConnectionRequests({ received: d.received ?? [] }))
      .catch(() => {});
  }, [tab]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => u?.id && setMyId(u.id))
      .catch(() => {});
  }, []);

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
        .then((d) => setPosts(d.posts ?? []))
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
    setCreators((prev) =>
      prev.map((c) => (c.id === creatorId ? { ...c, following: true } : c))
    );
  }

  async function handleUnfollow(creatorId: string) {
    await fetch(`/api/network/follow/${creatorId}`, { method: "DELETE" });
    setCreators((prev) =>
      prev.map((c) => (c.id === creatorId ? { ...c, following: false } : c))
    );
  }

  async function handleConnect(creatorId: string) {
    if (!myId) return;
    await fetch(`/api/network/connect/${creatorId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    setCreators((prev) =>
      prev.map((c) =>
        c.id === creatorId ? { ...c, connectionStatus: "PENDING_SENT" } : c
      )
    );
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!postBody.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/network/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: postBody.trim() }),
      });
      if (res.ok) {
        setPostBody("");
        const post = await res.json();
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
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
            Network
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            A creative feed just for filmmakers and storytellers. Share scenes, thoughts, frames, and
            find collaborators you actually want to work with.
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-700/60 shadow-[0_0_40px_rgba(248,113,113,0.08)]">
          <button
            type="button"
            onClick={() => setTab("feed")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "feed"
                ? "bg-orange-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Feed
          </button>
          <button
            type="button"
            onClick={() => setTab("discover")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "discover"
                ? "bg-orange-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="w-4 h-4" /> Discover
          </button>
          <button
            type="button"
            onClick={() => setTab("chats")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "chats"
                ? "bg-orange-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Creator Chats
          </button>
        </div>
      </div>

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
                <Link
                  href={`/creator/profile/${r.fromId}`}
                  className="flex items-center gap-2 min-w-0"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {r.from?.image ? (
                      <Image src={r.from.image} alt="" width={32} height={32} className="object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-slate-300">
                        {r.from?.name?.[0] ?? "?"}
                      </span>
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
              <textarea
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                placeholder="Share an update, behind-the-scenes moment, or link to a project..."
                rows={3}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                maxLength={2000}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!postBody.trim() || posting}
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
                  Follow creators from Discover to see their posts here, or be the first to post.
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
                        <Image
                          src={post.author.image}
                          alt=""
                          width={40}
                          height={40}
                          className="object-cover"
                        />
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
                    <span className="text-xs text-slate-500 shrink-0">
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                  {post.body && (
                    <p className="text-slate-200 whitespace-pre-wrap break-words mb-3">
                      {post.body}
                    </p>
                  )}
                  {post.imageUrls && (() => {
                    try {
                      const urls = JSON.parse(post.imageUrls) as string[];
                      if (Array.isArray(urls) && urls.length > 0) {
                        return (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {urls.slice(0, 4).map((url, i) => (
                              <div
                                key={i}
                                className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-800"
                              >
                                <Image src={url} alt="" fill className="object-cover" />
                              </div>
                            ))}
                          </div>
                        );
                      }
                    } catch {}
                    return null;
                  })()}
                  {(post.content || post.project) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {post.content && (
                        <Link
                          href={`/browse/content/${post.content.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm"
                        >
                          <Film className="w-3.5 h-3.5" />
                          {post.content.title}
                        </Link>
                      )}
                      {post.project && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-sm">
                          <FolderKanban className="w-3.5 h-3.5" />
                          {post.project.title}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </>
      )}

      {tab === "discover" && (
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
                      <Image
                        src={creator.image}
                        alt=""
                        width={48}
                        height={48}
                        className="object-cover"
                      />
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
                {creator.bio && (
                  <p className="text-sm text-slate-400 line-clamp-3 mb-2">{creator.bio}</p>
                )}
                {creator.previousWork && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    Recent: {creator.previousWork}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-800">
                  <Link
                    href={`/creator/profile/${creator.id}`}
                    className="flex-1 text-center py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium"
                  >
                    View profile
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
                        <span className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-500 text-sm">
                          Pending
                        </span>
                      )}
                      {creator.connectionStatus === "ACCEPTED" && (
                        <Link
                          href={`/creator/profile/${creator.id}`}
                          className="px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 text-sm font-medium"
                        >
                          Connected
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
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
                1:1 chats unlock when both creators accept a connection request.
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              No creator chats yet. Connect with other creators from the Discover tab – once a
              connection is accepted you&apos;ll be able to chat here.
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4 border-r border-slate-800/80 md:pr-3">
                <ul className="divide-y divide-slate-800">
                  {chats.map((c) => {
                    const first = c.participants[0];
                    const othersLabel =
                      c.participants.length > 1
                        ? `${c.participants[0]?.name ?? "Creator"} +${
                            c.participants.length - 1
                          }`
                        : first?.name ?? "Creator";
                    const isActive = activeChatUserId && first && activeChatUserId === first.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => first && setActiveChatUserId(first.id)}
                          className={[
                            "w-full flex items-center justify-between gap-3 py-3 px-2 rounded-xl text-left transition",
                            isActive
                              ? "bg-slate-800"
                              : "hover:bg-slate-800/60",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {first?.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={first.image}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-slate-300">
                                  {first?.name?.[0]?.toUpperCase() ?? "C"}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {othersLabel}
                              </p>
                              {c.lastMessage && (
                                <p className="text-xs text-slate-400 truncate">
                                  {c.lastMessage.sender.name
                                    ? `${c.lastMessage.sender.name}: `
                                    : ""}
                                  {c.lastMessage.body}
                                </p>
                              )}
                            </div>
                          </div>
                          {c.lastMessage && (
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {new Date(c.lastMessage.createdAt).toLocaleTimeString()}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="col-span-12 md:col-span-8 flex flex-col border-t md:border-t-0 md:pl-1">
                {!activeChatUserId ? (
                  <div className="flex items-center justify-center flex-1 text-sm text-slate-400 py-8">
                    Select a creator on the left to open the conversation.
                  </div>
                ) : chatLoading ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center flex-1 text-xs text-slate-500 py-8">
                          No messages yet. Say hi and start the collaboration.
                        </div>
                      ) : (
                        chatMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`flex ${
                              m.sender.id === myId ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={[
                                "max-w-[70%] rounded-2xl px-3 py-2 text-xs",
                                m.sender.id === myId
                                  ? "bg-orange-500/20 text-orange-100"
                                  : "bg-slate-800 text-slate-100",
                              ].join(" ")}
                            >
                              <p className="font-medium mb-0.5 opacity-80">
                                {m.sender.name ?? "You"}
                              </p>
                              <p className="text-[13px]">{m.body}</p>
                              <p className="mt-1 opacity-50 text-[10px]">
                                {new Date(m.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={sendChatMessage}
                      className="mt-3 flex gap-2 border-t border-slate-800 pt-3"
                    >
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
