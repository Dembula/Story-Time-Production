import { convertToCoreMessages, type UIMessage } from "ai";
import type { ModelMessage } from "ai";
import { MAX_CHAT_TURNS_FOR_MODEL } from "./learning-limits";

function extractTextFromMessage(msg: Record<string, unknown>): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return (msg.content as Array<{ type?: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  if (Array.isArray(msg.parts)) {
    return (msg.parts as Array<{ type?: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

/** Normalize client messages (content and/or parts) for AI SDK v5 conversion. */
export function normalizeToUiMessages(rawMessages: unknown[]): UIMessage[] {
  const normalized: UIMessage[] = [];

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    const role = msg.role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;

    const id = typeof msg.id === "string" ? msg.id : `modoc-msg-${i}`;
    const partsRaw = msg.parts;
    const text = extractTextFromMessage(msg).trim();

    if (Array.isArray(partsRaw) && partsRaw.length > 0) {
      const parts = partsRaw
        .map((part) => {
          if (!part || typeof part !== "object") return null;
          const p = part as { type?: string; text?: string };
          if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
            return { type: "text" as const, text: p.text };
          }
          return null;
        })
        .filter(Boolean) as Array<{ type: "text"; text: string }>;

      if (parts.length > 0) {
        normalized.push({ id, role, parts } as UIMessage);
        continue;
      }
    }

    if (text) {
      normalized.push({
        id,
        role,
        parts: [{ type: "text", text }],
      } as UIMessage);
    }
  }

  return normalized;
}

/** Trim to recent turns so follow-up requests stay within token limits. */
export function trimMessagesForModel(messages: UIMessage[]): UIMessage[] {
  const maxMessages = MAX_CHAT_TURNS_FOR_MODEL * 2;
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

/** Last user message text from raw client messages (content or parts). */
export function getLastUserTextFromRawMessages(rawMessages: unknown[]): string {
  const normalized = normalizeToUiMessages(rawMessages);
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i].role !== "user") continue;
    return (
      normalized[i].parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n") ?? ""
    );
  }
  return "";
}

/** Safe conversion for MODOC chat — never throws on legacy message shapes. */
export function prepareModocModelMessages(rawMessages: unknown[]): ModelMessage[] {
  const ui = trimMessagesForModel(normalizeToUiMessages(rawMessages));
  if (ui.length === 0) return [];
  try {
    return convertToCoreMessages(ui);
  } catch {
    // Last-resort: text-only fallback
    return ui.map((m) => {
      const text = m.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n") ?? "";
      return {
        role: m.role as "user" | "assistant" | "system",
        content: text,
      };
    });
  }
}
