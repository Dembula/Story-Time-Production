export type DownloadQuality = "standard" | "high";

export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed";

export type DownloadRecord = {
  contentId: string;
  title: string;
  posterUrl: string | null;
  sourceUrl: string;
  quality: DownloadQuality;
  status: DownloadStatus;
  progress: number;
  bytesTotal: number | null;
  bytesDone: number;
  error?: string;
  updatedAt: string;
};

const STORAGE_KEY = "storytime_downloads_v1";
const CACHE_NAME = "storytime-offline-v1";

function readStore(): DownloadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DownloadRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: DownloadRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("storytime-downloads-changed"));
}

export function listDownloads(): DownloadRecord[] {
  return readStore().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDownload(contentId: string): DownloadRecord | undefined {
  return readStore().find((d) => d.contentId === contentId);
}

export function estimateStorageBytes(): number {
  return readStore().reduce((sum, d) => sum + (d.bytesDone || 0), 0);
}

function cacheKey(contentId: string) {
  return `offline-video-${contentId}`;
}

export async function getOfflinePlaybackUrl(contentId: string): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(cacheKey(contentId));
  if (!match) return null;
  const blob = await match.blob();
  return URL.createObjectURL(blob);
}

export async function startDownload(input: {
  contentId: string;
  title: string;
  posterUrl: string | null;
  videoUrl: string;
  quality?: DownloadQuality;
}): Promise<DownloadRecord> {
  const quality = input.quality ?? "standard";
  const existing = getDownload(input.contentId);
  if (existing?.status === "completed") return existing;

  const record: DownloadRecord = {
    contentId: input.contentId,
    title: input.title,
    posterUrl: input.posterUrl,
    sourceUrl: input.videoUrl,
    quality,
    status: "downloading",
    progress: 0,
    bytesTotal: null,
    bytesDone: 0,
    updatedAt: new Date().toISOString(),
  };

  const items = readStore().filter((d) => d.contentId !== input.contentId);
  items.unshift(record);
  writeStore(items);

  void runDownload(record);
  return record;
}

export function pauseDownload(contentId: string) {
  const items = readStore();
  const idx = items.findIndex((d) => d.contentId === contentId);
  if (idx === -1) return;
  if (items[idx]!.status === "downloading") {
    items[idx]!.status = "paused";
    items[idx]!.updatedAt = new Date().toISOString();
    writeStore(items);
  }
}

export async function removeDownload(contentId: string) {
  const items = readStore().filter((d) => d.contentId !== contentId);
  writeStore(items);
  if (typeof caches !== "undefined") {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(cacheKey(contentId));
  }
}

function resolveMp4Url(videoUrl: string, quality: DownloadQuality): string | null {
  const uidMatch = videoUrl.match(/videodelivery\.net\/([a-f0-9]+)/i);
  const uid = uidMatch?.[1];
  if (uid) {
    return quality === "high"
      ? `https://videodelivery.net/${uid}/downloads/default.mp4`
      : `https://videodelivery.net/${uid}/downloads/default.mp4`;
  }
  if (/\.mp4(\?|$)/i.test(videoUrl)) return videoUrl;
  return null;
}

async function runDownload(record: DownloadRecord) {
  const mp4 = resolveMp4Url(record.sourceUrl, record.quality);
  if (!mp4) {
    patch(record.contentId, { status: "failed", error: "Offline download not available for this format", progress: 0 });
    return;
  }

  try {
    const res = await fetch(mp4);
    if (!res.ok || !res.body) throw new Error("Download failed");

    const total = Number(res.headers.get("content-length")) || null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let done = 0;

    while (true) {
      const current = getDownload(record.contentId);
      if (current?.status === "paused") return;

      const { value, done: readerDone } = await reader.read();
      if (readerDone) break;
      if (value) {
        chunks.push(value);
        done += value.length;
        const progress = total ? Math.min(99, Math.round((done / total) * 100)) : Math.min(90, done / 500000);
        patch(record.contentId, {
          status: "downloading",
          progress,
          bytesDone: done,
          bytesTotal: total,
        });
      }
    }

    const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
    if (typeof caches !== "undefined") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheKey(record.contentId), new Response(blob));
    }

    patch(record.contentId, {
      status: "completed",
      progress: 100,
      bytesDone: blob.size,
      bytesTotal: blob.size,
      error: undefined,
    });
  } catch (err) {
    patch(record.contentId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Download failed",
    });
  }
}

function patch(contentId: string, partial: Partial<DownloadRecord>) {
  const items = readStore();
  const idx = items.findIndex((d) => d.contentId === contentId);
  if (idx === -1) return;
  items[idx] = { ...items[idx]!, ...partial, updatedAt: new Date().toISOString() };
  writeStore(items);
}

export function resumeDownload(contentId: string) {
  const record = getDownload(contentId);
  if (!record || record.status !== "paused") return;
  patch(contentId, { status: "downloading" });
  void runDownload(record);
}
