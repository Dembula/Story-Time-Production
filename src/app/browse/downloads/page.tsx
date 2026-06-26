import { redirect } from "next/navigation";
import { DownloadsClient } from "./downloads-client";
import { isOfflineDownloadEnabled } from "@/lib/platform/offline-downloads";

export default function DownloadsPage() {
  if (!isOfflineDownloadEnabled()) {
    redirect("/browse");
  }

  return <DownloadsClient />;
}
