"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Loader2, Sparkles, History, MessageSquarePlus, ChevronLeft } from "lucide-react";
import { useModoc } from "./use-modoc";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useMotion } from "@/components/motion/motion-provider";
import { getModocRoleProfile } from "@/lib/modoc/role-config";
import { parseModocActionFromText, stripModocActionLines, type ModocActionType } from "@/lib/modoc/action-types";
import { buildModocGreeting } from "@/lib/modoc/greeting";
import { resolveQuickPromptAction } from "@/lib/modoc/quick-prompt-actions";
import { getModocMessageText } from "./modoc-context";

type ModocConversationSummary = {
  id: string;
  scope: string | null;
  pageContext: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

function formatConversationLabel(conversation: ModocConversationSummary): string {
  const ctx = conversation.pageContext;
  const projectId = typeof ctx?.projectId === "string" ? ctx.projectId : null;
  const tool = typeof ctx?.tool === "string" ? ctx.tool.replace(/-/g, " ") : null;
  if (tool) return tool;
  if (projectId) return `Project chat · ${projectId.slice(0, 8)}…`;
  if (conversation.messageCount > 0) return `${conversation.messageCount} message${conversation.messageCount === 1 ? "" : "s"}`;
  return "Chat";
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

type ModocSuggestion = {
  id: string;
  title: string;
  body: string;
  action: ModocActionType;
  payload: Record<string, string | undefined>;
};

type ModocContext = {
  greeting: string;
  isNewSessionToday: boolean;
  selfAwareIntro: string | null;
  suggestions: ModocSuggestion[];
  learningHint: string | null;
  unreadVaCount: number;
  playbookRuleCount?: number;
  interactionCount?: number;
};

function getMessageText(message: Parameters<typeof getModocMessageText>[0]): string {
  return getModocMessageText(message);
}

export function ModocGlobalPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const profile = getModocRoleProfile(role);
  const {
    messages,
    append,
    status,
    error,
    conversationId,
    createNewConversation,
    resetChat,
    loadConversation,
    listConversations,
    appendAssistantMessage,
  } = useModoc();
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const [actionRunning, setActionRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [context, setContext] = useState<ModocContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<ModocConversationSummary[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const statusRef = useRef(status);
  statusRef.current = status;
  const openInitializedRef = useRef(false);
  const lastPathnameRef = useRef(pathname);
  const createNewConversationRef = useRef(createNewConversation);
  const loadContextRef = useRef<() => Promise<void>>(async () => {});
  const [completedActionKeys, setCompletedActionKeys] = useState<Set<string>>(() => new Set());
  const pendingContextRefreshRef = useRef(false);
  const { deviceClass } = useAdaptiveUi();
  const { prefersReducedMotion } = useMotion();
  const isMobile = deviceClass === "mobile";

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const projectMatch = pathname.match(/\/creator\/projects\/([^/]+)/);
      const qs = projectMatch ? `?projectId=${projectMatch[1]}` : "";
      const res = await fetch(`/api/modoc/context${qs}`);
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
        prev ?? {
          greeting: buildModocGreeting(session?.user?.name),
          isNewSessionToday: true,
          selfAwareIntro: profile.emptyHint,
          suggestions: [],
          learningHint: null,
          unreadVaCount: 0,
        },
      );
    } finally {
      setContextLoading(false);
    }
  }, [pathname, profile.emptyHint, session?.user?.name]);

  createNewConversationRef.current = createNewConversation;
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
    setActionMessage(null);
    setHistoryOpen(false);
    setCompletedActionKeys(new Set());
    stickToBottomRef.current = true;
    await createNewConversation();
    await loadContext();
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [resetChat, createNewConversation, loadContext, scrollToBottom]);

  // Initialize once when the panel opens — do not re-run when route/context callbacks change.
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

    void (async () => {
      setHistoryOpen(false);
      setActionMessage(null);
      await loadContextRef.current();
      requestAnimationFrame(() => scrollToBottom("auto"));
    })();
  }, [open, scrollToBottom]);

  // Refresh workspace context when navigating while the panel stays open.
  useEffect(() => {
    if (!open || !openInitializedRef.current) return;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    void loadContext();
  }, [open, pathname, loadContext]);

  const handleClose = useCallback(() => {
    setInput("");
    setActionMessage(null);
    setHistoryOpen(false);
    setShowScrollDown(false);
    onClose();
  }, [onClose]);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const items = await listConversations();
      setHistoryItems(items.filter((item) => item.messageCount > 0));
    } finally {
      setHistoryLoading(false);
    }
  }, [listConversations]);

  const resumeConversation = useCallback(
    async (id: string) => {
      setHistoryOpen(false);
      setActionMessage(null);
      setCompletedActionKeys(new Set());
      stickToBottomRef.current = true;
      const msgs = await loadConversation(id);
      const last = msgs.at(-1);
      if (last?.role === "assistant") {
        const parsed = parseModocActionFromText(last.content);
        if (parsed) {
          const key = `${last.id}:${parsed.action}:${JSON.stringify(parsed.payload)}`;
          setCompletedActionKeys(new Set([key]));
        }
      }
      requestAnimationFrame(() => scrollToBottom("auto"));
    },
    [loadConversation, scrollToBottom],
  );

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(prefersReducedMotion ? "auto" : "smooth");
  }, [messages, actionMessage, status, scrollToBottom, prefersReducedMotion]);

  useEffect(() => {
    if (status === "ready" && pendingContextRefreshRef.current) {
      pendingContextRefreshRef.current = false;
      void loadContext();
    }
  }, [status, loadContext]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const lastMessage = messages.at(-1);
  const pendingAction =
    lastMessage?.role === "assistant"
      ? parseModocActionFromText(getMessageText(lastMessage))
      : null;
  const pendingActionKey = pendingAction
    ? `${lastMessage?.id ?? "assistant"}:${pendingAction.action}:${JSON.stringify(pendingAction.payload)}`
    : null;

  const actionKey = useCallback(
    (action: string, payload: Record<string, unknown>) =>
      `${action}:${JSON.stringify(payload)}`,
    [],
  );

  const runAction = useCallback(
    async (
      action: string,
      payload: Record<string, unknown>,
      options?: { viaChat?: boolean; force?: boolean; completionKey?: string },
    ) => {
      const key = options?.completionKey ?? actionKey(action, payload);
      if (!options?.force && completedActionKeys.has(key)) return;

      const projectMatch = pathname.match(/\/creator\/projects\/([^/]+)/);
      const resolvedPayload = {
        ...payload,
        projectId:
          (typeof payload.projectId === "string" && payload.projectId) ||
          projectMatch?.[1] ||
          undefined,
      };

      setActionRunning(true);
      setActionMessage(null);
      stickToBottomRef.current = true;

      try {
        const res = await fetch("/api/modoc/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload: resolvedPayload, conversationId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errorText = data.error ?? "Action failed";
          if (options?.viaChat) {
            appendAssistantMessage(`I couldn't complete that: ${errorText}`);
          } else {
            setActionMessage(errorText);
          }
        } else {
          setCompletedActionKeys((prev) => new Set(prev).add(key));
          const successText = data.message ?? "Done.";
          if (options?.viaChat) {
            appendAssistantMessage(`✓ ${successText}`);
          } else {
            setActionMessage(`✓ ${successText}`);
            window.setTimeout(() => setActionMessage(null), 8000);
          }
          pendingContextRefreshRef.current = true;
        }
      } catch {
        const errorText = "Could not run action. Try again.";
        if (options?.viaChat) {
          appendAssistantMessage(errorText);
        } else {
          setActionMessage(errorText);
        }
      } finally {
        setActionRunning(false);
      }
    },
    [actionKey, appendAssistantMessage, completedActionKeys, conversationId, pathname],
  );

  const sendChatAction = useCallback(
    async (
      userText: string,
      executeAction?: { type: ModocActionType; payload: Record<string, string | undefined> },
    ) => {
      if (status === "streaming" || status === "submitted" || actionRunning) return;
      stickToBottomRef.current = true;
      pendingContextRefreshRef.current = true;
      await append(
        { role: "user", content: userText },
        executeAction ? { body: { executeAction } } : undefined,
      );
    },
    [append, status, actionRunning],
  );

  const handleSuggestionClick = useCallback(
    (s: ModocSuggestion) => {
      void sendChatAction(`Yes — ${s.title}. ${s.body}`, {
        type: s.action,
        payload: s.payload,
      });
    },
    [sendChatAction],
  );

  // Auto-run actions the VA proposes in chat (MODOC_ACTION line) — only when idle.
  useEffect(() => {
    if (status !== "ready" || !pendingAction || !pendingActionKey || actionRunning) return;
    if (completedActionKeys.has(pendingActionKey)) return;
    const timer = window.setTimeout(() => {
      if (statusRef.current !== "ready") return;
      void runAction(
        pendingAction.action,
        pendingAction.payload as Record<string, unknown>,
        { viaChat: true, completionKey: pendingActionKey },
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [status, pendingAction, pendingActionKey, actionRunning, runAction, completedActionKeys]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted" || actionRunning) return;
    stickToBottomRef.current = true;
    setActionMessage(null);
    void append({ role: "user", content: text });
    setInput("");
  };

  const handleQuickPrompt = (prompt: string) => {
    const projectMatch = pathname.match(/\/creator\/projects\/([^/]+)/);
    const projectId = projectMatch?.[1];
    const mappedAction = resolveQuickPromptAction(prompt, projectId);
    if (mappedAction) {
      void sendChatAction(prompt, mappedAction);
      return;
    }
    void sendChatAction(prompt);
  };

  const showThinking =
    status === "submitted" ||
    (status === "streaming" && !getMessageText(messages.at(-1) ?? {}));

  if (!mounted) return null;

  const panelWidth = isMobile ? "100%" : "min(420px, calc(100vw - 2rem))";
  const showGreeting = messages.length === 0 && context;

  const panelHeight = isMobile ? "85vh" : "min(640px, calc(100vh - 6rem))";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[1990] bg-black/50 backdrop-blur-sm"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modoc-va-title"
            className="fixed z-[1995] flex flex-col overflow-hidden border border-orange-500/25 bg-gradient-to-b from-slate-950 via-slate-950 to-black shadow-2xl shadow-orange-500/15"
            style={{
              width: panelWidth,
              height: panelHeight,
              maxHeight: panelHeight,
              bottom: isMobile ? 0 : "5.5rem",
              right: isMobile ? 0 : "1.25rem",
              borderRadius: isMobile ? "1.25rem 1.25rem 0 0" : "1.25rem",
              paddingBottom: isMobile ? "env(safe-area-inset-bottom)" : undefined,
            }}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-orange-500/15 bg-orange-500/5 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {historyOpen ? (
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                    aria-label="Back to chat"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                ) : (
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-orange-400/30 bg-orange-500/20">
                    <Image src="/modoc-va-logo.png" alt="" width={40} height={40} className="object-cover" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 id="modoc-va-title" className="truncate text-sm font-semibold text-white">
                    {historyOpen ? "Chat history" : profile.label}
                  </h2>
                  <p className="truncate text-[11px] text-orange-200/70">
                    {historyOpen ? "Previous VA conversations and tasks" : profile.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!historyOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => void openHistory()}
                      className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                      aria-label="Chat history"
                      title="Chat history"
                    >
                      <History className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void startFreshChat()}
                      className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                      aria-label="New chat"
                      title="New chat"
                    >
                      <MessageSquarePlus className="h-5 w-5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close Virtual Assistant"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div
              ref={scrollRef}
              onScroll={handleMessagesScroll}
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 space-y-3"
              aria-label="Virtual Assistant conversation"
            >
              {historyOpen ? (
                <>
                  {historyLoading && (
                    <p className="text-center text-xs text-slate-500">Loading chat history…</p>
                  )}
                  {!historyLoading && historyItems.length === 0 && (
                    <p className="text-center text-sm text-slate-400">No previous chats yet. Start a conversation and it will appear here.</p>
                  )}
                  {!historyLoading &&
                    historyItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void resumeConversation(item.id)}
                        className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-left transition hover:border-orange-500/30 hover:bg-orange-500/5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{formatConversationLabel(item)}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {item.messageCount} message{item.messageCount === 1 ? "" : "s"}
                            {item.scope ? ` · ${item.scope}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500">{formatConversationWhen(item.updatedAt)}</span>
                      </button>
                    ))}
                </>
              ) : (
                <>
              {error && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error.message?.includes("503") || error.message?.toLowerCase().includes("configured")
                    ? "AI assistant is not configured. Set OPENROUTER_API_KEY in your environment."
                    : error.message || "Something went wrong. Try again."}
                </div>
              )}
              {showGreeting && (
                <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent px-4 py-3">
                  <p className="text-base font-semibold text-white">{context.greeting}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                    {context.selfAwareIntro ?? profile.emptyHint}
                  </p>
                  {context.learningHint && (
                    <p className="mt-2 text-[11px] text-orange-200/80 italic">{context.learningHint}</p>
                  )}
                  {(context.playbookRuleCount ?? 0) > 0 && (
                    <p className="mt-1.5 text-[10px] text-slate-500">
                      Auto-learning active · {(context.playbookRuleCount ?? 0).toLocaleString()} behavior rule
                      {(context.playbookRuleCount ?? 0) === 1 ? "" : "s"}
                      {(context.interactionCount ?? 0) > 0
                        ? ` · ${(context.interactionCount ?? 0).toLocaleString()} chats analyzed`
                        : ""}
                    </p>
                  )}
                </div>
              )}

              {contextLoading && !context && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-400/80" />
                  <p className="text-xs text-slate-500">Loading your workspace context…</p>
                </div>
              )}

              {contextLoading && context && messages.length === 0 && (
                <p className="text-center text-[10px] text-slate-600">Updating workspace context…</p>
              )}

              {showGreeting && context.suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-300/80">
                    Suggested for you
                  </p>
                  {context.suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={actionRunning || status === "streaming" || status === "submitted"}
                      onClick={() => handleSuggestionClick(s)}
                      className="w-full rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2.5 text-left transition hover:bg-orange-500/10 disabled:opacity-50"
                    >
                      <p className="text-xs font-medium text-white">{s.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{s.body}</p>
                    </button>
                  ))}
                </div>
              )}

              {messages.length === 0 && profile.quickPrompts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.quickPrompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={actionRunning || status === "streaming" || status === "submitted"}
                      onClick={() => handleQuickPrompt(p)}
                      className="rounded-full border border-orange-500/25 bg-orange-500/8 px-3 py-1.5 text-[11px] text-orange-100 hover:bg-orange-500/15 disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((message) => {
                const isUser = message.role === "user";
                const text = getMessageText(message);
                const displayText = stripModocActionLines(text);
                if (!isUser && !displayText) return null;

                return (
                  <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-gradient-to-br from-orange-500/25 to-orange-600/15 text-white border border-orange-500/20"
                          : "bg-slate-800/70 text-slate-100 border border-slate-700/50"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {displayText.split(/(\/browse\/content\/[a-z0-9]+)/gi).map((part, i) => {
                          if (part.match(/^\/browse\/content\//i)) {
                            return (
                              <Link
                                key={i}
                                href={part}
                                className="mt-1 inline-flex rounded-lg border border-orange-400/30 bg-orange-500/12 px-2 py-0.5 text-xs text-orange-200 hover:bg-orange-500/20"
                                onClick={handleClose}
                              >
                                View title →
                              </Link>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {actionMessage && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100">
                  {actionMessage}
                </div>
              )}

              {pendingAction &&
                status === "ready" &&
                pendingActionKey &&
                !completedActionKeys.has(pendingActionKey) &&
                actionRunning && (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running: {pendingAction.action.replace(/_/g, " ")}…
                  </div>
                )}

              {showThinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-800/60 px-3 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                    <span className="text-xs text-slate-400">Thinking…</span>
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {!historyOpen && (
            <form
              onSubmit={handleSubmit}
              className="relative shrink-0 border-t border-orange-500/10 px-3 py-3"
              style={{ paddingBottom: isMobile ? "max(0.75rem, env(safe-area-inset-bottom))" : undefined }}
            >
              {showScrollDown && (
                <button
                  type="button"
                  onClick={() => {
                    stickToBottomRef.current = true;
                    scrollToBottom(prefersReducedMotion ? "auto" : "smooth");
                    setShowScrollDown(false);
                  }}
                  className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-600/80 bg-slate-900/95 px-3 py-1 text-[11px] text-slate-300 shadow-lg hover:border-orange-500/40 hover:text-white"
                >
                  ↓ Latest messages
                </button>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your VA about your projects, scripts, or schedule…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                  disabled={status === "streaming" || status === "submitted"}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || status === "streaming" || status === "submitted"}
                  className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-3.5 py-2.5 text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
