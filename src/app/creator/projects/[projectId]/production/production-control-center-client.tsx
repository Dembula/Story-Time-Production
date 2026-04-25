"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useModocOptional } from "@/components/modoc";
import { ProductionModocReportModal } from "./production-modoc-modal";
import { parseRiskItemDescription } from "@/lib/risk-insurance-db";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

function riskItemSummary(category: string, description: string) {
  const { plain, meta } = parseRiskItemDescription(description);
  const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const summary =
    (plain ?? "").replace(new RegExp(`^\\[${escaped}\\]\\s*`, "i"), "").trim() ||
    (meta.title ?? "").trim() ||
    "Risk item";
  return { summary, meta };
}

const OFFLINE_KEY = (projectId: string) => `st-pcc-offline:${projectId}`;

type ShootBrief = { id: string; date: string; status: string; callTime: string | null; locationSummary: string | null };

type ControlPayload = {
  /** False when `ShootDayControlBoard` table is missing (run migrations / db push). */
  controlBoardDbReady?: boolean;
  shootDaysBrief: ShootBrief[];
  shootDay: {
    id: string;
    date: string;
    unit: string | null;
    callTime: string | null;
    wrapTime: string | null;
    status: string;
    locationSummary: string | null;
    scenesBeingShot: string | null;
    dayNotes: string | null;
    scenes: { shootDaySceneId: string; order: number; sceneId: string; number: string; heading: string | null }[];
  } | null;
  productionDay: {
    shootDayNumber: number;
    scenes: { sceneId: string; estimatedShootDurationMinutes: number; number: string }[];
    castRequired: { key: string; name: string; roleOrCharacter: string }[];
    crewRequired: { key: string; name: string; role: string; department: string }[];
    equipmentRequired: { key: string; equipmentName: string; category: string; quantity: number }[];
    location: string | null;
    logistics: Record<string, string | null>;
  } | null;
  live: {
    sceneProgress: Record<string, { status: string; actualStartAt?: string | null; actualEndAt?: string | null; notes?: string | null }>;
    castStatus: Record<string, string>;
    crewStatus: Record<string, string>;
    equipmentStatus: Record<string, string>;
    locationStatus: { access?: string; notes?: string | null };
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string | null;
    department: string | null;
    dueDate: string | null;
    assignee: { id: string; name: string | null } | null;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string | null;
    resolved: boolean;
    createdAt: string;
    resolutionOwnerId: string | null;
    resolutionOwner: { id: string; name: string | null } | null;
  }>;
  riskItems: Array<{ id: string; category: string; description: string; status: string }>;
  contractSummary: { total: number; signed: number };
  equipmentPlan: Array<{ id: string; category: string; description: string | null; quantity: number }>;
  alerts: Array<{ id: string; severity: string; type: string; message: string }>;
  acknowledgedAlertIds: string[];
  teamMembers: Array<{ id: string; name: string | null; email: string | null }>;
};

function queueOffline(projectId: string, body: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY(projectId));
    const arr: unknown[] = raw ? JSON.parse(raw) : [];
    arr.push({ ...body, queuedAt: Date.now() });
    localStorage.setItem(OFFLINE_KEY(projectId), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

async function flushOfflineQueue(projectId: string) {
  const raw = localStorage.getItem(OFFLINE_KEY(projectId));
  if (!raw) return;
  let items: Record<string, unknown>[];
  try {
    items = JSON.parse(raw) as Record<string, unknown>[];
  } catch {
    localStorage.removeItem(OFFLINE_KEY(projectId));
    return;
  }
  const remaining: Record<string, unknown>[] = [];
  for (const item of items) {
    try {
      const res = await fetch(`/api/creator/projects/${projectId}/production-control-center`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  if (remaining.length) localStorage.setItem(OFFLINE_KEY(projectId), JSON.stringify(remaining));
  else localStorage.removeItem(OFFLINE_KEY(projectId));
}

function minutesBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  return Math.round((t1 - t0) / 60000);
}

export function ProductionControlCenterClient({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const queryClient = useQueryClient();
  const modoc = useModocOptional();
  const [modocOpen, setModocOpen] = useState(false);
  const [dayPicker, setDayPicker] = useState<string | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incTitle, setIncTitle] = useState("");
  const [incCategory, setIncCategory] = useState("OTHER");
  const [incSeverity, setIncSeverity] = useState("MEDIUM");
  const [incBody, setIncBody] = useState("");
  const [incOwner, setIncOwner] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const hasProject = !!projectId;
  const compactTodayView = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  const queryKey = useMemo(
    () => ["production-control-center", projectId, dayPicker ?? "__auto__"],
    [projectId, dayPicker],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const qs = dayPicker ? `?shootDayId=${encodeURIComponent(dayPicker)}` : "";
      const r = await fetch(`/api/creator/projects/${projectId}/production-control-center${qs}`);
      if (!r.ok) throw new Error("Failed to load control center");
      return r.json() as Promise<ControlPayload>;
    },
    enabled: hasProject,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!hasProject || !projectId) return;
    const onOnline = () => void flushOfflineQueue(projectId);
    window.addEventListener("online", onOnline);
    void flushOfflineQueue(projectId);
    return () => window.removeEventListener("online", onOnline);
  }, [hasProject, projectId]);

  const shootDayId = data?.shootDay?.id ?? "";
  const shootDayIdRef = useRef(shootDayId);
  shootDayIdRef.current = shootDayId;

  const postMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!projectId) throw new Error("No project");
      const sid = (typeof body.shootDayId === "string" ? body.shootDayId : null) || shootDayIdRef.current;
      if (!sid) throw new Error("No day");
      const res = await fetch(`/api/creator/projects/${projectId}/production-control-center`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, shootDayId: sid }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = (j as { error?: string; hint?: string }).error || "Request failed";
        const hint = (j as { hint?: string }).hint;
        throw new Error(hint ? `${msg} ${hint}` : msg);
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["production-control-center"] });
      void queryClient.invalidateQueries({ queryKey: ["project-production-workspace", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-incidents", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
    onError: (e, vars) => {
      if (!projectId) return;
      if (!navigator.onLine) {
        queueOffline(projectId, { ...vars, shootDayId: shootDayIdRef.current });
        setToast("Saved offline — will sync when you are back online.");
        return;
      }
      setToast((e as Error).message);
    },
  });

  const safePost = useCallback(
    (body: Record<string, unknown>) => {
      if (!navigator.onLine) {
        if (projectId) queueOffline(projectId, { ...body, shootDayId: shootDayIdRef.current });
        setToast("Queued for sync (offline).");
        return;
      }
      postMutation.mutate(body);
    },
    [postMutation, projectId],
  );

  const cycleTask = (taskId: string, current: string) => {
    const next = current === "TODO" ? "IN_PROGRESS" : current === "IN_PROGRESS" ? "DONE" : "TODO";
    safePost({ action: "UPDATE_TASK", taskId, status: next });
  };

  const estForScene = (sceneId: string) =>
    data?.productionDay?.scenes.find((s) => s.sceneId === sceneId)?.estimatedShootDurationMinutes ?? 45;

  if (!hasProject) {
    return (
      <p className="text-sm text-slate-500">Link a project to use the Production Control Center.</p>
    );
  }

  return (
    <div className={`space-y-4 pb-24 md:pb-8 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Live shoot-day execution: schedule snapshot, scene and people status, tasks, incidents, and drift vs plan.
            Refreshes every few seconds while this tab is open.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200"
              onClick={() => setModocOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5" />
              AI brief
            </Button>
          )}
        </div>
      </header>

      {modoc && modocOpen && (
        <ProductionModocReportModal
          task="production_control_center"
          reportTitle="Control center brief"
          prompt="Summarize current shoot-day status, risks, open incidents, and task bottlenecks. Keep bullets short for someone on set."
          onClose={() => setModocOpen(false)}
          projectId={projectId}
        />
      )}
      {toast && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex justify-between gap-2">
          <span>{toast}</span>
          <button type="button" className="text-amber-200/80 hover:text-white" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      {data && data.controlBoardDbReady === false && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-950/30 p-4 text-sm text-amber-50">
          <p className="font-semibold text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Live board persistence is not set up
          </p>
          <p className="mt-2 text-amber-100/90">
            The database is missing the <code className="text-xs bg-black/30 px-1 rounded">ShootDayControlBoard</code>{" "}
            table. You can view this page, but scene/cast/crew/equipment taps will not save until you apply migrations.
          </p>
          <p className="mt-2 text-xs text-amber-200/80 font-mono">
            npx prisma migrate deploy &nbsp;or&nbsp; npx prisma db push
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500">Shoot day</label>
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white min-w-[200px]"
          value={dayPicker === null ? "" : dayPicker || data?.shootDay?.id || ""}
          onChange={(e) => setDayPicker(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Auto (today / next)</option>
          {(data?.shootDaysBrief ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.date.slice(0, 10)} · {d.status}
              {d.locationSummary ? ` · ${d.locationSummary.slice(0, 28)}` : ""}
            </option>
          ))}
        </select>
        {projectId && (
          <Link
            href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
            className="text-xs text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
          >
            Edit schedule <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading live board…</p>}

      {!isLoading && !data?.shootDay && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400 text-sm">
          No shoot days yet. Add days in{" "}
          <Link href={`/creator/projects/${projectId}/pre-production/production-scheduling`} className="text-orange-400">
            Production Scheduling
          </Link>
          .
        </div>
      )}

      {data?.shootDay && data.live ? (
        (() => {
          const live = data.live;
          return (
        <>
          {compactTodayView && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Today view</p>
              <p className="text-sm text-slate-200">
                Day {data.productionDay?.shootDayNumber ?? "—"} · {data.shootDay.date.slice(0, 10)} · {data.shootDay.status}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Scenes {data.shootDay.scenes.length} · Tasks {data.tasks.length} · Incidents {data.incidents.length}
              </p>
            </section>
          )}
          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-red-500/40 bg-red-950/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-200">
                <AlertTriangle className="w-4 h-4" /> Active alerts
              </div>
              <ul className="space-y-2">
                {data.alerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col gap-2 rounded-xl border border-red-500/25 bg-black/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm text-red-50">{a.message}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-400/50 text-red-100 shrink-0"
                      onClick={() => safePost({ action: "ACK_ALERT", alertId: a.id })}
                    >
                      Acknowledge
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Snapshot */}
          <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4 md:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/90 mb-3">
              <Clock className="w-4 h-4" />
              Today&apos;s shoot snapshot
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Day</p>
                <p className="text-lg font-semibold text-white">
                  Day {data.productionDay?.shootDayNumber ?? "—"}{" "}
                  <span className="text-slate-400 font-normal text-sm">({data.shootDay.status})</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Date</p>
                <p className="text-white">{data.shootDay.date.slice(0, 10)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Call / Wrap</p>
                <p className="text-white">
                  {data.shootDay.callTime ?? "—"} → {data.shootDay.wrapTime ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Contracts</p>
                <p className="text-white">
                  {data.contractSummary.signed} signed / {data.contractSummary.total} total
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-sm text-slate-300">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">{data.shootDay.locationSummary || data.productionDay?.location || "Location TBD"}</p>
                {data.shootDay.scenesBeingShot && (
                  <p className="text-xs text-slate-500 mt-1">Slate: {data.shootDay.scenesBeingShot}</p>
                )}
              </div>
            </div>
          </section>

          <div className={`grid gap-4 ${compactTodayView ? "" : "lg:grid-cols-3"} min-w-0`}>
            <div className="lg:col-span-2 space-y-4 min-w-0">
              {/* Scenes */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
                  <Camera className="w-4 h-4 text-orange-400" />
                  Scene progress
                </div>
                <div className="space-y-3">
                  {data.shootDay.scenes.map((s) => {
                    const prog = live.sceneProgress[s.shootDaySceneId] ?? { status: "NOT_STARTED" };
                    const planned = estForScene(s.sceneId);
                    const actualMin = minutesBetween(prog.actualStartAt, prog.actualEndAt);
                    const drift =
                      actualMin != null && planned ? `${actualMin - planned >= 0 ? "+" : ""}${actualMin - planned}m vs ~${planned}m plan` : null;
                    return (
                      <div
                        key={s.shootDaySceneId}
                        className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div>
                          <p className="text-white font-medium">
                            Scene {s.number}
                            {s.heading ? <span className="text-slate-400 font-normal"> — {s.heading}</span> : null}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Planned ≈ {planned}m {drift ? `· ${drift}` : ""}</p>
                          <input
                            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                            placeholder="Notes (tap away to save)"
                            defaultValue={prog.notes ?? ""}
                            onBlur={(e) =>
                              safePost({
                                action: "SET_SCENE_PROGRESS",
                                shootDaySceneId: s.shootDaySceneId,
                                notes: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {(["NOT_STARTED", "IN_PROGRESS", "DONE"] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                const patch: Record<string, unknown> = {
                                  action: "SET_SCENE_PROGRESS",
                                  shootDaySceneId: s.shootDaySceneId,
                                  status: st,
                                };
                                if (st === "IN_PROGRESS") patch.actualStartAt = new Date().toISOString();
                                if (st === "DONE") {
                                  patch.actualEndAt = new Date().toISOString();
                                  if (!prog.actualStartAt) patch.actualStartAt = new Date().toISOString();
                                }
                                safePost(patch);
                              }}
                              className={`rounded-lg px-3 py-2 text-xs font-medium border ${
                                prog.status === st
                                  ? "bg-orange-500/20 border-orange-500/50 text-orange-100"
                                  : "border-slate-700 text-slate-400 hover:border-slate-500"
                              }`}
                            >
                              {st.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Cast & crew */}
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
                    <Users className="w-4 h-4 text-violet-400" />
                    Cast
                  </div>
                  <ul className="space-y-2">
                    {(data.productionDay?.castRequired ?? []).map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-200 truncate">
                          {c.name}
                          <span className="text-slate-500 text-xs block">{c.roleOrCharacter}</span>
                        </span>
                        <select
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white max-w-[140px]"
                          value={live.castStatus[c.key] ?? "EXPECTED"}
                          onChange={(e) => safePost({ action: "SET_CAST_STATUS", key: c.key, status: e.target.value })}
                        >
                          {["EXPECTED", "CHECKED_IN", "ON_SET", "DELAYED", "WRAPPED"].map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                    {(data.productionDay?.castRequired ?? []).length === 0 && (
                      <li className="text-xs text-slate-500">No cast rows for this day (link breakdown + casting).</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
                    <Users className="w-4 h-4 text-cyan-400" />
                    Crew
                  </div>
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {(data.productionDay?.crewRequired ?? []).map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-200 truncate">
                          {c.name}
                          <span className="text-slate-500 text-xs block">
                            {c.role} · {c.department}
                          </span>
                        </span>
                        <select
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white max-w-[140px]"
                          value={live.crewStatus[c.key] ?? "EXPECTED"}
                          onChange={(e) => safePost({ action: "SET_CREW_STATUS", key: c.key, status: e.target.value })}
                        >
                          {["EXPECTED", "CHECKED_IN", "ON_SET", "ON_BREAK", "DELAYED", "WRAPPED"].map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* Equipment + location */}
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    Equipment (plan + live)
                  </div>
                  <ul className="space-y-2 max-h-56 overflow-y-auto text-sm">
                    {(data.productionDay?.equipmentRequired ?? []).map((e) => (
                      <li key={e.key} className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 truncate">
                          {e.equipmentName}{" "}
                          <span className="text-slate-500 text-xs">
                            ×{e.quantity} · {e.category}
                          </span>
                        </span>
                        <select
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          value={live.equipmentStatus[e.key] ?? "PLANNED"}
                          onChange={(ev) =>
                            safePost({ action: "SET_EQUIPMENT_STATUS", key: e.key, status: ev.target.value })
                          }
                        >
                          {["PLANNED", "RESERVED", "DELIVERED", "IN_USE", "IDLE", "ISSUE_REPORTED", "RETURNED"].map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/creator/projects/${projectId}/pre-production/equipment-planning`}
                    className="text-xs text-orange-400 hover:underline mt-2 inline-block"
                  >
                    Equipment planning →
                  </Link>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
                    <MapPin className="w-4 h-4 text-sky-400" />
                    Location access
                  </div>
                  <select
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white mb-2"
                    value={(live.locationStatus.access as string) || "OPEN"}
                    onChange={(e) => safePost({ action: "SET_LOCATION_STATUS", access: e.target.value })}
                  >
                    {["OPEN", "RESTRICTED", "CLOSED"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 min-h-[72px]"
                    placeholder="Access notes, restrictions, parking…"
                    defaultValue={(live.locationStatus.notes as string) || ""}
                    onBlur={(e) => safePost({ action: "SET_LOCATION_STATUS", notes: e.target.value })}
                  />
                  <Link
                    href={`/creator/projects/${projectId}/pre-production/location-marketplace`}
                    className="text-xs text-orange-400 hover:underline mt-2 inline-block"
                  >
                    Location marketplace →
                  </Link>
                </div>
              </section>

              {/* Risk */}
              {data.riskItems.length > 0 && (
                <section className="rounded-2xl border border-amber-500/20 bg-amber-950/15 p-4 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-100 mb-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    Open risk items (pre-production)
                  </div>
                  <ul className="space-y-1.5 min-w-0">
                    {data.riskItems.slice(0, 6).map((r) => {
                      const { summary, meta } = riskItemSummary(r.category, r.description);
                      const sev = meta.severity;
                      const titleTip = [summary, meta.title, sev ? `Severity: ${sev}` : null]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li
                          key={r.id}
                          className="rounded-lg border border-amber-500/10 bg-black/25 px-2 py-1.5 min-w-0"
                          title={titleTip}
                        >
                          <div className="flex items-start gap-1.5 min-w-0">
                            <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
                              {r.category}
                            </span>
                            {sev ? (
                              <span
                                className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold ${
                                  sev === "HIGH"
                                    ? "bg-red-500/25 text-red-200"
                                    : sev === "MEDIUM"
                                      ? "bg-amber-500/20 text-amber-100"
                                      : "bg-slate-600/40 text-slate-200"
                                }`}
                              >
                                {sev}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 text-xs text-amber-50/95 leading-snug break-words line-clamp-2">
                              {summary}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href={`/creator/projects/${projectId}/pre-production/risk-insurance`}
                    className="text-xs text-orange-400 hover:underline mt-2 inline-block"
                  >
                    Risk & insurance →
                  </Link>
                </section>
              )}
            </div>

            {/* Tasks sidebar */}
            <aside className="space-y-4 min-w-0">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 lg:sticky lg:top-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
                  <ClipboardList className="w-4 h-4 text-orange-400" />
                  Tasks (this day)
                </div>
                <ul className="space-y-2">
                  {data.tasks.map((t) => {
                    const overdue = t.dueDate && t.status !== "DONE" && new Date(t.dueDate).getTime() < Date.now();
                    return (
                      <li
                        key={t.id}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          overdue ? "border-red-500/40 bg-red-950/20" : "border-slate-800 bg-slate-950/40"
                        }`}
                      >
                        <button
                          type="button"
                          className="text-left w-full"
                          onClick={() => cycleTask(t.id, t.status)}
                        >
                          <span className="text-white font-medium">{t.title}</span>
                          <span className="text-[10px] uppercase text-slate-500 block mt-0.5">
                            {t.status.replace("_", " ")}
                            {t.priority === "HIGH" ? " · HIGH" : ""}
                            {overdue ? " · OVERDUE" : ""}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {t.assignee?.name ?? "Unassigned"} · {t.department ?? "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {data.tasks.length === 0 && <p className="text-xs text-slate-500">No tasks linked to this shoot day.</p>}
                <Link
                  href={`/creator/projects/${projectId}/pre-production/production-workspace`}
                  className="text-xs text-orange-400 hover:underline mt-3 inline-block"
                >
                  Production workspace →
                </Link>
              </section>

              {/* Incidents */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Incidents
                  </div>
                  <Button type="button" size="sm" className="bg-red-600 hover:bg-red-500 text-xs" onClick={() => setIncidentOpen(true)}>
                    Log
                  </Button>
                </div>
                {incidentOpen && (
                  <div className="mb-3 space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
                    <input
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                      placeholder="Title"
                      value={incTitle}
                      onChange={(e) => setIncTitle(e.target.value)}
                    />
                    <select
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                      value={incCategory}
                      onChange={(e) => setIncCategory(e.target.value)}
                    >
                      {["SAFETY", "EQUIPMENT", "DELAY", "CAST_CREW", "LOCATION", "WEATHER", "OTHER"].map((c) => (
                        <option key={c} value={c}>
                          {c.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                      value={incSeverity}
                      onChange={(e) => setIncSeverity(e.target.value)}
                    >
                      {["LOW", "MEDIUM", "HIGH"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm min-h-[64px]"
                      placeholder="What happened?"
                      value={incBody}
                      onChange={(e) => setIncBody(e.target.value)}
                    />
                    <select
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                      value={incOwner}
                      onChange={(e) => setIncOwner(e.target.value)}
                    >
                      <option value="">Resolution owner (optional)</option>
                      {data.teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name ?? m.email ?? m.id}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          safePost({
                            action: "LOG_INCIDENT",
                            title: incTitle.trim(),
                            description: incBody.trim(),
                            category: incCategory,
                            severity: incSeverity,
                            resolutionOwnerId: incOwner || null,
                          });
                          setIncidentOpen(false);
                          setIncTitle("");
                          setIncBody("");
                          setIncOwner("");
                          setToast("Incident logged.");
                        }}
                      >
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setIncidentOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
                  {data.incidents.map((i) => (
                    <li key={i.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-white font-medium">{i.title}</span>
                        {!i.resolved ? (
                          <button
                            type="button"
                            className="text-emerald-400 text-xs shrink-0"
                            onClick={() => safePost({ action: "UPDATE_INCIDENT", id: i.id, resolved: true })}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">Resolved</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {i.category ?? "—"} · {i.severity}
                        {i.resolutionOwner?.name ? ` · Owner: ${i.resolutionOwner.name}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </>
          );
        })()
      ) : null}
    </div>
  );
}
