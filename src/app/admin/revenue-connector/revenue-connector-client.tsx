"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, PauseCircle, PlayCircle, ShieldAlert } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConnectorSettings = {
  id: string | null;
  creatorRevenueTrackingEnabled: boolean;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

type HistoryRow = {
  id: string;
  creatorRevenueTrackingEnabled: boolean;
  note: string | null;
  updatedByUserId: string | null;
  createdAt: string;
};

export function RevenueConnectorClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ConnectorSettings | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue-connector", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: ConnectorSettings;
        history?: HistoryRow[];
      };
      if (!res.ok) throw new Error(json.error || "Could not load revenue connector");
      setSettings(json.settings ?? null);
      setHistory(json.history ?? []);
      setNote(json.settings?.note ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setTrackingEnabled(enabled: boolean) {
    if (saving) return;
    const verb = enabled ? "turn creator revenue tracking ON" : "PAUSE creator revenue tracking";
    if (
      !window.confirm(
        enabled
          ? "Turn creator revenue tracking ON?\n\nCreators will start seeing newly attributed earnings on their dashboards."
          : "Pause creator revenue tracking?\n\nCreators will see zero earnings. New viewer subscription revenue stays with the platform until you turn this back on.",
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue-connector", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorRevenueTrackingEnabled: enabled,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: ConnectorSettings;
      };
      if (!res.ok) throw new Error(json.error || `Could not ${verb}`);
      setSettings(json.settings ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <StoryTimeLoadingCenter />;
  }

  const enabled = settings?.creatorRevenueTrackingEnabled === true;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300/80">System</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-white">
          <Link2 className="h-6 w-6 text-orange-400" aria-hidden />
          Revenue connector
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Control whether creators can see attributed earnings on their dashboards. When paused, viewer
          subscriptions still collect revenue for the platform, but creator wallets and revenue views stay
          at a clean zero until you reconnect tracking.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <Card className="border-white/10 bg-slate-900/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            {enabled ? (
              <PlayCircle className="h-5 w-5 text-emerald-400" aria-hidden />
            ) : (
              <PauseCircle className="h-5 w-5 text-amber-400" aria-hidden />
            )}
            Creator revenue tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                Status:{" "}
                <span className={enabled ? "text-emerald-300" : "text-amber-300"}>
                  {enabled ? "Connected (creators can see earnings)" : "Paused (creators see zero)"}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {settings?.updatedAt
                  ? `Last changed ${new Date(settings.updatedAt).toLocaleString()}`
                  : "Not saved yet — defaults to paused"}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={saving}
              onClick={() => void setTrackingEnabled(!enabled)}
              className={`relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border transition ${
                enabled
                  ? "border-emerald-400/40 bg-emerald-500/30"
                  : "border-amber-400/40 bg-amber-500/20"
              } ${saving ? "opacity-60" : "hover:brightness-110"}`}
            >
              <span
                className={`inline-block h-8 w-8 transform rounded-full bg-white shadow transition ${
                  enabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
              <span className="sr-only">Toggle creator revenue tracking</span>
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Optional note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Covering launch costs — re-enable after runway"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-orange-400/50 focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving || !enabled}
              onClick={() => void setTrackingEnabled(false)}
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
            >
              Pause tracking
            </button>
            <button
              type="button"
              disabled={saving || enabled}
              onClick={() => void setTrackingEnabled(true)}
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              Resume tracking
            </button>
          </div>

          <div className="flex gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-xs text-slate-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden />
            <p>
              Pausing does not refund subscribers. It only hides creator-attributed earnings and routes
              new viewer-pool share to the platform until you reconnect. Banking and KYC profiles are
              unchanged.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-900/60">
        <CardHeader>
          <CardTitle className="text-base text-white">Change history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No connector changes recorded yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {history.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span
                      className={
                        row.creatorRevenueTrackingEnabled ? "text-emerald-300" : "text-amber-300"
                      }
                    >
                      {row.creatorRevenueTrackingEnabled ? "Enabled" : "Paused"}
                    </span>
                    {row.note ? <span className="text-slate-400"> — {row.note}</span> : null}
                  </div>
                  <time className="text-xs text-slate-500" dateTime={row.createdAt}>
                    {new Date(row.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
