"use client";

import Image from "next/image";
import { MessageCircle, Star } from "lucide-react";
import type { CreatorEngagementComment, CreatorEngagementRating } from "@/lib/creator-audience-insights";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ViewerAvatar({ name, image }: { name: string; image: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "V";
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800">
      {image ? (
        <Image src={image} alt="" fill className="object-cover" sizes="36px" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-300">
          {initial}
        </span>
      )}
    </div>
  );
}

function StarRow({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-300">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < score ? "fill-amber-400 text-amber-400" : "text-slate-600"}`}
        />
      ))}
    </span>
  );
}

export function EngagementFeed({
  comments,
  ratings,
  contentFilter,
}: {
  comments: CreatorEngagementComment[];
  ratings: CreatorEngagementRating[];
  contentFilter?: string | null;
}) {
  const filteredComments = contentFilter
    ? comments.filter((c) => c.contentId === contentFilter)
    : comments;
  const filteredRatings = contentFilter
    ? ratings.filter((r) => r.contentId === contentFilter)
    : ratings;

  if (filteredComments.length === 0 && filteredRatings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 px-4 py-8 text-center text-sm text-slate-500">
        No comments or star ratings yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {filteredRatings.length > 0 ? (
        <div className="space-y-2">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            Star ratings ({filteredRatings.length})
          </h3>
          <ul className="space-y-2">
            {filteredRatings.map((rating) => (
              <li
                key={rating.id}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-slate-950/40 p-3"
              >
                <ViewerAvatar name={rating.viewer.displayName} image={rating.viewer.image} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-white">{rating.viewer.displayName}</span>
                    <StarRow score={rating.score} />
                    {rating.viewer.ageBracket ? (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        {rating.viewer.ageBracket}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {rating.contentTitle} · {formatWhen(rating.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {filteredComments.length > 0 ? (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
            Comments ({filteredComments.length})
          </h3>
          <ul className="space-y-3">
            {filteredComments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-white/8 bg-slate-950/40 p-3"
              >
                <div className="flex items-start gap-3">
                  <ViewerAvatar name={comment.viewer.displayName} image={comment.viewer.image} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-white">{comment.viewer.displayName}</span>
                      {comment.viewer.ageBracket ? (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                          {comment.viewer.ageBracket}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {comment.contentTitle} · {formatWhen(comment.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                      {comment.body}
                    </p>
                    {comment.replies.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-l border-white/10 pl-3">
                        {comment.replies.map((reply) => (
                          <li key={reply.id}>
                            <p className="text-xs font-medium text-slate-300">{reply.viewer.displayName}</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-400">{reply.body}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
