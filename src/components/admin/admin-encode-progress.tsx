"use client";

import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Loader2 } from "lucide-react";

type EncodeAsset = {
  label: string;
  sourceUrl: string | null;
  uid: string | null;
  status: string | null;
  phase: "none" | "compressing" | "encoding" | "ready" | "error" | "queued";
  compressPercent: number | null;
  encodePercent: number | null;
  message: string | null;
};

type EncodeStatusResponse = {
  ok: boolean;
  assets: EncodeAsset[];
  error?: string;
};

function ProgressBar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number | null;
  tone: "amber" | "sky" | "emerald" | "slate";
}) {
  const tones = {
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-500",
  };
  const value = percent == null ? null : Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-300">{value == null ? "…" : `${value}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tones[tone]} ${value == null ? "w-1/5 animate-pulse" : ""}`}
          style={value == null ? undefined : { width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function phaseTone(phase: EncodeAsset["phase"]): "amber" | "sky" | "emerald" | "slate" {
  if (phase === "compressing") return "amber";
  if (phase === "encoding" || phase === "queued") return "sky";
  if (phase === "ready") return "emerald";
  return "slate";
}

export function AdminEncodeProgress({ contentId }: { contentId: string }) {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-encode-status", contentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/content/${contentId}/encode-status`, { cache: "no-store" });
      const json = (await res.json()) as EncodeStatusResponse;
      if (!res.ok) throw new Error(json.error || "Failed to load encode status");
      return json;
    },
    refetchInterval: (query) => {
      const assets = query.state.data?.assets ?? [];
      const busy = assets.some(
        (a) => a.phase === "compressing" || a.phase === "encoding" || a.phase === "queued",
      );
      return busy ? 8000 : false;
    },
  });

  const assets = (data?.assets ?? []).filter((a) => a.phase !== "none");
  if (!isLoading && assets.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h5 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
          <Clapperboard className="h-3.5 w-3.5 text-orange-400" />
          Compress &amp; encode
        </h5>
        {(isLoading || isFetching) && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
      </div>

      {error ? (
        <p className="text-xs text-red-300">{error instanceof Error ? error.message : "Could not load status"}</p>
      ) : isLoading && !data ? (
        <p className="text-xs text-slate-500">Checking MediaConvert and Stream…</p>
      ) : (
        <div className="space-y-4">
          {assets.map((asset) => (
            <div key={`${asset.label}-${asset.uid || asset.sourceUrl || "x"}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-200">{asset.label}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    asset.phase === "ready"
                      ? "border-emerald-500/40 text-emerald-300"
                      : asset.phase === "error"
                        ? "border-red-500/40 text-red-300"
                        : asset.phase === "compressing"
                          ? "border-amber-500/40 text-amber-200"
                          : "border-sky-500/40 text-sky-200"
                  }`}
                >
                  {asset.phase}
                </span>
              </div>
              {(asset.phase === "compressing" || asset.compressPercent != null) &&
                asset.phase !== "none" &&
                asset.phase !== "error" && (
                  <ProgressBar
                    label="Compress (MediaConvert)"
                    percent={asset.phase === "ready" || asset.phase === "encoding" ? 100 : asset.compressPercent}
                    tone={asset.phase === "compressing" ? "amber" : "emerald"}
                  />
                )}
              {(asset.phase === "encoding" ||
                asset.phase === "queued" ||
                asset.phase === "ready" ||
                asset.encodePercent != null) &&
                asset.phase !== "compressing" &&
                asset.phase !== "error" && (
                  <ProgressBar
                    label="Encode (Cloudflare Stream)"
                    percent={asset.phase === "ready" ? 100 : asset.encodePercent}
                    tone={phaseTone(asset.phase)}
                  />
                )}
              {asset.message ? <p className="text-[11px] text-slate-400">{asset.message}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
