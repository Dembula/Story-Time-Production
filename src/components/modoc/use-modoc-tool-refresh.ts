"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ModocFieldFillDetail } from "@/lib/modoc/modoc-tool-sync";
import { COMMAND_CENTER_CALENDAR_QUERY_KEY } from "@/components/creator/command-center-calendar";

/** Invalidate tool queries and optionally merge VA-suggested field values. */
export function useModocToolRefresh(options?: {
  queryKeys?: string[];
  onFieldFill?: (detail: ModocFieldFillDetail) => void;
}) {
  const queryClient = useQueryClient();
  const keys = options?.queryKeys ?? [];
  const onFieldFill = options?.onFieldFill;

  useEffect(() => {
    const onToolsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: string; queryKeys?: string[] }>).detail;
      const invalidate = new Set([...keys, ...(detail?.queryKeys ?? [])]);
      for (const key of invalidate) {
        if (key === "command-center-calendar") {
          void queryClient.invalidateQueries({ queryKey: COMMAND_CENTER_CALENDAR_QUERY_KEY });
        } else {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    };

    const onFill = (e: Event) => {
      const detail = (e as CustomEvent<ModocFieldFillDetail>).detail;
      if (detail && onFieldFill) onFieldFill(detail);
    };

    window.addEventListener("modoc:tools-changed", onToolsChanged);
    window.addEventListener("modoc:field-fill", onFill);
    return () => {
      window.removeEventListener("modoc:tools-changed", onToolsChanged);
      window.removeEventListener("modoc:field-fill", onFill);
    };
  }, [queryClient, keys, onFieldFill]);
}
