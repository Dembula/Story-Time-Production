"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModocMessageText } from "./modoc-context";
import { useModocOptional } from "./use-modoc";
import {
  breakdownSuggestionsToPatchBody,
  countBreakdownPatchItems,
  parseBreakdownSuggestions,
} from "@/lib/modoc/parse-breakdown-suggestions";

type ModocBreakdownIncorporateBarProps = {
  projectId: string;
  sceneId?: string | null;
};

export function ModocBreakdownIncorporateBar({ projectId, sceneId }: ModocBreakdownIncorporateBarProps) {
  const modoc = useModocOptional();
  const queryClient = useQueryClient();
  const [incorporating, setIncorporating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissedForId, setDismissedForId] = useState<string | null>(null);

  const lastAssistant = useMemo(() => {
    const messages = modoc?.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") return m;
    }
    return null;
  }, [modoc?.messages]);

  const assistantText = lastAssistant ? getModocMessageText(lastAssistant) : "";
  const suggestions = useMemo(() => parseBreakdownSuggestions(assistantText), [assistantText]);
  const patchBody = useMemo(
    () => breakdownSuggestionsToPatchBody(suggestions, sceneId),
    [suggestions, sceneId],
  );
  const itemCount = countBreakdownPatchItems(patchBody);
  const messageId = lastAssistant?.id ?? null;
  const hidden = !itemCount || !messageId || dismissedForId === messageId;

  if (hidden) return null;

  async function incorporate() {
    if (!projectId || itemCount === 0) return;
    setIncorporating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/creator/projects/${projectId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to add breakdown items");
      }
      await queryClient.invalidateQueries({ queryKey: ["project-breakdown", projectId] });
      if (messageId) setDismissedForId(messageId);
      setMessage(`Added ${itemCount} item${itemCount === 1 ? "" : "s"} to breakdown.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not add items");
    } finally {
      setIncorporating(false);
    }
  }

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="h-4 w-4 text-cyan-400 shrink-0" aria-hidden />
        <p className="text-sm text-cyan-100/90 flex-1 min-w-[200px]">
          MODOC suggested {itemCount} breakdown item{itemCount === 1 ? "" : "s"} in chat
          {sceneId ? " for the active scene" : ""}.
        </p>
        <Button
          type="button"
          size="sm"
          className="bg-cyan-600 hover:bg-cyan-500 text-white"
          disabled={incorporating}
          onClick={() => void incorporate()}
        >
          {incorporating ? "Adding…" : "Add to breakdown"}
        </Button>
      </div>
      <ul className="text-[11px] text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
        {suggestions.slice(0, 8).map((s, i) => (
          <li key={`${s.category}-${i}`}>
            <span className="text-cyan-400/80 uppercase">{s.category.replace(/s$/, "")}</span>: {s.label}
          </li>
        ))}
        {suggestions.length > 8 ? <li>…and {suggestions.length - 8} more</li> : null}
      </ul>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
