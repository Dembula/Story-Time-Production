"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "storytime_active_festival_id";

export type FestivalListItem = {
  id: string;
  name: string;
  status: string;
  slug: string;
  tagline?: string | null;
  logoUrl?: string | null;
  headerImageUrl?: string | null;
  acceptingSubmissions?: boolean;
  _count?: { submissions: number; memberships: number };
};

export function useFestivalList() {
  return useQuery({
    queryKey: ["festival-list"],
    queryFn: async () => {
      const res = await fetch("/api/festival");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load festivals");
      return (json.festivals ?? []) as FestivalListItem[];
    },
  });
}

/** Persisted festival scope for curator ops pages. */
export function useActiveFestival() {
  const { data: festivals = [], isLoading, error } = useFestivalList();
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) || "";
    if (stored) setSelectedId(stored);
  }, []);

  const activeId = useMemo(() => {
    if (selectedId && festivals.some((f) => f.id === selectedId)) return selectedId;
    return festivals[0]?.id || "";
  }, [selectedId, festivals]);

  const activeFestival = useMemo(
    () => festivals.find((f) => f.id === activeId) ?? null,
    [festivals, activeId],
  );

  function setActiveFestivalId(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined" && id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }

  return {
    festivals,
    activeId,
    activeFestival,
    setActiveFestivalId,
    isLoading,
    error,
  };
}
