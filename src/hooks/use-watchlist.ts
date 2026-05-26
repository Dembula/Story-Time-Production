"use client";

import { useCallback, useEffect, useState } from "react";

export function useWatchlist(contentId: string | undefined) {
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contentId) return;
    setLoading(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        setInList(list.some((i: { content?: { id: string } }) => i.content?.id === contentId));
      })
      .catch(() => setInList(false))
      .finally(() => setLoading(false));
  }, [contentId]);

  const toggle = useCallback(async () => {
    if (!contentId) return;
    const action = inList ? "remove" : "add";
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId, action }),
    });
    setInList(!inList);
  }, [contentId, inList]);

  return { inList, loading, toggle };
}
