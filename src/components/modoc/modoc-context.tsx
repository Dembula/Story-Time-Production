"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

/** Extra context sent to MODOC with each request so the AI knows where the user is in the app */
export interface ModocRequestContext {
  /** e.g. "admin", "creator", "project/abc" */
  scope?: string;
  /** e.g. "Viewing the Originals pitch list" */
  clientContext?: string;
  /** e.g. { projectId: "x", projectName: "My Film" } */
  pageContext?: Record<string, string | number | boolean | null>;
}

export function getModocMessageText(message: {
  content?: unknown;
  parts?: Array<{ type?: string; text?: string }>;
}): string {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return (message.content as Array<{ type?: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

interface ModocContextValue {
  messages: UIMessage[];
  /** Append a user message and trigger a VA reply (compat wrapper around sendMessage). */
  append: (
    message: { role: string; content: string },
    options?: { body?: object },
  ) => Promise<void>;
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  isAvailable: boolean;
  conversationId: string | null;
  setScope: (scope: string | undefined) => void;
  setClientContext: (clientContext: string | undefined) => void;
  setPageContext: (pageContext: Record<string, string | number | boolean | null> | undefined) => void;
  setRequestContext: (ctx: ModocRequestContext) => void;
  createNewConversation: () => Promise<string | null>;
  loadConversation: (id: string) => Promise<
    Array<{ id: string; role: "user" | "assistant" | "system"; content: string }>
  >;
  clearConversationId: () => void;
  resetChat: () => void;
  appendAssistantMessage: (content: string) => void;
  listConversations: () => Promise<
    Array<{
      id: string;
      scope: string | null;
      pageContext: Record<string, unknown> | null;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }>
  >;
}

const ModocContext = createContext<ModocContextValue | null>(null);

const MODOC_CHAT_API = "/api/modoc/chat";

export function ModocProvider({ children }: { children: ReactNode }) {
  const requestContextRef = useRef<ModocRequestContext>({});
  const conversationIdRef = useRef<string | null>(null);
  const creatingConversationRef = useRef<Promise<string | null> | null>(null);
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [isAvailable] = useState(true);

  const setConversationId = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationIdState(id);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: MODOC_CHAT_API,
        prepareSendMessagesRequest: ({ id, messages, body }) => {
          const base = (body ?? {}) as Record<string, unknown>;
          const sanitized = messages
            .map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts.filter(
                (p): p is { type: "text"; text: string } =>
                  p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0,
              ),
            }))
            .filter((m) => m.parts.length > 0);
          return {
            body: {
              ...base,
              id,
              messages: sanitized,
              conversationId: conversationIdRef.current ?? undefined,
              scope: requestContextRef.current.scope,
              clientContext: requestContextRef.current.clientContext,
              pageContext: requestContextRef.current.pageContext,
            },
          };
        },
      }),
    [],
  );

  const handleChatFinish = useCallback(
    ({
      message,
      isError,
      isAbort,
    }: {
      message: UIMessage;
      isError: boolean;
      isAbort: boolean;
    }) => {
    const cid = conversationIdRef.current;
    if (!cid || message.role !== "assistant" || isError || isAbort) return;
    const content = getModocMessageText(message);
    if (!content) return;
    fetch(`/api/modoc/conversations/${cid}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "assistant", content }),
    }).catch(() => {});
  },
  [],
  );

  const handleChatError = useCallback((err: Error) => {
    console.error("MODOC chat error:", err);
  }, []);

  const { messages, sendMessage, setMessages, status, error, clearError } = useChat({
    transport,
    onFinish: handleChatFinish,
    onError: handleChatError,
  });

  const createNewConversation = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/modoc/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: requestContextRef.current.scope,
          pageContext: requestContextRef.current.pageContext,
        }),
      });
      if (!res.ok) return null;
      const { id } = (await res.json()) as { id: string };
      setConversationId(id);
      return id;
    } catch {
      return null;
    }
  }, [setConversationId]);

  const ensureConversation = useCallback(async () => {
    if (conversationIdRef.current) return;
    if (!creatingConversationRef.current) {
      creatingConversationRef.current = createNewConversation().finally(() => {
        creatingConversationRef.current = null;
      });
    }
    await creatingConversationRef.current;
  }, [createNewConversation]);

  const append = useCallback<ModocContextValue["append"]>(
    async (message, options) => {
      await ensureConversation();
      if (message.role !== "user") return;
      const text = message.content.trim();
      if (!text) return;
      clearError();
      await sendMessage({ text }, { body: options?.body });
    },
    [ensureConversation, sendMessage, clearError],
  );

  const appendAssistantMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const id = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          parts: [{ type: "text", text: trimmed }],
        },
      ]);
      const cid = conversationIdRef.current;
      if (cid) {
        fetch(`/api/modoc/conversations/${cid}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: trimmed }),
        }).catch(() => {});
      }
    },
    [setMessages],
  );

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/modoc/conversations/${id}`);
        if (!res.ok) return [];
        const data = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
        };
        const legacy = data.messages ?? [];
        const msgs: UIMessage[] = legacy.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts: [{ type: "text" as const, text: m.content }],
        }));
        setMessages(msgs);
        setConversationId(id);
        return legacy.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));
      } catch {
        return [];
      }
    },
    [setMessages, setConversationId],
  );

  const clearConversationId = useCallback(() => {
    setConversationId(null);
  }, [setConversationId]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, [setMessages, setConversationId]);

  const listConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/modoc/conversations");
      if (!res.ok) return [];
      return (await res.json()) as Array<{
        id: string;
        scope: string | null;
        pageContext: Record<string, unknown> | null;
        createdAt: string;
        updatedAt: string;
        messageCount: number;
      }>;
    } catch {
      return [];
    }
  }, []);

  const setScope = useCallback((scope: string | undefined) => {
    requestContextRef.current.scope = scope;
  }, []);

  const setClientContext = useCallback((clientContext: string | undefined) => {
    requestContextRef.current.clientContext = clientContext;
  }, []);

  const setPageContext = useCallback(
    (pageContext: Record<string, string | number | boolean | null> | undefined) => {
      requestContextRef.current.pageContext = pageContext;
    },
    [],
  );

  const setRequestContext = useCallback((ctx: ModocRequestContext) => {
    requestContextRef.current = {
      scope: ctx.scope,
      clientContext: ctx.clientContext,
      pageContext: ctx.pageContext,
    };
  }, []);

  const value: ModocContextValue = {
    messages,
    append,
    status,
    error,
    isAvailable,
    conversationId,
    setScope,
    setClientContext,
    setPageContext,
    setRequestContext,
    createNewConversation,
    loadConversation,
    clearConversationId,
    resetChat,
    appendAssistantMessage,
    listConversations,
  };

  return <ModocContext.Provider value={value}>{children}</ModocContext.Provider>;
}

export { ModocContext };
