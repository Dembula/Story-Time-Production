"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";

export function RatingsSection({ contentId }: { contentId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["ratings", contentId],
    queryFn: () =>
      fetch(`/api/content/${contentId}/ratings`).then((r) => r.json()),
  });

  const rateMutation = useMutation({
    mutationFn: (score: number) =>
      fetch(`/api/content/${contentId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings", contentId] });
    },
  });

  const avg = stats?.average ?? 0;
  const count = stats?.count ?? 0;
  const myRating = stats?.myRating ?? null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Ratings</h3>
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => session && rateMutation.mutate(star)}
              disabled={!session}
              className={`p-1 transition ${
                (myRating ?? avg) >= star
                  ? "text-orange-500 fill-orange-500"
                  : "text-slate-400 hover:text-orange-500/70"
              }`}
              title={`Rate ${star} stars`}
            >
              <Star className="w-6 h-6" />
            </button>
          ))}
        </div>
        <span className="text-slate-400">
          {avg > 0 ? `${avg.toFixed(1)} (${count} votes)` : "No ratings yet"}
        </span>
      </div>
      {session && (
        <p className="text-sm text-slate-400">
          {myRating
            ? `You rated this ${myRating} star${myRating > 1 ? "s" : ""}`
            : "Click a star to rate"}
        </p>
      )}
      {!session && (
        <p className="text-sm text-slate-400">Sign in to rate</p>
      )}
    </div>
  );
}
