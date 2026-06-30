"use client";

import { useCallback, useEffect, useState } from "react";
import type { PersonPreview } from "@/lib/credit-person-types";

const cache = new Map<string, PersonPreview>();
const inflight = new Map<string, Promise<PersonPreview | null>>();

async function fetchPreview(personId: string, crewMemberId?: string): Promise<PersonPreview | null> {
  const cacheKey = personId || `crew:${crewMemberId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const url = personId
      ? `/api/people/${personId}/preview`
      : `/api/people/preview?crewMemberId=${encodeURIComponent(crewMemberId!)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as PersonPreview;
    cache.set(data.personId, data);
    if (crewMemberId) cache.set(`crew:${crewMemberId}`, data);
    return data;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}

export function usePersonPreview(opts: {
  personId?: string | null;
  crewMemberId?: string | null;
  enabled?: boolean;
}) {
  const { personId, crewMemberId, enabled = false } = opts;
  const [preview, setPreview] = useState<PersonPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!personId && !crewMemberId) return null;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchPreview(personId ?? "", crewMemberId ?? undefined);
      setPreview(data);
      if (!data) setError(true);
      return data;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [personId, crewMemberId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return { preview, loading, error, load, prefetch: load };
}

export function prefetchPersonPreview(personId?: string | null, crewMemberId?: string | null) {
  if (personId) void fetchPreview(personId);
  else if (crewMemberId) void fetchPreview("", crewMemberId);
}
