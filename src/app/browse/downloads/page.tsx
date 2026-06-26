"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DownloadsClient } from "./downloads-client";
import { isOfflineDownloadEnabled } from "@/lib/platform/offline-downloads";

export default function DownloadsPage() {
  const router = useRouter();
  const enabled = isOfflineDownloadEnabled();

  useEffect(() => {
    if (!enabled) {
      router.replace("/browse");
    }
  }, [enabled, router]);

  if (!enabled) {
    return null;
  }

  return <DownloadsClient />;
}
