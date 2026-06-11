import { convertToModelMessages, type UIMessage } from "ai";
import type { ModelMessage } from "ai";
import { stripModocActionLines } from "./action-types";
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

/** Merge back-to-back assistant turns into one model message. */
function mergeConsecutiveAssistantMessages(messages: UIMessage[]): UIMessage[] {
  const merged: UIMessage[] = [];

  for (const message of messages) {
    const prev = merged.at(-1);
    if (message.role === "assistant" && prev?.role === "assistant") {
      const prevText =
        prev.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n\n") ?? "";
      const nextText =
        message.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n\n") ?? "";
      const combined = [prevText, nextText].filter(Boolean).join("\n\n");
      merged[merged.length - 1] = {
        ...prev,
        parts: combined ? [{ type: "text", text: combined }] : [],
      };
      continue;
    }
    merged.push(message);
  }

  return merged;
}

/** Normalize client messages (content and/or parts) for AI SDK conversion. */
export function normalizeToUiMessages(rawMessages: unknown[]): UIMessage[] {
  const normalized: UIMessage[] = [];

  for (let i = 0; i < rawMessages.length; i++) {
    const raw = rawMessages[i];
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    const role = msg.role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;

    const id = typeof msg.id === "string" ? msg.id : `modoc-msg-${i}`;
    let text = extractTextFromMessage(msg).trim();
    if (role === "assistant") {
      text = stripModocActionLines(text);
    }
    if (!text) continue;

    normalized.push({
      id,
      role,
      parts: [{ type: "text", text }],
    } as UIMessage);
  }

  return mergeConsecutiveAssistantMessages(normalized);
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
export async function prepareModocModelMessages(rawMessages: unknown[]): Promise<ModelMessage[]> {
  const ui = trimMessagesForModel(normalizeToUiMessages(rawMessages));
  if (ui.length === 0) return [];
  try {
    return await convertToModelMessages(ui);
  } catch {
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
