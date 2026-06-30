"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Subscribes to stakeholder sync SSE and invalidates workspace when creator changes schedule. */
export function useStakeholderSync(enabled = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    const es = new EventSource("/api/stakeholder/sync/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string };
        if (msg.type === "sync") {
          qc.invalidateQueries({ queryKey: ["stakeholder-workspace"] });
        }
      } catch {
        /* ignore parse errors */
      }
    };
    return () => es.close();
  }, [enabled, qc]);
}
