"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
  replies: Comment[];
};

export function CommentsSection({ contentId }: { contentId: string }) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", contentId],
    queryFn: () =>
      fetch(`/api/content/${contentId}/comments`).then((r) => r.json()),
  });

  const postMutation = useMutation({
    mutationFn: (body: { body: string; parentId?: string }) =>
      fetch(`/api/content/${contentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", contentId] });
      setNewComment("");
      setReplyingTo(null);
      setReplyText("");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Comments</h3>

      {session && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newComment.trim())
              postMutation.mutate({ body: newComment.trim() });
          }}
          className="flex gap-3"
        >
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}

      {!session && (
        <p className="text-sm text-slate-400">
          Sign in to leave a comment
        </p>
      )}

      <div className="space-y-4">
        {(comments as Comment[])?.map((c) => (
          <div key={c.id} className="border-l-2 border-slate-600 pl-4">
            <div className="flex items-center gap-2">
              {c.user.image ? (
                <img
                  src={c.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-xs">
                  {c.user.name?.[0] || "?"}
                </div>
              )}
              <span className="font-medium">{c.user.name || "Anonymous"}</span>
              <span className="text-xs text-slate-400">
                {formatDate(c.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-sm">{c.body}</p>
            {session && (
              <button
                onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                className="mt-2 text-xs text-orange-500 hover:underline"
              >
                Reply
              </button>
            )}
            {replyingTo === c.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyText.trim())
                    postMutation.mutate({
                      body: replyText.trim(),
                      parentId: c.id,
                    });
                }}
                className="mt-3 flex gap-2"
              >
                <Input
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  Reply
                </Button>
              </form>
            )}
            {c.replies?.length > 0 && (
              <div className="mt-4 ml-4 space-y-3">
                {c.replies.map((r) => (
                  <div key={r.id} className="border-l border-slate-600 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {r.user.name || "Anonymous"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{r.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {(!comments || (comments as Comment[]).length === 0) && (
        <p className="text-slate-400">No comments yet. Be the first!</p>
      )}
    </div>
  );
}
