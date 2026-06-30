"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type ScriptCommentsPanelProps = {
  scriptId: string | null | undefined;
  canComment: boolean;
  onJumpToLine?: (lineIndex: number) => void;
};

export function ScriptCommentsPanel({
  scriptId,
  canComment,
  onJumpToLine,
}: ScriptCommentsPanelProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data } = useQuery({
    enabled: !!scriptId,
    queryKey: ["script-comments", scriptId],
    queryFn: () =>
      fetch(`/api/creator/scripts/${scriptId}/comments`).then((r) => r.json()),
    refetchInterval: 8000,
  });

  const comments = (data?.comments ?? []) as Array<{
    id: string;
    body: string;
    lineIndex: number | null;
    sceneHeading: string | null;
    resolved: boolean;
    createdAt: string;
    author: { name: string | null; professionalName: string | null };
    replies: Array<{
      id: string;
      body: string;
      author: { name: string | null; professionalName: string | null };
    }>;
  }>;

  const postMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/creator/scripts/${scriptId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["script-comments", scriptId] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/creator/scripts/${scriptId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["script-comments", scriptId] });
    },
  });

  if (!scriptId) {
    return <p className="text-[11px] text-slate-500">Select a script for comments.</p>;
  }

  return (
    <div className="space-y-3 text-[11px]">
      {canComment ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment or production note…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white outline-none focus:border-orange-500"
          />
          <Button
            size="sm"
            className="h-7 bg-orange-500 hover:bg-orange-600 text-[10px] text-white"
            disabled={!draft.trim() || postMutation.isPending}
            onClick={() => postMutation.mutate(draft)}
          >
            Post comment
          </Button>
        </div>
      ) : (
        <p className="text-slate-500">Read-only — you can view comments but not add new ones.</p>
      )}

      <div className="space-y-2 max-h-[320px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-slate-500">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border px-2 py-2 ${
                c.resolved ? "border-slate-800 opacity-60" : "border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-200">
                  {c.author.professionalName || c.author.name || "Creator"}
                </p>
                {!c.resolved && canComment ? (
                  <button
                    type="button"
                    className="text-[10px] text-cyan-400 hover:underline"
                    onClick={() => resolveMutation.mutate(c.id)}
                  >
                    Resolve
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-slate-300 whitespace-pre-wrap">{c.body}</p>
              {c.lineIndex != null && onJumpToLine ? (
                <button
                  type="button"
                  className="mt-1 text-[10px] text-orange-400 hover:underline"
                  onClick={() => onJumpToLine(c.lineIndex!)}
                >
                  Jump to line {c.lineIndex + 1}
                  {c.sceneHeading ? ` · ${c.sceneHeading}` : ""}
                </button>
              ) : null}
              {c.replies?.length > 0 ? (
                <div className="mt-2 pl-2 border-l border-slate-700 space-y-1">
                  {c.replies.map((r) => (
                    <p key={r.id} className="text-slate-400">
                      <span className="text-slate-300">
                        {r.author.professionalName || r.author.name}:
                      </span>{" "}
                      {r.body}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
