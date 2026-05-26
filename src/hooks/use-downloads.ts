"use client";

import { useCallback, useEffect, useState } from "react";
import { listDownloads, type DownloadRecord } from "@/lib/offline/download-manager";

export function useDownloads() {
  const [items, setItems] = useState<DownloadRecord[]>([]);

  const refresh = useCallback(() => {
    setItems(listDownloads());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("storytime-downloads-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("storytime-downloads-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return { items, refresh };
}
