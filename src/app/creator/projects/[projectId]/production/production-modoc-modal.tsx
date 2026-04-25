"use client";

import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { useModoc } from "@/components/modoc";

export function getModocMessageContent(message: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((p) => (p.type === "text" ? (p as { text?: string }).text ?? "" : ""))
      .join("");
  }
  return "";
}

const PRODUCTION_MODOC_TASKS = [
  "production_control_center",
  "call_sheet_generator",
  "on_set_tasks",
  "equipment_tracking",
  "shoot_progress",
  "continuity_manager",
  "dailies_review",
  "production_expense_tracker",
  "incident_reporting",
  "production_wrap",
] as const;

export interface ProductionModocReportModalProps {
  task: (typeof PRODUCTION_MODOC_TASKS)[number];
  reportTitle: string;
  prompt: string;
  onClose: () => void;
  projectId?: string | null;
}

export function ProductionModocReportModal({
  task,
  reportTitle,
  prompt,
  onClose,
  projectId,
}: ProductionModocReportModalProps) {
  const { append, messages, status, setRequestContext } = useModoc();
  const appendedRef = useRef(false);

  const scope =
    task === "production_control_center"
      ? "control-center"
      : task === "call_sheet_generator"
        ? "call-sheet-generator"
        : task === "on_set_tasks"
          ? "on-set-tasks"
          : task === "equipment_tracking"
            ? "equipment-tracking"
            : task === "shoot_progress"
              ? "shoot-progress"
              : task === "continuity_manager"
                ? "continuity-manager"
                : task === "dailies_review"
                  ? "dailies-review"
                  : task === "production_expense_tracker"
                    ? "expense-tracker"
                    : task === "incident_reporting"
                      ? "incident-reporting"
                      : "wrap";

  useEffect(() => {
    setRequestContext({
      scope,
      clientContext: `Task: ${task}. ${prompt.slice(0, 200)}...`,
      pageContext: { task, ...(projectId && { projectId }) },
    });
  }, [scope, task, prompt, projectId, setRequestContext]);

  useEffect(() => {
    if (appendedRef.current) return;
    appendedRef.current = true;
    append({ role: "user", content: prompt });
  }, [prompt, append]);

  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  const displayContent = lastAssistant ? getModocMessageContent(lastAssistant) : "";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            {reportTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {status === "streaming" || status === "submitted" ? (
            displayContent ? displayContent : <span className="text-slate-400">Generating…</span>
          ) : (
            displayContent || "Generating…"
          )}
        </div>
      </div>
    </>
  );
}
