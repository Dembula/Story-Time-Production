"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/**
 * Calls the viewer suggestions API once per session so AI watch suggestions
 * appear in the notification bell. Only subscribed viewer sessions should mount this.
 */
export function ViewerSuggestionsTrigger() {
  const done = useRef(false);
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (done.current) return;
    if (status === "loading") return;
    if (role !== "SUBSCRIBER") return;
    done.current = true;
    fetch("/api/viewer/suggestions", { credentials: "include" }).catch(() => {});
  }, [role, status]);

  return null;
}
