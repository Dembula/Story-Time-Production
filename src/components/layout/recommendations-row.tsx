"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ContentRow } from "@/components/layout/content-row";

export function RecommendationsRow() {
  const { data: session, status } = useSession();

  if (status === "loading" || !session) return null;

  return (
    <RecommendationsRowInner />
  );
}

function RecommendationsRowInner() {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => fetch("/api/recommendations").then((r) => r.json()),
  });

  if (isLoading || !recommendations?.length) return null;

  return (
    <ContentRow
      title="For You"
      subtitle="AI-powered picks based on what you watch"
      contents={recommendations.map((c: Record<string, unknown>) => {
        const { recScore: _, avgRating: __, ...rest } = c;
        return rest as { id: string; title: string; posterUrl: string | null; backdropUrl: string | null; category: string | null; type: string; _count?: { ratings: number } };
      })}
    />
  );
}
