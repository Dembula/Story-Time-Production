"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Download,
  Pause,
  Play,
  Trash2,
  HardDrive,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useDownloads } from "@/hooks/use-downloads";
import {
  estimateStorageBytes,
  pauseDownload,
  removeDownload,
  resumeDownload,
  startDownload,
  type DownloadQuality,
} from "@/lib/offline/download-manager";
import { useState } from "react";

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DownloadsClient() {
  const { items, refresh } = useDownloads();
  const [quality, setQuality] = useState<DownloadQuality>("standard");
  const router = useRouter();

  const active = items.filter((d) => d.status === "downloading" || d.status === "queued");
  const paused = items.filter((d) => d.status === "paused");
  const completed = items.filter((d) => d.status === "completed");
  const failed = items.filter((d) => d.status === "failed");
  const storageUsed = estimateStorageBytes();

  return (
    <div className="mx-auto max-w-4xl px-6 pb-28 pt-8 md:px-12 md:pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-white">Downloads</h1>
        <p className="mt-2 text-slate-400">Watch saved titles offline when downloads complete.</p>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 cinematic-glass">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-orange-300" />
          <div>
            <p className="text-sm font-medium text-white">Storage used</p>
            <p className="text-xs text-slate-400">{formatBytes(storageUsed)} · {completed.length} title{completed.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="dl-quality" className="text-xs text-slate-400">Default quality</label>
          <select
            id="dl-quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value as DownloadQuality)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
          >
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center">
          <Download className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <p className="text-slate-300">No downloads yet</p>
          <p className="mt-2 text-sm text-slate-500">Download titles from any film page to watch offline.</p>
          <Link href="/browse" className="mt-6 inline-block text-sm font-medium text-orange-300 hover:text-orange-200">
            Browse catalogue →
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && <Section title="Active">{active.map((d) => renderRow(d, refresh, quality))}</Section>}
          {paused.length > 0 && <Section title="Paused">{paused.map((d) => renderRow(d, refresh, quality))}</Section>}
          {completed.length > 0 && <Section title="Completed">{completed.map((d) => renderRow(d, refresh, quality))}</Section>}
          {failed.length > 0 && <Section title="Failed">{failed.map((d) => renderRow(d, refresh, quality))}</Section>}
        </div>
      )}
    </div>
  );

  function renderRow(
    d: (typeof items)[number],
    refresh: () => void,
    defaultQuality: DownloadQuality,
  ) {
    const statusIcon =
      d.status === "completed" ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : d.status === "failed" ? (
        <AlertCircle className="h-4 w-4 text-red-400" />
      ) : (
        <Download className="h-4 w-4 text-orange-300" />
      );

    return (
      <div
        key={d.contentId}
        className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 transition hover:border-white/12"
      >
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-900">
          {d.posterUrl ? (
            <Image src={d.posterUrl} alt="" fill className="object-cover" sizes="44px" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{d.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            {statusIcon}
            <span className="capitalize">{d.status}</span>
            {d.status === "downloading" && <span>{d.progress}%</span>}
            {d.error && <span className="text-red-400">{d.error}</span>}
          </div>
          {(d.status === "downloading" || d.status === "paused") && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-orange-500 transition-all" style={{ width: `${d.progress}%` }} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {d.status === "completed" && (
            <button
              type="button"
              onClick={() => router.push(`/browse/content/${d.contentId}/watch?offline=1`)}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Play offline"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {d.status === "downloading" && (
            <button type="button" onClick={() => { pauseDownload(d.contentId); refresh(); }} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Pause">
              <Pause className="h-4 w-4" />
            </button>
          )}
          {d.status === "paused" && (
            <button type="button" onClick={() => { resumeDownload(d.contentId); refresh(); }} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Resume">
              <Play className="h-4 w-4" />
            </button>
          )}
          {d.status === "failed" && (
            <button
              type="button"
              onClick={() => {
                void startDownload({
                  contentId: d.contentId,
                  title: d.title,
                  posterUrl: d.posterUrl,
                  videoUrl: d.sourceUrl,
                  quality: defaultQuality,
                });
                refresh();
              }}
              className="rounded-lg px-2 py-1 text-xs text-orange-300 hover:bg-white/10"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => { void removeDownload(d.contentId); refresh(); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-red-300"
            aria-label="Remove download"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
