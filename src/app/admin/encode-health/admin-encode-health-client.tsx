"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

type AwsProbe =
  | { status: "PROGRESSING" | "SUBMITTED" | "UNKNOWN"; progress?: number }
  | { status: "ERROR"; message: string }
  | { status: "COMPLETE"; outputS3Uri: string; meta?: unknown };

type Placeholder = {
  uid: string;
  sourceUrl: string;
  status: string | null;
  lastError: string | null;
  entityType: string | null;
  entityId: string | null;
  updatedAt: string;
  jobId: string | null;
  aws: AwsProbe;
};

type EncodeHealthData = {
  ok: boolean;
  mediaConvertConfigured: boolean;
  mediaconvertRoleArnSet: boolean;
  mediaconvertRoleArnSuffix: string | null;
  mediaconvertRegion: string | null;
  consoleJobsUrl: string | null;
  nextPublicMezzanineEnabled: boolean;
  storageBucketSet: boolean;
  storageCredentialsSet: boolean;
  placeholders: Placeholder[];
  recentAwsJobs: Array<{ id?: string; status?: string; createdAt?: string }>;
  listJobsError: string | null;
  hint: string;
  error?: string;
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function awsStatusLabel(aws: AwsProbe): string {
  if (aws.status === "ERROR") return aws.message;
  if (aws.status === "COMPLETE") return "COMPLETE";
  if (typeof aws.progress === "number") return `${aws.status} ${Math.round(aws.progress)}%`;
  return aws.status;
}

export function AdminEncodeHealthClient() {
  const [data, setData] = useState<EncodeHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [restartingUid, setRestartingUid] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/encode-health", { cache: "no-store" });
      const json = (await res.json()) as EncodeHealthData;
      setData(json);
    } catch (err) {
      setData({
        ok: false,
        mediaConvertConfigured: false,
        mediaconvertRoleArnSet: false,
        mediaconvertRoleArnSuffix: null,
        mediaconvertRegion: null,
        consoleJobsUrl: null,
        nextPublicMezzanineEnabled: false,
        storageBucketSet: false,
        storageCredentialsSet: false,
        placeholders: [],
        recentAwsJobs: [],
        listJobsError: null,
        hint: "",
        error: err instanceof Error ? err.message : "Failed to load encode health",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryFinish(row: Placeholder) {
    setRestartingUid(row.uid);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/encode-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryFinish: true, placeholderUid: row.uid }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setActionMsg(json.message || json.error || "Retry finish done");
      await load(true);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Retry finish failed");
    } finally {
      setRestartingUid(null);
    }
  }

  async function restartPlaceholder(row: Placeholder) {
    const confirmed = window.confirm(
      "Restart MediaConvert compress for this video? Only do this if the AWS job is missing or failed — not while it is still progressing.",
    );
    if (!confirmed) return;

    setRestartingUid(row.uid);
    setActionMsg(null);
    try {
      const body =
        row.entityType === "Content" && row.entityId
          ? { restart: true, contentId: row.entityId }
          : { restart: true, sourceUrl: row.sourceUrl };
      const res = await fetch("/api/admin/encode-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setActionMsg(json.error || "Restart failed");
      } else {
        setActionMsg(json.message || "Restart queued");
        await load(true);
      }
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Restart failed");
    } finally {
      setRestartingUid(null);
    }
  }

  if (loading && !data) return <StoryTimeLoadingCenter />;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
            <Clapperboard className="h-8 w-8 text-orange-500" />
            Encode health
          </h1>
          <p className="max-w-2xl text-slate-400">
            MediaConvert auto-compress status for high-bitrate masters before Cloudflare Stream.
            Use this when Approve says the main video is still being compressed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 transition hover:border-orange-500/40 hover:text-white disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {data?.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {data.error}
        </div>
      ) : null}

      {actionMsg ? (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          {actionMsg}
        </div>
      ) : null}

      {data?.hint ? (
        <div className="flex gap-3 rounded-lg border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>{data.hint}</p>
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">Configuration</h2>
        <div className="flex flex-wrap gap-2">
          <StatusPill ok={Boolean(data?.mediaConvertConfigured)} label="MediaConvert role" />
          <StatusPill ok={Boolean(data?.nextPublicMezzanineEnabled)} label="UI mezzanine flag" />
          <StatusPill ok={Boolean(data?.storageBucketSet)} label="S3 bucket" />
          <StatusPill ok={Boolean(data?.storageCredentialsSet)} label="Storage credentials" />
        </div>
        <dl className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Region</dt>
            <dd className="mt-1 font-mono text-slate-200">{data?.mediaconvertRegion || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role ARN (suffix)</dt>
            <dd className="mt-1 break-all font-mono text-slate-200">
              {data?.mediaconvertRoleArnSuffix || "not set"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">AWS MediaConvert Jobs</dt>
            <dd className="mt-1">
              {data?.consoleJobsUrl ? (
                <a
                  href={data.consoleJobsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-orange-300 hover:text-orange-200"
                >
                  Open Jobs list in {data.mediaconvertRegion}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-slate-400">Region unknown — set MEDIACONVERT_REGION or STORAGE_REGION</span>
              )}
            </dd>
          </div>
        </dl>
        {data?.listJobsError ? (
          <p className="text-sm text-red-300">ListJobs error: {data.listJobsError}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">Compressing / mezzanine placeholders</h2>
        {data?.placeholders?.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">AWS status</th>
                  <th className="px-4 py-3 font-medium">Content</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.placeholders.map((row) => (
                  <tr key={row.uid} className="bg-slate-950/40 text-slate-200">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-xs">{row.jobId || row.uid}</div>
                      <div className="mt-1 max-w-[14rem] truncate text-xs text-slate-500" title={row.sourceUrl}>
                        {row.sourceUrl}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          row.aws.status === "ERROR"
                            ? "text-red-300"
                            : row.aws.status === "COMPLETE"
                              ? "text-emerald-300"
                              : "text-amber-300"
                        }
                      >
                        {awsStatusLabel(row.aws)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.entityType === "Content" && row.entityId ? (
                        <Link
                          href={`/admin/content?highlight=${row.entityId}`}
                          className="text-orange-300 hover:text-orange-200"
                        >
                          Open in Content
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-slate-400">{row.lastError || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-slate-400">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        {(row.aws.status === "COMPLETE" ||
                          row.status === "error" ||
                          /output path|source metadata|Too Many Requests/i.test(row.lastError || "")) && (
                          <button
                            type="button"
                            onClick={() => void retryFinish(row)}
                            disabled={restartingUid === row.uid}
                            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/60 px-2.5 py-1.5 text-xs text-emerald-200 transition hover:border-emerald-500/50 hover:text-white disabled:opacity-50"
                          >
                            {restartingUid === row.uid ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Retry finish
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void restartPlaceholder(row)}
                          disabled={restartingUid === row.uid}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-orange-500/50 hover:text-white disabled:opacity-50"
                        >
                          {restartingUid === row.uid ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Restart job
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
            No mezzanining placeholders right now.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">Recent AWS MediaConvert jobs</h2>
        {data?.recentAwsJobs?.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Job ID</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.recentAwsJobs.map((job) => (
                  <tr key={job.id || job.createdAt} className="bg-slate-950/40 text-slate-200">
                    <td className="px-4 py-3 font-mono text-xs">{job.id || "—"}</td>
                    <td className="px-4 py-3">{job.status || "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
            No recent jobs returned from AWS in this region
            {data?.listJobsError ? " (ListJobs failed — see error above)" : ""}.
          </p>
        )}
      </section>
    </div>
  );
}
