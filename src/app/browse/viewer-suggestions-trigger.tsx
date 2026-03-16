"use client";

import { useEffect, useRef } from "react";

/** Calls the viewer suggestions API once per session so AI suggestions appear in the notification bell. */
export function ViewerSuggestionsTrigger() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch("/api/viewer/suggestions", { credentials: "include" }).catch(() => {});
  }, []);

  return null;
}
