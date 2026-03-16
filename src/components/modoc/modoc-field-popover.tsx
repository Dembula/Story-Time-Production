"use client";

import { useEffect, useRef, useState } from "react";
import { useModoc } from "./use-modoc";
import { Bot, X, Sparkles, CheckCircle } from "lucide-react";

export interface ModocFieldContext {
  title?: string;
  logline?: string;
  notesExcerpt?: string;
  scriptExcerpt?: string;
}

interface ModocFieldPopoverProps {
  open: boolean;
  onClose: () => void;
  /** Which field/section: logline, idea_notes, script */
  task: "logline" | "idea_notes" | "script";
  /** Current field values so MODOC can read and respond */
  context: ModocFieldContext;
  /** Callback to paste MODOC's suggestion into the field */
  onIncorporate: (text: string) => void;
  /** Label for this section in the header (e.g. "logline", "idea notes", "script") */
  sectionLabel: string;
  /** Optional project id for script task */
  projectId?: string | null;
}

function buildPrompt(task: string, ctx: ModocFieldContext): string {
  switch (task) {
    case "logline":
      return `Give me on-the-spot feedback on my logline.\n\nIdea title: ${ctx.title ?? "(none)"}\nCurrent logline: ${ctx.logline?.trim() || "(empty)"}\n\nShare brief feedback and, if you have one, a suggested revised logline (prefix it with "Suggested logline:" so I can paste it).`;
    case "idea_notes":
      return `Looking at my idea so far, give me pointers on my notes.\n\nIdea title: ${ctx.title ?? "(none)"}\nLogline: ${ctx.logline ?? "(none)"}\n\nMy idea notes so far:\n${ctx.notesExcerpt ?? "(empty)"}\n\nRespond in a supportive way (e.g. "Looking at your idea and logline, I think…") and if you have something I could add to my notes, put it in a clear "You could add:" or "Suggested addition:" block so I can paste it.`;
    case "script":
      return `I'm writing a script${ctx.title ? ` for "${ctx.title}"` : ""}. ${ctx.logline ? `Logline: ${ctx.logline}\n\n` : ""}Here's my script so far (excerpt):\n\n${ctx.scriptExcerpt ?? "(empty)"}\n\nGive me suggestions: dialogue options, structure notes, or a short block I can paste into the screenplay. If you suggest text to add, put it in a "Suggested addition:" or "Paste this:" block.`;
    default:
      return `Context: ${JSON.stringify(ctx)}. Give brief, actionable feedback.`;
  }
}

/** Extract incorporate-ready text from MODOC reply. For logline, prefer "Suggested logline:" line. */
function extractIncorporateText(task: string, fullMessage: string): string {
  if (task === "logline") {
    const match = fullMessage.match(/Suggested logline:\s*([\s\S]+?)(?:\n|$)/);
    if (match) return match[1].trim();
  }
  if (task === "idea_notes" || task === "script") {
    const addMatch = fullMessage.match(/(?:You could add:|Suggested addition:|Paste this:)\s*([\s\S]+?)(?=\n\n|$)/);
    if (addMatch) return addMatch[1].trim();
  }
  return fullMessage.trim();
}

function getMessageContent(message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((p) => (p.type === "text" ? (p as { text?: string }).text ?? "" : ""))
      .join("");
  }
  return "";
}

export function ModocFieldPopover({
  open,
  onClose,
  task,
  context,
  onIncorporate,
  sectionLabel,
  projectId,
}: ModocFieldPopoverProps) {
  const { append, messages, status, setRequestContext } = useModoc();
  const [hasRequested, setHasRequested] = useState(false);
  const lastRequestRef = useRef<string>("");
  const contentRef = useRef<HTMLDivElement>(null);

  const scope = task === "script" ? "script-writing" : "idea-development";
  const clientContext = `Task: ${task}. ${context.title ? `Title: ${context.title}. ` : ""}${context.logline ? `Logline: ${context.logline.slice(0, 200)}. ` : ""}${context.notesExcerpt ? `Notes excerpt: ${context.notesExcerpt.slice(0, 300)}.` : ""}${context.scriptExcerpt ? `Script excerpt: ${context.scriptExcerpt.slice(0, 400)}.` : ""}`;

  useEffect(() => {
    if (!open) return;
    setRequestContext({
      scope,
      clientContext,
      pageContext: { tool: scope, task, ...(projectId && { projectId }) },
    });
  }, [open, scope, task, clientContext, projectId, setRequestContext]);

  useEffect(() => {
    if (open && contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [open, messages, status]);

  const handleGetInsights = () => {
    const prompt = buildPrompt(task, context);
    if (lastRequestRef.current === prompt) return;
    lastRequestRef.current = prompt;
    setHasRequested(true);
    append({ role: "user", content: prompt });
  };

  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  const assistantContent = lastAssistant ? getMessageContent(lastAssistant) : "";
  const isStreaming = status === "streaming" || status === "submitted";
  const canIncorporate = !!assistantContent.trim() && !isStreaming;
  const incorporateText = extractIncorporateText(task, assistantContent);

  const handleIncorporate = () => {
    const toPaste = incorporateText || assistantContent;
    if (toPaste) onIncorporate(toPaste);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden onClick={onClose} />
      <div
        className="fixed z-50 w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-2xl shadow-cyan-500/10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">MODOC — {sectionLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {!hasRequested && !assistantContent && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-cyan-400/80" />
              </div>
              <p className="text-sm text-slate-400 mb-6">
                MODOC will read what you&apos;ve put in this section and give feedback on the spot.
              </p>
              <button
                type="button"
                onClick={handleGetInsights}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-medium text-sm transition"
              >
                Get MODOC insights
              </button>
            </div>
          )}
          {(hasRequested || assistantContent) && (
            <>
              {isStreaming && !assistantContent && (
                <div className="flex items-center gap-3 text-slate-400 text-sm py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                  MODOC is thinking…
                </div>
              )}
              {assistantContent && (
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {assistantContent}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-700/50 bg-slate-800/30 rounded-b-2xl">
          {canIncorporate && (
            <button
              type="button"
              onClick={handleIncorporate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/90 hover:bg-cyan-500 text-white text-sm font-medium transition"
            >
              <CheckCircle className="w-4 h-4" />
              Incorporate
            </button>
          )}
        </div>
      </div>
    </>
  );
}
