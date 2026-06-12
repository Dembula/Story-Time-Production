"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  X,
  Send,
  Sparkles,
  History,
  MessageSquarePlus,
  ChevronLeft,
  Loader2,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { getModocMessageText } from "./modoc-context";
import { useModoc } from "./use-modoc";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useMotion } from "@/components/motion/motion-provider";
import { viewerMessageVariants } from "@/lib/motion/viewer-presets";
import { getModocRoleProfile } from "@/lib/modoc/role-config";
import { buildModocGreeting } from "@/lib/modoc/greeting";

type ViewerSuggestion = {
  id: string;
  title: string;
  body: string;
  prompt: string;
  priority?: number;
};

type ModocConversationSummary = {
  id: string;
  scope: string | null;
  pageContext: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type ViewerContext = {
  greeting: string;
  isNewSessionToday: boolean;
  selfAwareIntro: string | null;
  suggestions: ViewerSuggestion[];
  learningHint: string | null;
  unreadVaCount: number;
};

function getMessageText(message: Parameters<typeof getModocMessageText>[0]): string {
  return getModocMessageText(message);
}

function formatConversationWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full-screen MODOC for the viewer browse experience. */
export function ModocViewerPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const profile = getModocRoleProfile(role);
  const {
    messages,
    append,
    status,
    error,
    resetChat,
    loadConversation,
    listConversations,
    deleteConversation,
    createNewConversation,
  } = useModoc();

  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [context, setContext] = useState<ViewerContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<ModocConversationSummary[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const openInitializedRef = useRef(false);
  const lastPathnameRef = useRef(pathname);
  const loadContextRef = useRef<() => Promise<void>>(async () => {});

  const { deviceClass } = useAdaptiveUi();
  const { prefersReducedMotion } = useMotion();
  const isMobile = deviceClass === "mobile";

  const contentMatch = pathname.match(/\/browse\/content\/([^/]+)/);
  const contentId = contentMatch?.[1];

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const qs = new URLSearchParams({ scope: "browse" });
      if (contentId) qs.set("contentId", contentId);
      const res = await fetch(`/api/modoc/context?${qs}`);
      if (res.ok) {
        setContext(await res.json());
      } else {
        setContext((prev) =>
          prev ?? {
            greeting: buildModocGreeting(session?.user?.name),
            isNewSessionToday: true,
            selfAwareIntro: profile.emptyHint,
            suggestions: [],
            learningHint: null,
            unreadVaCount: 0,
          },
        );
      }
    } catch {
      setContext((prev) =>
        prev ??
          ({
            greeting: buildModocGreeting(session?.user?.name),
            isNewSessionToday: true,
            selfAwareIntro: profile.emptyHint,
            suggestions: [],
            learningHint: null,
            unreadVaCount: 0,
          } satisfies ViewerContext),
      );
    } finally {
      setContextLoading(false);
    }
  }, [contentId, profile.emptyHint, session?.user?.name]);

  loadContextRef.current = loadContext;

  useEffect(() => setMounted(true), []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 64;
    stickToBottomRef.current = atBottom;
    setShowScrollDown(!atBottom && el.scrollHeight > el.clientHeight + 80);
  }, []);

  const startFreshChat = useCallback(async () => {
    resetChat();
    setInput("");
    setHistoryOpen(false);
    stickToBottomRef.current = true;
    await createNewConversation();
    await loadContext();
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [resetChat, createNewConversation, loadContext, scrollToBottom]);

  useEffect(() => {
    if (!open) {
      openInitializedRef.current = false;
      lastPathnameRef.current = pathname;
      return;
    }
    if (openInitializedRef.current) return;
    openInitializedRef.current = true;
    lastPathnameRef.current = pathname;
    stickToBottomRef.current = true;
    void loadContextRef.current();
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [open, pathname, scrollToBottom]);

  useEffect(() => {
    if (!open || !openInitializedRef.current) return;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    void loadContext();
  }, [open, pathname, loadContext]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(prefersReducedMotion ? "auto" : "smooth");
  }, [messages, status, scrollToBottom, prefersReducedMotion]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("modoc-viewer-open");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      root.classList.remove("modoc-viewer-open");
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const items = await listConversations();
      setHistoryItems(items.filter((item) => item.messageCount > 0 && item.scope === "browse"));
    } finally {
      setHistoryLoading(false);
    }
  }, [listConversations]);

  const removeConversation = useCallback(
    async (id: string) => {
      const ok = await deleteConversation(id);
      if (ok) {
        setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      }
    },
    [deleteConversation],
  );

  const resumeConversation = useCallback(
    async (id: string) => {
      setHistoryOpen(false);
      stickToBottomRef.current = true;
      await loadConversation(id);
      requestAnimationFrame(() => scrollToBottom("auto"));
    },
    [loadConversation, scrollToBottom],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming" || status === "submitted") return;
      stickToBottomRef.current = true;
      append({ role: "user", content: trimmed });
      setInput("");
    },
    [append, status],
  );

  const lastMessage = messages.at(-1);
  const showThinking =
    status === "submitted" ||
    (status === "streaming" && !getMessageText(lastMessage ?? {}));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const renderMessageContent = (content: string) => {
    const linkRegex = /\/browse\/content\/([a-z0-9]+)/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(content)) !== null) {
      parts.push(content.slice(lastIndex, match.index));
      parts.push(
        <Link
          key={match.index}
          href={match[0]}
          className="viewer-motion-surface mt-1 inline-flex items-center gap-1 rounded-lg border border-cyan-400/35 bg-cyan-500/14 px-2.5 py-1 text-sm font-medium text-cyan-200 hover:bg-cyan-500/24"
          onClick={onClose}
        >
          View title →
        </Link>,
      );
      lastIndex = match.index + match[0].length;
    }
    parts.push(content.slice(lastIndex));
    return parts;
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modoc-viewer-title"
          className="fixed inset-0 z-[2000] flex flex-col bg-black"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.07),transparent_42%),radial-gradient(circle_at_80%_100%,rgba(251,146,60,0.06),transparent_38%)]"
            aria-hidden
          />

          <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/8 bg-black/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8 md:pb-4 md:pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              {historyOpen ? (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="viewer-motion-surface shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:text-white"
                  aria-label="Back to chat"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 via-transparent to-orange-400/15 md:h-12 md:w-12">
                  <Bot className="h-6 w-6 text-cyan-300 md:h-7 md:w-7" />
                </div>
              )}
              <div className="min-w-0">
                <h2 id="modoc-viewer-title" className="truncate text-base font-semibold tracking-tight text-white md:text-xl">
                  {historyOpen ? "Chat history" : profile.label}
                </h2>
                <p className="truncate text-[11px] text-slate-400 md:text-sm">
                  {historyOpen ? "Resume a previous discovery chat" : profile.subtitle}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {!historyOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => void openHistory()}
                    className="viewer-motion-surface rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 hover:text-white"
                    aria-label="Chat history"
                  >
                    <History className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void startFreshChat()}
                    className="viewer-motion-surface rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 hover:text-white"
                    aria-label="New chat"
                  >
                    <MessageSquarePlus className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="viewer-motion-surface rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 hover:bg-white/[0.08] hover:text-white"
                aria-label="Close MODOC"
              >
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </div>
          </header>

          {historyOpen ? (
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
              {historyLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
              )}
              {!historyLoading && historyItems.length === 0 && (
                <p className="py-12 text-center text-slate-500">No previous chats yet.</p>
              )}
              {!historyLoading &&
                historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="viewer-motion-surface mb-2 flex w-full items-stretch rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  >
                    <button
                      type="button"
                      onClick={() => void resumeConversation(item.id)}
                      className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="text-sm text-white">
                        {item.messageCount} message{item.messageCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-slate-500">{formatConversationWhen(item.updatedAt)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeConversation(item.id)}
                      className="shrink-0 px-3 text-slate-500 hover:text-red-300"
                      aria-label="Delete chat"
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div
              ref={scrollRef}
              onScroll={handleMessagesScroll}
              className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6"
            >
              <div className="mx-auto flex min-h-full max-w-3xl flex-col space-y-4 md:space-y-5">
                {contextLoading && messages.length === 0 && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-400/70" />
                    <p className="text-sm">Loading catalogue context…</p>
                  </div>
                )}

                {!contextLoading && messages.length === 0 && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-5 py-6 md:py-10"
                  >
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                        <Sparkles className="h-7 w-7 text-cyan-400/85" />
                      </div>
                      <p className="text-lg font-medium text-white md:text-xl">
                        {context?.greeting ?? buildModocGreeting(session?.user?.name)}
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                        {context?.selfAwareIntro ?? profile.emptyHint}
                      </p>
                    </div>

                    {context?.suggestions && context.suggestions.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {context.suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => sendMessage(s.prompt)}
                            className="viewer-motion-surface rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-cyan-400/25 hover:bg-cyan-500/8"
                          >
                            <p className="text-sm font-medium text-cyan-200">{s.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-2">
                      {profile.quickPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => sendMessage(prompt)}
                          className="viewer-motion-surface rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/30 hover:text-white"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    {context?.learningHint && (
                      <p className="text-center text-[11px] text-slate-600">{context.learningHint}</p>
                    )}
                  </motion.div>
                )}

                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const text = getMessageText(message);
                  if (!isUser && !text.trim()) return null;
                  return (
                    <motion.div
                      key={message.id}
                      variants={viewerMessageVariants()}
                      initial={prefersReducedMotion ? false : "hidden"}
                      animate="visible"
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[85%] md:px-5 md:py-3.5 ${
                          isUser
                            ? "border border-orange-400/25 bg-orange-500/12 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                            : "border border-white/10 bg-white/[0.04] text-slate-100"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed md:text-base">
                          {renderMessageContent(text)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {showThinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:300ms]" />
                      </div>
                      <span className="text-sm text-slate-400">Searching catalogue…</span>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-center text-sm text-red-400">
                    {error.message?.includes("503") || error.message?.toLowerCase().includes("configured")
                      ? "AI assistant is not configured. Set OPENROUTER_API_KEY in your environment."
                      : error.message || "Something went wrong. Check your connection and try again."}
                  </p>
                )}
              </div>
            </div>
          )}

          {!historyOpen && showScrollDown && (
            <button
              type="button"
              onClick={() => {
                stickToBottomRef.current = true;
                scrollToBottom(prefersReducedMotion ? "auto" : "smooth");
              }}
              className="absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/85 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md"
            >
              Latest <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          {!historyOpen && (
            <form
              onSubmit={handleSubmit}
              className="relative z-10 shrink-0 border-t border-white/8 bg-black/90 px-4 py-3 backdrop-blur-xl md:px-8 md:py-4"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto flex max-w-3xl gap-2 md:gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe a scene, mood, or ask for a recommendation…"
                  className="viewer-motion-surface viewer-motion-glow min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 md:py-3.5 md:text-base"
                  disabled={status === "streaming" || status === "submitted"}
                  autoFocus={!isMobile}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || status === "streaming" || status === "submitted"}
                  className="viewer-btn-primary flex shrink-0 items-center justify-center rounded-xl px-4 py-3 md:px-5 md:py-3.5 disabled:opacity-40"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </form>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
