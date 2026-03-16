"use client";

import {
  createContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";

/** Extra context sent to MODOC with each request so the AI knows where the user is in the app */
export interface ModocRequestContext {
  /** e.g. "admin", "creator", "project/abc" */
  scope?: string;
  /** e.g. "Viewing the Originals pitch list" */
  clientContext?: string;
  /** e.g. { projectId: "x", projectName: "My Film" } */
  pageContext?: Record<string, string | number | boolean | null>;
}

function getMessageContent(msg: { content?: unknown }): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    const part = msg.content.find((p: { type?: string; text?: string }) => p.type === "text");
    return (part as { text?: string } | undefined)?.text ?? "";
  }
  return "";
}

interface ModocContextValue {
  /** Current conversation messages */
  messages: ReturnType<typeof useChat>["messages"];
  /** Append a user message (text string or CreateMessage). Triggers MODOC reply. */
  append: ReturnType<typeof useChat>["append"];
  /** Status: "ready" | "streaming" | "submitted" | "error" */
  status: ReturnType<typeof useChat>["status"];
  /** Error from the last request, if any */
  error: ReturnType<typeof useChat>["error"];
  /** Whether MODOC is available (API configured) */
  isAvailable: boolean;
  /** Current conversation id (when persisting to DB); null for ephemeral chats */
  conversationId: string | null;
  /** Set scope sent with the next request (e.g. "admin", "creator") */
  setScope: (scope: string | undefined) => void;
  /** Set client context string (e.g. "On the script review page") */
  setClientContext: (clientContext: string | undefined) => void;
  /** Set page context object (e.g. { projectId, projectName }) */
  setPageContext: (pageContext: Record<string, string | number | boolean | null> | undefined) => void;
  /** One-shot: set all request context at once */
  setRequestContext: (ctx: ModocRequestContext) => void;
  /** Create a new persisted conversation; use before sending messages to save history */
  createNewConversation: () => Promise<string | null>;
  /** Load a conversation by id (sets messages and conversationId) */
  loadConversation: (id: string) => Promise<void>;
  /** Clear current conversation id (e.g. start new chat without creating DB row yet) */
  clearConversationId: () => void;
}

const ModocContext = createContext<ModocContextValue | null>(null);

const MODOC_CHAT_API = "/api/modoc/chat";

export function ModocProvider({ children }: { children: ReactNode }) {
  const requestContextRef = useRef<ModocRequestContext>({});
  const conversationIdRef = useRef<string | null>(null);
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [isAvailable] = useState(true);

  const setConversationId = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationIdState(id);
  }, []);

  const chat = useChat({
    api: MODOC_CHAT_API,
    experimental_prepareRequestBody: ({ id, messages, requestBody }) => {
      const base = (requestBody ?? {}) as Record<string, unknown>;
      return {
        ...base,
        id,
        messages,
        conversationId: conversationIdRef.current ?? undefined,
        scope: requestContextRef.current.scope,
        clientContext: requestContextRef.current.clientContext,
        pageContext: requestContextRef.current.pageContext,
      };
    },
    onFinish: useCallback((message: { role?: string; content?: unknown }) => {
      const cid = conversationIdRef.current;
      if (!cid || message.role !== "assistant") return;
      const content = getMessageContent(message as { content?: unknown });
      if (!content) return;
      fetch(`/api/modoc/conversations/${cid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content }),
      }).catch(() => {});
    }, []),
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
  }, []);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/modoc/conversations/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
        };
        const msgs = (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));
        chat.setMessages(msgs);
        setConversationId(id);
      } catch {
        // ignore
      }
    },
    [chat]
  );

  const clearConversationId = useCallback(() => {
    setConversationId(null);
  }, [setConversationId]);

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
    []
  );

  const setRequestContext = useCallback((ctx: ModocRequestContext) => {
    requestContextRef.current = {
      scope: ctx.scope,
      clientContext: ctx.clientContext,
      pageContext: ctx.pageContext,
    };
  }, []);

  const value: ModocContextValue = {
    messages: chat.messages,
    append: chat.append,
    status: chat.status,
    error: chat.error,
    isAvailable,
    conversationId,
    setScope,
    setClientContext,
    setPageContext,
    setRequestContext,
    createNewConversation,
    loadConversation,
    clearConversationId,
  };

  return (
    <ModocContext.Provider value={value}>{children}</ModocContext.Provider>
  );
}

export { ModocContext };
