"use client";

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useModocOptional, useModoc } from "@/components/modoc";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useProjectSchedule, useProjectCallSheets } from "@/hooks/useCreatorProjectData";
import { ProductionModocReportModal } from "../production-modoc-modal";
import { ProductionControlCenterClient } from "../production-control-center-client";
import { CallSheetGenerator } from "../call-sheet-generator-client";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { formatZar } from "@/lib/format-currency-zar";

interface ProductionToolPageProps {
  params: Promise<{ projectId?: string; tool: string }>;
}

const LABELS: Record<string, string> = {
  "control-center": "Production Control Center",
  "call-sheet-generator": "Call Sheet Generator",
  "on-set-tasks": "On-Set Task Management",
  "equipment-tracking": "Equipment Tracking",
  "shoot-progress": "Shoot Progress Tracker",
  "continuity-manager": "Continuity Manager",
  "dailies-review": "Dailies Review",
  "expense-tracker": "Production Expense Tracker",
  "incident-reporting": "Incident Reporting",
  wrap: "Production Wrap",
};

function UnlinkedBanner() {
  return (
    <div className="storytime-plan-card border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/95">
      No project linked. Use the dropdown above to link a project and save your work, or create one from the dashboard.
    </div>
  );
}

export default function ProductionToolPage({ params }: ProductionToolPageProps) {
  const [resolved, setResolved] = useState<{ projectId?: string; tool: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.resolve(params).then((p) => {
      if (alive) setResolved(p);
    });
    return () => {
      alive = false;
    };
  }, [params]);

  const projectId = resolved?.projectId;
  const tool = resolved?.tool ?? "";
  const title = LABELS[tool] ?? "Production Workspace";
  const hasProject = !!projectId;

  if (tool === "control-center") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ControlCenter projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "call-sheet-generator") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl bg-slate-800/60" />}>
          <CallSheetGenerator projectId={projectId} title={title} />
        </Suspense>
      </>
    );
  }
  if (tool === "on-set-tasks") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <OnSetTasks projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "equipment-tracking") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <EquipmentTracking projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "shoot-progress") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ShootProgress projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "continuity-manager") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ContinuityManager projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "dailies-review") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <DailiesReview projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "expense-tracker") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ExpenseTracker projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "incident-reporting") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <IncidentReporting projectId={projectId} title={title} />
      </>
    );
  }
  if (tool === "wrap") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ProductionWrap projectId={projectId} title={title} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          On-set tools for running and tracking your shoot.
        </p>
      </header>
    </div>
  );
}

function ControlCenter({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass } = useAdaptiveUi();
  const base = projectId ? `/creator/projects/${projectId}/production` : "#";
  return (
    <div className={`space-y-6 ${deviceClass === "tv" ? "adaptive-tv-surface" : ""}`}>
      <ProductionControlCenterClient projectId={projectId} title={title} />
      <div className="creator-glass-panel p-4">
        <p className="text-xs font-medium text-slate-400 mb-2">More production tools</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/call-sheet-generator`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Call Sheet Generator
          </Link>
          <Link href={`${base}/on-set-tasks`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            On-Set Tasks
          </Link>
          <Link href={`${base}/equipment-tracking`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Equipment Tracking
          </Link>
          <Link href={`${base}/shoot-progress`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Shoot Progress
          </Link>
          <Link href={`${base}/continuity-manager`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Continuity Manager
          </Link>
          <Link href={`${base}/dailies-review`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Dailies Review
          </Link>
          <Link href={`${base}/expense-tracker`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Expense Tracker
          </Link>
          <Link href={`${base}/incident-reporting`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Incident Reporting
          </Link>
          <Link href={`${base}/wrap`} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-orange-500/20 hover:text-orange-300 border border-slate-700">
            Production Wrap
          </Link>
        </div>
      </div>
    </div>
  );
}

function OnSetTasks({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/tasks`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: scenesData } = useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/scenes`).then((r) => r.json()),
    enabled: hasProject,
  });
  const tasks = useMemo(
    () =>
      ((data?.tasks ?? []) as {
        id: string;
        title: string;
        description: string | null;
        status: string;
        department: string | null;
        priority: string | null;
        shootDay?: { id: string; date: string } | null;
        scene?: { id: string; number: string; heading: string | null } | null;
      }[]),
    [data?.tasks],
  );
  const shootDays = useMemo(
    () => ((scheduleData?.shootDays ?? []) as { id: string; date: string }[]),
    [scheduleData?.shootDays],
  );
  const scenesList = (scenesData?.scenes ?? []) as { id: string; number: string; heading: string | null }[];
  const [newTitle, setNewTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPriority, setNewPriority] = useState<string>("MEDIUM");
  const [newShootDayId, setNewShootDayId] = useState<string>("");
  const [newSceneId, setNewSceneId] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterShootDayId, setFilterShootDayId] = useState<string>("");
  const [mobileLane, setMobileLane] = useState<"TODO" | "IN_PROGRESS" | "DONE">("TODO");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          department: newDepartment.trim() || undefined,
          priority: newPriority,
          shootDayId: newShootDayId || undefined,
          sceneId: newSceneId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setNewTitle("");
      setNewDepartment("");
      setNewShootDayId("");
      setNewSceneId("");
    },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/tasks?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
  });

  const filtered = useMemo(() => {
    let t = tasks;
    if (filterDept) {
      t = t.filter((x) => (x.department || "").toLowerCase() === filterDept.toLowerCase());
    }
    if (filterShootDayId) {
      t = t.filter((x) => x.shootDay?.id === filterShootDayId);
    }
    return t;
  }, [tasks, filterDept, filterShootDayId]);
  const todo = filtered.filter((t) => t.status === "TODO");
  const inProgress = filtered.filter((t) => t.status === "IN_PROGRESS");
  const done = filtered.filter((t) => t.status === "DONE");
  const departments = Array.from(new Set(tasks.map((t) => t.department).filter(Boolean))) as string[];
  const touchKanban = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  return (
    <div className={`space-y-4 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Kanban for on-set tasks. Create tasks, move them through To do → In progress → Done. Tasks created from Risk, Table Reads, or Dailies can appear here.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get AI on-set task insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="on_set_tasks"
          reportTitle="On-set task management"
          prompt="Use the project tasks and shoot schedule in your context. Suggest task priorities (by department or urgency), how to communicate reminders and updates, and how to reprioritize when the schedule or production requirements change in real time."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      <Card className="creator-glass-panel border-0 bg-transparent p-4 shadow-none">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-[11px] text-slate-400">New task</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Confirm van arrival, Check stunt rig"
              className="bg-slate-900 border-slate-700 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Department</label>
            <Input
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="Camera, Art, Sound..."
              className="bg-slate-900 border-slate-700 text-sm w-32"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Priority</label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white w-28"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            disabled={!newTitle.trim() || createMutation.isPending || !hasProject}
            onClick={() => hasProject && newTitle.trim() && createMutation.mutate()}
          >
            Add task
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-slate-800">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Link to shoot day</label>
            <select
              value={newShootDayId}
              onChange={(e) => setNewShootDayId(e.target.value)}
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white min-w-[160px]"
            >
              <option value="">None</option>
              {shootDays.map((d) => (
                <option key={d.id} value={d.id}>
                  {new Date(d.date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Link to scene</label>
            <select
              value={newSceneId}
              onChange={(e) => setNewSceneId(e.target.value)}
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm text-white min-w-[180px]"
            >
              <option value="">None</option>
              {scenesList.map((s) => (
                <option key={s.id} value={s.id}>
                  Sc. {s.number}
                  {s.heading ? ` — ${s.heading.slice(0, 24)}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {shootDays.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400">Filter by shoot day:</span>
          <select
            value={filterShootDayId}
            onChange={(e) => setFilterShootDayId(e.target.value)}
            className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
          >
            <option value="">All shoot days</option>
            {shootDays.map((d) => (
              <option key={d.id} value={d.id}>
                {new Date(d.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {departments.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400">Filter by department:</span>
          <button
            type="button"
            onClick={() => setFilterDept("")}
            className={`px-2 py-1 rounded-md text-xs ${!filterDept ? "bg-orange-500/20 text-orange-300 border border-orange-500/50" : "bg-slate-800 text-slate-300 border border-slate-700"}`}
          >
            All
          </button>
          {departments.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilterDept(d || "")}
              className={`px-2 py-1 rounded-md text-xs ${filterDept === d ? "bg-orange-500/20 text-orange-300 border border-orange-500/50" : "bg-slate-800 text-slate-300 border border-slate-700"}`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {touchKanban && !isLoading && (
        <div className="creator-glass-panel p-2">
          <div className="grid grid-cols-3 gap-1">
            {[
              { key: "TODO", label: `To do (${todo.length})` },
              { key: "IN_PROGRESS", label: `In progress (${inProgress.length})` },
              { key: "DONE", label: `Done (${done.length})` },
            ].map((lane) => (
              <button
                key={lane.key}
                type="button"
                onClick={() => setMobileLane(lane.key as "TODO" | "IN_PROGRESS" | "DONE")}
                className={`adaptive-interactive rounded-lg px-2 py-2 text-xs border ${
                  mobileLane === lane.key
                    ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                    : "border-slate-700 bg-slate-900/70 text-slate-300"
                }`}
              >
                {lane.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : touchKanban ? (
        <div className="adaptive-scroll-x">
          {mobileLane === "TODO" ? (
            <Column
              title="To do"
              count={todo.length}
              tasks={todo}
              onStatus={hasProject ? (id) => updateMutation.mutate({ id, status: "IN_PROGRESS" }) : undefined}
              onDelete={
                hasProject
                  ? (id) => {
                      if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
                      deleteMutation.mutate(id);
                    }
                  : undefined
              }
            />
          ) : null}
          {mobileLane === "IN_PROGRESS" ? (
            <Column
              title="In progress"
              count={inProgress.length}
              tasks={inProgress}
              onStatus={hasProject ? (id) => updateMutation.mutate({ id, status: "DONE" }) : undefined}
              onDelete={
                hasProject
                  ? (id) => {
                      if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
                      deleteMutation.mutate(id);
                    }
                  : undefined
              }
            />
          ) : null}
          {mobileLane === "DONE" ? (
            <Column
              title="Done"
              count={done.length}
              tasks={done}
              onDelete={
                hasProject
                  ? (id) => {
                      if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
                      deleteMutation.mutate(id);
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Column
            title="To do"
            count={todo.length}
            tasks={todo}
            onStatus={hasProject ? (id) => updateMutation.mutate({ id, status: "IN_PROGRESS" }) : undefined}
            onDelete={
              hasProject
                ? (id) => {
                    if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
                    deleteMutation.mutate(id);
                  }
                : undefined
            }
          />
          <Column
            title="In progress"
            count={inProgress.length}
            tasks={inProgress}
            onStatus={hasProject ? (id) => updateMutation.mutate({ id, status: "DONE" }) : undefined}
            onDelete={
              hasProject
                ? (id) => {
                    if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
                    deleteMutation.mutate(id);
                  }
                : undefined
            }
          />
          <Column
            title="Done"
            count={done.length}
            tasks={done}
            onDelete={
              hasProject
                ? (id) => {
                    if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
                    deleteMutation.mutate(id);
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  count,
  tasks,
  onStatus,
  onDelete,
}: {
  title: string;
  count?: number;
  tasks: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    department?: string | null;
    priority?: string | null;
    shootDay?: { id: string; date: string } | null;
    scene?: { id: string; number: string; heading: string | null } | null;
  }[];
  onStatus?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="creator-glass-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-400">{title}</p>
        {count !== undefined && <span className="text-[11px] text-slate-500">{count}</span>}
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/80 border border-slate-800 px-2 py-1.5 text-sm text-white"
          >
            <div className="min-w-0 flex-1">
              <span className="truncate block">{t.title}</span>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {t.priority === "HIGH" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">High</span>
                )}
                {t.department && (
                  <span className="text-[10px] text-slate-500">{t.department}</span>
                )}
                {t.shootDay && (
                  <span className="text-[10px] text-slate-600">
                    Day {new Date(t.shootDay.date).toLocaleDateString()}
                  </span>
                )}
                {t.scene && (
                  <span className="text-[10px] text-slate-600">Sc. {t.scene.number}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-red-400/90 hover:text-red-300 px-1.5"
                  type="button"
                  onClick={() => onDelete(t.id)}
                  aria-label="Delete task"
                >
                  ×
                </Button>
              )}
              {onStatus && (
                <Button size="sm" variant="ghost" className="text-xs text-slate-400 shrink-0" onClick={() => onStatus(t.id)}>
                  →
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EquipmentTracking({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const hasProject = !!projectId;
  const queryClient = useQueryClient();
  const [dayFilter, setDayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [issueDrafts, setIssueDrafts] = useState<Record<string, { type: string; description: string; severity: string }>>({});
  const [checklistDrafts, setChecklistDrafts] = useState<
    Record<string, { label: string; physicallyPresent: boolean; note: string; photoUrl: string | null }>
  >({});
  const [uploadingChecklistItemId, setUploadingChecklistItemId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["project-equipment-plan", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/equipment-plan`).then((r) => r.json()),
    enabled: hasProject,
    refetchInterval: 5000,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });
  const items = useMemo(
    () =>
      ((data?.items ?? []) as {
        id: string;
        equipmentListing?: { id: string; companyName: string; category: string } | null;
        category: string;
        quantity: number;
        department: string | null;
        description: string | null;
        notes: string | null;
        tracking: {
          uniqueTag: string | null;
          ownerProviderName: string | null;
          assignedCrewName: string | null;
          assignedSceneIds: string[];
          assignedShootDayIds: string[];
          currentStatus: string;
          movementLogs: Array<{ id: string; event: string; at: string; note?: string | null; condition?: string | null }>;
          issues: Array<{ id: string; type: string; description: string; severity: string; status: string; createdAt: string }>;
          openIssueCount: number;
          checklistEntries: Array<{
            id: string;
            label: string;
            physicallyPresent: boolean;
            photoUrl: string | null;
            note?: string | null;
            checkedAt: string;
          }>;
        };
        market: { dailyRate: number | null; quantityAvailable: number | null };
      }[]),
    [data?.items],
  );
  const shootDays = useMemo(
    () => ((scheduleData?.shootDays ?? []) as Array<{ id: string; date: string; status: string }>),
    [scheduleData?.shootDays],
  );
  const summary = (data?.summary ?? {}) as { byStatus?: Record<string, number> };
  const byDay = useMemo(
    () =>
      ((data?.byDay ?? {}) as Record<
        string,
        Array<{
          id: string;
          category: string;
          quantity: number;
          status: string;
          assignedScenes: string[];
          assignedCrewName: string | null;
        }>
      >),
    [data?.byDay],
  );

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/equipment-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Unable to update equipment");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-equipment-plan", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["production-control-center", projectId] });
      setToast("Equipment tracking updated.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const applyUpdate = useCallback(
    (payload: Record<string, unknown>) => {
      if (!hasProject) return;
      if (!navigator.onLine) {
        setToast("Offline. Reconnect to sync equipment updates.");
        return;
      }
      updateMutation.mutate(payload);
    },
    [hasProject, updateMutation],
  );

  const uploadChecklistPhoto = useCallback(async (itemId: string, file: File) => {
    setUploadingChecklistItemId(itemId);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setChecklistDrafts((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] ?? { label: "", physicallyPresent: true, note: "", photoUrl: null }),
          photoUrl: publicUrl,
        },
      }));
      setToast("Checklist photo uploaded.");
      return publicUrl;
    } catch (e) {
      setToast((e as Error).message || "Photo upload failed");
    } finally {
      setUploadingChecklistItemId(null);
    }
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter((i) => {
        if (statusFilter && i.tracking.currentStatus !== statusFilter) return false;
        if (categoryFilter && !i.category.toLowerCase().includes(categoryFilter.toLowerCase())) return false;
        if (dayFilter && !i.tracking.assignedShootDayIds.includes(dayFilter)) return false;
        return true;
      }),
    [items, statusFilter, categoryFilter, dayFilter],
  );

  const byDepartment = filteredItems.reduce((acc, i) => {
    const key = i.department || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(i);
    return acc;
  }, {} as Record<string, typeof filteredItems>);
  const totalItems = filteredItems.reduce((s, i) => s + i.quantity, 0);
  const inUseUnits = filteredItems.filter((i) => i.tracking.currentStatus === "IN_USE").reduce((s, i) => s + i.quantity, 0);
  const idleUnits = filteredItems.filter((i) => i.tracking.currentStatus === "IDLE").reduce((s, i) => s + i.quantity, 0);
  const issueUnits = filteredItems.filter((i) => i.tracking.currentStatus === "ISSUE_REPORTED" || i.tracking.openIssueCount > 0).reduce((s, i) => s + i.quantity, 0);
  const daySnapshot = dayFilter ? byDay[dayFilter] ?? [] : [];
  const allDaysSnapshot = useMemo(
    () =>
      shootDays.map((day) => ({
        day,
        rows: byDay[day.id] ?? [],
      })),
    [shootDays, byDay],
  );
  const compactMode = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  return (
    <div className={`space-y-4 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Live equipment control for production: lifecycle tracking, check-in/out, issue handling, and planned vs actual visibility.
          </p>
        </div>
        {modoc && (
          <div className="flex flex-wrap items-center gap-2">
            {projectId && (
              <>
                <Link
                  href={`/api/creator/projects/${projectId}/equipment-plan/export?format=csv`}
                  className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-[11px] text-slate-200 hover:border-slate-500"
                >
                  Export CSV
                </Link>
                <Link
                  href={`/api/creator/projects/${projectId}/equipment-plan/export?format=json`}
                  className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-[11px] text-slate-200 hover:border-slate-500"
                >
                  Export JSON
                </Link>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get AI equipment tracking insights
            </Button>
          </div>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="equipment_tracking"
          reportTitle="Equipment tracking"
          prompt="Use the planned equipment and shoot days in your context. Suggest how to track usage and availability, manage resources (sign-out, return-by-wrap, damage reporting), and flag any missing gear or quantities needed for upcoming shoot days."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      {toast && <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">{toast}</div>}

      {hasProject && items.length > 0 && (
        <div className={`creator-glass-panel p-3 grid gap-2 text-sm ${compactMode ? "" : "md:grid-cols-4"}`}>
          <span className="text-slate-300"><span className="font-medium text-white">{filteredItems.length}</span> line items</span>
          <span className="text-slate-300"><span className="font-medium text-white">{totalItems}</span> total units</span>
          <span className="text-slate-300"><span className="font-medium text-white">{inUseUnits}</span> in use</span>
          <span className="text-slate-300"><span className="font-medium text-white">{idleUnits}</span> idle</span>
          <span className="text-slate-300"><span className="font-medium text-white">{issueUnits}</span> issue risk units</span>
          <span className="text-slate-300"><span className="font-medium text-white">{summary.byStatus?.RESERVED ?? 0}</span> reserved units</span>
        </div>
      )}

      {hasProject && (
        <div className={`creator-glass-panel p-3 grid gap-2 ${compactMode ? "" : "md:grid-cols-3"}`}>
          <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All shoot days</option>
            {shootDays.map((d) => (
              <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()} · {d.status}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All statuses</option>
            {["PLANNED", "RESERVED", "DELIVERED", "IN_USE", "IDLE", "ISSUE_REPORTED", "RETURNED"].map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
          <Input
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Filter by category"
            className="bg-slate-900 border-slate-700 text-xs"
          />
        </div>
      )}

      {dayFilter ? (
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Shoot day equipment snapshot</p>
          {daySnapshot.length === 0 ? (
            <p className="text-xs text-slate-500">No equipment assigned to this day.</p>
          ) : (
            <ul className="space-y-1">
              {daySnapshot.map((row) => (
                <li key={`${row.id}-${row.status}`} className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-xs text-slate-200">
                  {row.category} · Qty {row.quantity} · {row.status.replaceAll("_", " ")}
                  {row.assignedCrewName ? ` · ${row.assignedCrewName}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">All shoot days equipment snapshot</p>
          {allDaysSnapshot.length === 0 ? (
            <p className="text-xs text-slate-500">No shoot days available yet.</p>
          ) : (
            <div className="space-y-2">
              {allDaysSnapshot.map(({ day, rows }) => (
                <div key={day.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                  <p className="text-[11px] font-medium text-slate-200">
                    {new Date(day.date).toLocaleDateString()} · {day.status}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-[11px] text-slate-500 mt-1">No equipment assigned.</p>
                  ) : (
                    <ul className="space-y-1 mt-1">
                      {rows.map((row) => (
                        <li key={`${day.id}-${row.id}-${row.status}`} className="rounded border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
                          {row.category} · Qty {row.quantity} · {row.status.replaceAll("_", " ")}
                          {row.assignedCrewName ? ` · ${row.assignedCrewName}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="creator-glass-panel p-6 text-center">
              <p className="text-sm text-slate-500 mb-2">
                {!hasProject ? "Link a project above to see equipment." : "No equipment matching filters."}
              </p>
              {hasProject && (
                <Link
                  href={`/creator/projects/${projectId}/pre-production/equipment-planning`}
                  className="text-xs text-orange-400 hover:underline"
                >
                  Add equipment in Pre-Production Equipment Planning →
                </Link>
              )}
            </div>
          ) : (
            Object.entries(byDepartment).map(([dept, list]) => (
              <div key={dept} className="creator-glass-panel p-3 space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{dept}</p>
                <ul className="space-y-2">
                  {list.map((i) => (
                    <li key={i.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm">
                      <div>
                        <span className="text-white">{i.category}</span>
                        {i.description && <p className="text-[11px] text-slate-500 mt-0.5">{i.description}</p>}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Tag {i.tracking.uniqueTag || "—"} · Provider {i.tracking.ownerProviderName || i.equipmentListing?.companyName || "—"} · Daily rate {formatZar(Math.round(i.market?.dailyRate ?? 0), { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Assigned crew {i.tracking.assignedCrewName || "Unassigned"} · Open issues {i.tracking.openIssueCount}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className="text-slate-400 mr-1">Qty: {i.quantity}</span>
                        {["PLANNED", "RESERVED", "DELIVERED", "IN_USE", "IDLE", "ISSUE_REPORTED", "RETURNED"].map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant="outline"
                            className={`h-6 px-2 text-[10px] ${
                              i.tracking.currentStatus === status
                                ? "border-orange-500/70 text-orange-200"
                                : "border-slate-700 text-slate-300"
                            }`}
                            onClick={() => applyUpdate({ id: i.id, action: "SET_STATUS", status, shootDayId: dayFilter || null })}
                          >
                            {status.replaceAll("_", " ")}
                          </Button>
                        ))}
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-emerald-600 text-emerald-200" onClick={() => applyUpdate({ id: i.id, action: "CHECK_IN", shootDayId: dayFilter || null })}>
                          Check-In
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-sky-600 text-sky-200"
                          onClick={() => {
                            const condition = window.prompt("Condition on check-out/return", "Good");
                            applyUpdate({ id: i.id, action: "CHECK_OUT", movementCondition: condition || null, shootDayId: dayFilter || null });
                          }}
                        >
                          Check-Out
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <p className="text-[11px] text-slate-300 mb-1">Issue & damage log</p>
                          <div className="grid gap-1 md:grid-cols-[120px_1fr_95px_auto]">
                            <select
                              value={issueDrafts[i.id]?.type ?? "DAMAGE"}
                              onChange={(e) =>
                                setIssueDrafts((prev) => ({
                                  ...prev,
                                  [i.id]: { ...(prev[i.id] ?? { description: "", severity: "MEDIUM" }), type: e.target.value },
                                }))
                              }
                              className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white"
                            >
                              {["DAMAGE", "MALFUNCTION", "MISSING", "LATE_DELIVERY", "INCORRECT_EQUIPMENT"].map((type) => (
                                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                              ))}
                            </select>
                            <Input
                              value={issueDrafts[i.id]?.description ?? ""}
                              onChange={(e) =>
                                setIssueDrafts((prev) => ({
                                  ...prev,
                                  [i.id]: { ...(prev[i.id] ?? { type: "DAMAGE", severity: "MEDIUM" }), description: e.target.value },
                                }))
                              }
                              placeholder="Describe issue"
                              className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                            />
                            <select
                              value={issueDrafts[i.id]?.severity ?? "MEDIUM"}
                              onChange={(e) =>
                                setIssueDrafts((prev) => ({
                                  ...prev,
                                  [i.id]: { ...(prev[i.id] ?? { type: "DAMAGE", description: "" }), severity: e.target.value },
                                }))
                              }
                              className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white"
                            >
                              {["LOW", "MEDIUM", "HIGH"].map((sev) => (
                                <option key={sev} value={sev}>{sev}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              className="h-8 bg-red-600 hover:bg-red-500 text-[11px]"
                              onClick={() => {
                                const d = issueDrafts[i.id];
                                if (!d?.description?.trim()) return;
                                applyUpdate({
                                  id: i.id,
                                  action: "LOG_ISSUE",
                                  shootDayId: dayFilter || null,
                                  issue: {
                                    type: d.type as "DAMAGE" | "MALFUNCTION" | "MISSING" | "LATE_DELIVERY" | "INCORRECT_EQUIPMENT",
                                    description: d.description.trim(),
                                    severity: d.severity as "LOW" | "MEDIUM" | "HIGH",
                                  },
                                });
                              }}
                            >
                              Log issue
                            </Button>
                          </div>
                          {i.tracking.issues.length > 0 && (
                            <ul className="space-y-1 mt-2">
                              {i.tracking.issues.slice().reverse().slice(0, 5).map((issue) => (
                                <li key={issue.id} className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
                                  [{issue.severity}] {issue.type.replaceAll("_", " ")} — {issue.description}
                                  <span className="text-slate-500"> · {new Date(issue.createdAt).toLocaleString()}</span>
                                  {issue.status === "OPEN" && (
                                    <button
                                      type="button"
                                      className="ml-2 text-emerald-300 hover:text-emerald-200"
                                      onClick={() => applyUpdate({ id: i.id, action: "RESOLVE_ISSUE", issueId: issue.id })}
                                    >
                                      Resolve
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                          <p className="text-[11px] text-slate-300 mb-1">Physical checklist (proof photo)</p>
                          <div className="grid gap-1 md:grid-cols-[1fr_auto]">
                            <Input
                              value={checklistDrafts[i.id]?.label ?? ""}
                              onChange={(e) =>
                                setChecklistDrafts((prev) => ({
                                  ...prev,
                                  [i.id]: { ...(prev[i.id] ?? { physicallyPresent: true, note: "", photoUrl: null }), label: e.target.value },
                                }))
                              }
                              placeholder="Checklist label (e.g. Camera body serial)"
                              className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                            />
                            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200 hover:border-slate-500">
                              {uploadingChecklistItemId === i.id ? "Uploading..." : "Upload proof"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingChecklistItemId === i.id}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    await uploadChecklistPhoto(i.id, file);
                                  } catch (err) {
                                    setToast((err as Error).message || "Photo upload failed");
                                  } finally {
                                    e.currentTarget.value = "";
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <div className="mt-1 grid gap-1 md:grid-cols-[auto_1fr_auto]">
                            <label className="inline-flex items-center gap-1 text-[11px] text-slate-200">
                              <input
                                type="checkbox"
                                checked={checklistDrafts[i.id]?.physicallyPresent ?? true}
                                onChange={(e) =>
                                  setChecklistDrafts((prev) => ({
                                    ...prev,
                                    [i.id]: { ...(prev[i.id] ?? { label: "", note: "", photoUrl: null }), physicallyPresent: e.target.checked },
                                  }))
                                }
                              />
                              Physically present
                            </label>
                            <Input
                              value={checklistDrafts[i.id]?.note ?? ""}
                              onChange={(e) =>
                                setChecklistDrafts((prev) => ({
                                  ...prev,
                                  [i.id]: { ...(prev[i.id] ?? { label: "", physicallyPresent: true, photoUrl: null }), note: e.target.value },
                                }))
                              }
                              placeholder="Optional note"
                              className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                            />
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-[11px]"
                              onClick={() => {
                                const d = checklistDrafts[i.id];
                                if (!d?.label?.trim()) {
                                  setToast("Checklist label is required.");
                                  return;
                                }
                                applyUpdate({
                                  id: i.id,
                                  action: "UPSERT_CHECKLIST",
                                  shootDayId: dayFilter || null,
                                  checklistEntry: {
                                    label: d.label.trim(),
                                    physicallyPresent: d.physicallyPresent ?? true,
                                    photoUrl: d.photoUrl ?? null,
                                    note: d.note?.trim() || null,
                                  },
                                });
                              }}
                            >
                              Save checklist
                            </Button>
                          </div>
                          {checklistDrafts[i.id]?.photoUrl ? (
                            <div className="mt-2 flex items-center gap-2">
                              <a href={checklistDrafts[i.id]?.photoUrl ?? "#"} target="_blank" rel="noreferrer" className="text-[11px] text-orange-300 hover:underline">
                                View uploaded proof
                              </a>
                              <span className="text-[11px] text-slate-500">saved with checklist entry</span>
                            </div>
                          ) : null}
                          {i.tracking.checklistEntries.length > 0 ? (
                            <ul className="space-y-1 mt-2">
                              {i.tracking.checklistEntries.slice().reverse().slice(0, 4).map((entry) => (
                                <li key={entry.id} className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300">
                                  {entry.physicallyPresent ? "Present" : "Missing"} · {entry.label}
                                  <span className="text-slate-500"> · {new Date(entry.checkedAt).toLocaleString()}</span>
                                  {entry.photoUrl ? (
                                    <a href={entry.photoUrl} target="_blank" rel="noreferrer" className="ml-2 text-orange-300 hover:underline">
                                      Proof photo
                                    </a>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-slate-500 mt-2">No physical checklist entries yet.</p>
                          )}
                        </div>
                      </div>
                      {i.tracking.movementLogs.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-2">
                          Last movement: {i.tracking.movementLogs[i.tracking.movementLogs.length - 1]?.event.replaceAll("_", " ")} ·{" "}
                          {new Date(i.tracking.movementLogs[i.tracking.movementLogs.length - 1]?.at || Date.now()).toLocaleString()}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={projectId ? `/creator/projects/${projectId}/pre-production/equipment-planning` : "/creator/pre/equipment-planning"}
          className="creator-glass-panel block p-4 transition hover:border-orange-400/35"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Pre-Production Equipment Planning</h3>
          <p className="text-xs text-slate-400">Edit planned cameras, lighting, audio, and gear for this project.</p>
        </Link>
        <Link href="/creator/equipment" className="creator-glass-panel block p-4 transition hover:border-orange-400/35">
          <h3 className="text-sm font-semibold text-white mb-1">Equipment marketplace & requests</h3>
          <p className="text-xs text-slate-400">View and update gear requests; track check-out and return.</p>
        </Link>
      </div>
    </div>
  );
}

function ShootProgress({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const hasProject = !!projectId;
  const queryClient = useQueryClient();
  const [dayFilter, setDayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});
  const [startDraft, setStartDraft] = useState<Record<string, string>>({});
  const [endDraft, setEndDraft] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["project-shoot-progress", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/shoot-progress`);
      if (!res.ok) throw new Error("Failed to load shoot progress");
      return res.json();
    },
    enabled: hasProject,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/shoot-progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Update failed");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-shoot-progress", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["production-control-center", projectId] });
      setToast("Shoot progress updated.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const overall = (data?.overall ?? {}) as {
    totalScenes: number;
    scenesCompleted: number;
    scenesRemaining: number;
    completionPercent: number;
    estimatedTimelineDays: number;
    actualTimelineDays: number;
    scheduleDriftDays: number;
    unresolvedRiskCount: number;
    unresolvedIncidentCount: number;
  };
  const days = (data?.days ?? []) as Array<{
    shootDayId: string;
    date: string;
    status: string;
    totalScenesScheduled: number;
    scenesCompleted: number;
    scenesRemaining: number;
    delayedScenes: number;
    completionPercent: number;
    delayMinutes: number;
    incidentCount: number;
    behindSchedule: boolean;
  }>;
  const scenes = useMemo(
    () =>
      ((data?.scenes ?? []) as Array<{
        shootDayId: string;
        shootDayDate: string;
        shootDayStatus: string;
        shootDaySceneId: string;
        sceneId: string;
        sceneNumber: string;
        heading: string | null;
        status: string;
        estimatedDurationMinutes: number;
        actualDurationMinutes: number | null;
        completionPercent: number;
        notes: string | null;
        actualStartAt: string | null;
        actualEndAt: string | null;
        auditHistory: Array<{ at: string; byUserId: string | null }>;
        taskProgressPercent: number | null;
        equipmentReadyPercent: number | null;
        relatedIncidentCount: number;
        hasBlockers: boolean;
      }>),
    [data?.scenes],
  );
  const alerts = (data?.alerts ?? []) as Array<{ type: string; severity: string; message: string }>;

  const filteredScenes = useMemo(
    () =>
      scenes.filter((s) => {
        if (dayFilter && s.shootDayId !== dayFilter) return false;
        if (statusFilter && s.status !== statusFilter) return false;
        return true;
      }),
    [scenes, dayFilter, statusFilter],
  );

  const toInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const compactMode = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  return (
    <div className={`space-y-4 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time progress intelligence: planned vs actual execution across scenes and shoot days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projectId && (
            <>
              <Link
                href={`/api/creator/projects/${projectId}/shoot-progress?format=csv`}
                className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-[11px] text-slate-200 hover:border-slate-500"
              >
                Export progress CSV
              </Link>
              <Link
                href={`/api/creator/projects/${projectId}/shoot-progress?report=producer-pdf`}
                className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-[11px] text-slate-200 hover:border-slate-500"
              >
                Producer summary PDF
              </Link>
            </>
          )}
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get AI shoot progress insights
            </Button>
          )}
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="shoot_progress"
          reportTitle="Shoot progress"
          prompt="Use the live shoot progress board to summarize completion, drift vs plan, delayed scenes, and recommended recovery actions."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {toast && <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">{toast}</div>}

      <div className={`grid gap-3 ${compactMode ? "" : "md:grid-cols-5"}`}>
        <div className="creator-glass-panel p-3">
          <p className="text-[11px] text-slate-400">Overall completion</p>
          <p className="text-xl font-semibold text-white">{overall.completionPercent ?? 0}%</p>
          <p className="text-[11px] text-slate-500">{overall.scenesCompleted ?? 0}/{overall.totalScenes ?? 0} scenes</p>
        </div>
        <div className="creator-glass-panel p-3">
          <p className="text-[11px] text-slate-400">Timeline drift</p>
          <p className="text-xl font-semibold text-white">{overall.scheduleDriftDays ?? 0}d</p>
          <p className="text-[11px] text-slate-500">plan {overall.estimatedTimelineDays ?? 0}d · actual {overall.actualTimelineDays ?? 0}d</p>
        </div>
        <div className="creator-glass-panel p-3">
          <p className="text-[11px] text-slate-400">Remaining scenes</p>
          <p className="text-xl font-semibold text-white">{overall.scenesRemaining ?? 0}</p>
        </div>
        <div className="creator-glass-panel p-3">
          <p className="text-[11px] text-slate-400">Open incidents</p>
          <p className="text-xl font-semibold text-white">{overall.unresolvedIncidentCount ?? 0}</p>
        </div>
        <div className="creator-glass-panel p-3">
          <p className="text-[11px] text-slate-400">Open risks</p>
          <p className="text-xl font-semibold text-white">{overall.unresolvedRiskCount ?? 0}</p>
        </div>
      </div>

      <div className="creator-glass-panel p-3">
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${overall.completionPercent ?? 0}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Live refresh: {isFetching ? "syncing..." : "active"}</p>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2">Active progress alerts</p>
          <ul className="space-y-1">
            {alerts.map((a, idx) => (
              <li key={`${a.type}-${idx}`} className="text-xs text-red-50">{a.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="creator-glass-panel p-3">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Production day progress</p>
        {isLoading ? (
          <Skeleton className="h-24 bg-slate-800/60" />
        ) : days.length === 0 ? (
          <p className="text-sm text-slate-500">No shoot days yet.</p>
        ) : (
          <div className="space-y-2">
            {days.map((d) => (
              <div key={d.shootDayId} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">
                    {new Date(d.date).toLocaleDateString()} · {d.status}
                    {d.behindSchedule ? <span className="ml-2 text-red-300">Behind schedule</span> : null}
                  </p>
                  <p className="text-xs text-slate-400">
                    {d.scenesCompleted}/{d.totalScenesScheduled} scenes · {d.completionPercent}% · delay {d.delayMinutes}m
                  </p>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${d.completionPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="creator-glass-panel p-3">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Timeline view</p>
        {isLoading ? (
          <Skeleton className="h-24 bg-slate-800/60" />
        ) : days.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className={`${compactMode ? "min-w-[560px]" : "min-w-[760px]"} space-y-2`}>
              {days.map((d) => {
                const dayScenes = scenes.filter((s) => s.shootDayId === d.shootDayId);
                return (
                  <div key={`timeline-${d.shootDayId}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                    <p className="text-[11px] text-slate-300 mb-1">
                      {new Date(d.date).toLocaleDateString()} · {d.status} · {d.completionPercent}%
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dayScenes.map((s) => (
                        <span
                          key={`chip-${s.shootDaySceneId}`}
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] ${
                            s.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : s.status === "IN_PROGRESS"
                                ? "bg-yellow-500/20 text-yellow-200"
                                : s.status === "DELAYED"
                                  ? "bg-red-500/20 text-red-200"
                                  : "bg-slate-700/40 text-slate-300"
                          }`}
                        >
                          S{s.sceneNumber} · {s.completionPercent}%
                        </span>
                      ))}
                      {dayScenes.length === 0 && <span className="text-[10px] text-slate-500">No scenes linked</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="creator-glass-panel p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
          >
            <option value="">All shoot days</option>
            {days.map((d) => (
              <option key={d.shootDayId} value={d.shootDayId}>{new Date(d.date).toLocaleDateString()} · {d.status}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
          >
            <option value="">All scene statuses</option>
            {["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED", "SKIPPED"].map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400 uppercase tracking-wide">Scene-level progress and manual on-set input</p>
        {isLoading ? (
          <Skeleton className="h-24 bg-slate-800/60" />
        ) : (
          <div className="space-y-2">
            {filteredScenes.map((s) => (
              <div key={s.shootDaySceneId} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">Scene {s.sceneNumber}{s.heading ? ` · ${s.heading}` : ""}</p>
                  <p className="text-xs text-slate-400">
                    {s.status.replaceAll("_", " ")} · {s.completionPercent}% · est {s.estimatedDurationMinutes}m / act {s.actualDurationMinutes ?? "—"}m
                  </p>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      s.status === "DELAYED"
                        ? "bg-red-500"
                        : s.status === "IN_PROGRESS"
                          ? "bg-yellow-500"
                          : s.status === "COMPLETED"
                            ? "bg-emerald-500"
                            : "bg-slate-500"
                    }`}
                    style={{ width: `${s.completionPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Task progress {s.taskProgressPercent ?? "—"}% · Equipment ready {s.equipmentReadyPercent ?? "—"}% · incidents {s.relatedIncidentCount}
                  {s.hasBlockers ? " · blockers active" : ""}
                </p>
                <div className="mt-2 grid gap-1 md:grid-cols-[130px_80px_1fr_1fr_1fr_auto]">
                  <select
                    defaultValue={s.status}
                    className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white"
                    onChange={(e) => patchMutation.mutate({ shootDayId: s.shootDayId, shootDaySceneId: s.shootDaySceneId, status: e.target.value })}
                  >
                    {["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED", "SKIPPED"].map((status) => (
                      <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                  <Input
                    value={pctDraft[s.shootDaySceneId] ?? `${s.completionPercent}`}
                    onChange={(e) => setPctDraft((prev) => ({ ...prev, [s.shootDaySceneId]: e.target.value }))}
                    placeholder="%"
                    className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                  />
                  <Input
                    type="datetime-local"
                    value={startDraft[s.shootDaySceneId] ?? toInput(s.actualStartAt)}
                    onChange={(e) => setStartDraft((prev) => ({ ...prev, [s.shootDaySceneId]: e.target.value }))}
                    className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                  />
                  <Input
                    type="datetime-local"
                    value={endDraft[s.shootDaySceneId] ?? toInput(s.actualEndAt)}
                    onChange={(e) => setEndDraft((prev) => ({ ...prev, [s.shootDaySceneId]: e.target.value }))}
                    className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                  />
                  <Input
                    value={noteDraft[s.shootDaySceneId] ?? (s.notes ?? "")}
                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [s.shootDaySceneId]: e.target.value }))}
                    placeholder="Manual on-set note"
                    className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-orange-500 hover:bg-orange-600 text-[11px]"
                    onClick={() =>
                      patchMutation.mutate({
                        shootDayId: s.shootDayId,
                        shootDaySceneId: s.shootDaySceneId,
                        completionPercent:
                          pctDraft[s.shootDaySceneId] === undefined
                            ? s.completionPercent
                            : Number(pctDraft[s.shootDaySceneId]),
                        actualStartAt: startDraft[s.shootDaySceneId]
                          ? new Date(startDraft[s.shootDaySceneId]).toISOString()
                          : null,
                        actualEndAt: endDraft[s.shootDaySceneId]
                          ? new Date(endDraft[s.shootDaySceneId]).toISOString()
                          : null,
                        notes: noteDraft[s.shootDaySceneId] ?? s.notes ?? null,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
                {s.auditHistory?.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Audit: {s.auditHistory.length} update(s), last {new Date(s.auditHistory[s.auditHistory.length - 1].at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
            {filteredScenes.length === 0 && <p className="text-sm text-slate-500">No scenes for current filters.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ContinuityManager({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [sceneFilter, setSceneFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [q, setQ] = useState("");
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [visibleSceneCount, setVisibleSceneCount] = useState(5);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pendingMediaByDraft, setPendingMediaByDraft] = useState<string[]>([]);
  const [newForm, setNewForm] = useState({
    body: "",
    sceneId: "",
    shootDayId: "",
    category: "GENERAL",
    kind: "SCENE" as "SCENE" | "TAKE" | "DAY",
    takeNumber: "",
    takeStatus: "USABLE" as "GOOD" | "USABLE" | "BEST" | "DISCARD",
    actorNames: "",
    tags: "",
    cameraSetup: "",
    lens: "",
    movement: "",
    plannedTimeOfDay: "",
    actualTimeOfDay: "",
    locationLabel: "",
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["project-continuity", projectId, sceneFilter, dayFilter, categoryFilter, q, compareLeftId, compareRightId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (sceneFilter) params.set("sceneId", sceneFilter);
      if (dayFilter) params.set("shootDayId", dayFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (q.trim()) params.set("q", q.trim());
      if (compareLeftId && compareRightId) {
        params.set("compareLeftId", compareLeftId);
        params.set("compareRightId", compareRightId);
      }
      const r = await fetch(`/api/creator/projects/${projectId}/continuity?${params.toString()}`);
      if (!r.ok) throw new Error("Failed to load continuity");
      return r.json();
    },
    enabled: hasProject,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const notes = useMemo(
    () =>
      ((data?.notes ?? []) as Array<{
        id: string;
        body: string;
        sceneId: string | null;
        shootDayId: string | null;
        createdAt: string;
        scene?: { id: string; number: string; heading: string | null; intExt: string | null; dayNight: string | null; characters: Array<{ id: string; name: string }> } | null;
        meta: {
          category: string;
          takeNumber: number | null;
          takeStatus: string | null;
          linkedImageUrls: string[];
          linkedVideoUrls: string[];
        };
        createdBy?: { id: string; name: string | null; email: string | null } | null;
      }>),
    [data?.notes],
  );
  const scenes = useMemo(
    () =>
      ((data?.scenes ?? []) as Array<{
        id: string;
        number: string;
        heading: string | null;
        intExt: string | null;
        dayNight: string | null;
        characters: Array<{ id: string; name: string }>;
      }>),
    [data?.scenes],
  );
  const shootDays = (data?.shootDays ?? []) as Array<{ id: string; date: string; status: string }>;
  const flags = (data?.flags ?? { inconsistentCount: 0, missingReferenceCount: 0 }) as { inconsistentCount: number; missingReferenceCount: number; inconsistentNoteIds?: string[] };
  const compare = (data?.compare ?? null) as { left: (typeof notes)[number] | null; right: (typeof notes)[number] | null } | null;

  const byScene = useMemo(() => {
    const map = new Map<string, typeof notes>();
    for (const note of notes) {
      const key = note.sceneId ?? "__unlinked__";
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return map;
  }, [notes]);
  const visibleScenes = useMemo(() => scenes.slice(0, visibleSceneCount), [scenes, visibleSceneCount]);
  const compactMode = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sceneId: newForm.sceneId || undefined,
        shootDayId: newForm.shootDayId || undefined,
        body: newForm.body,
        photoUrls: pendingMediaByDraft,
        meta: {
          kind: newForm.kind,
          category: newForm.category,
          takeNumber: newForm.takeNumber ? Number(newForm.takeNumber) : null,
          takeStatus: newForm.kind === "TAKE" ? newForm.takeStatus : null,
          actorNames: newForm.actorNames.split(",").map((s) => s.trim()).filter(Boolean),
          tags: newForm.tags.split(",").map((s) => s.trim()).filter(Boolean),
          cameraSetup: newForm.cameraSetup || null,
          lens: newForm.lens || null,
          movement: newForm.movement || null,
          plannedTimeOfDay: newForm.plannedTimeOfDay || null,
          actualTimeOfDay: newForm.actualTimeOfDay || null,
          locationLabel: newForm.locationLabel || null,
        },
      };
      const res = await fetch(`/api/creator/projects/${projectId}/continuity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-continuity", projectId] });
      setNewForm({
        body: "",
        sceneId: "",
        shootDayId: "",
        category: "GENERAL",
        kind: "SCENE",
        takeNumber: "",
        takeStatus: "USABLE",
        actorNames: "",
        tags: "",
        cameraSetup: "",
        lens: "",
        movement: "",
        plannedTimeOfDay: "",
        actualTimeOfDay: "",
        locationLabel: "",
      });
      setPendingMediaByDraft([]);
      setToast("Continuity record saved.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const uploadMedia = async (file: File) => {
    setUploadingMedia(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setPendingMediaByDraft((prev) => [...prev, publicUrl]);
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <div className={`space-y-4 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Visual and factual continuity memory across scenes, takes, and shoot days.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get AI continuity insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="continuity_manager"
          reportTitle="Continuity manager"
          prompt="Use the continuity notes and breakdown (props, wardrobes, locations) in your context. Suggest how to track costumes, props, and locations for consistency and recommend checklists to maintain continuity."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {toast && <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">{toast}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Notes</p><p className="text-xl font-semibold text-white">{notes.length}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Inconsistencies</p><p className="text-xl font-semibold text-red-300">{flags.inconsistentCount ?? 0}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Missing references</p><p className="text-xl font-semibold text-amber-300">{flags.missingReferenceCount ?? 0}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Sync</p><p className="text-sm font-medium text-slate-200">{isFetching ? "Live syncing..." : "Live"}</p></div>
      </div>

      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Filters</p>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={sceneFilter} onChange={(e) => setSceneFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All scenes</option>
            {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.number}{s.heading ? ` · ${s.heading}` : ""}</option>)}
          </select>
          <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All shoot days</option>
            {shootDays.map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()} · {d.status}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All categories</option>
            {["WARDROBE","PROPS","HAIR_MAKEUP","BLOCKING","LIGHTING","CAMERA","ENVIRONMENT","PERFORMANCE","GENERAL"].map((c)=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}
          </select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scene, character, tags..." className="h-9 bg-slate-900 border-slate-700 text-xs" />
        </div>
      </div>

      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs text-slate-400 uppercase tracking-wide">New continuity record</p>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={newForm.sceneId} onChange={(e) => setNewForm((p) => ({ ...p, sceneId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">Scene (optional)</option>
            {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.number}</option>)}
          </select>
          <select value={newForm.shootDayId} onChange={(e) => setNewForm((p) => ({ ...p, shootDayId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">Shoot day (optional)</option>
            {shootDays.map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>)}
          </select>
          <select value={newForm.kind} onChange={(e) => setNewForm((p) => ({ ...p, kind: e.target.value as "SCENE" | "TAKE" | "DAY" }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            {["SCENE","TAKE","DAY"].map((k)=><option key={k} value={k}>{k}</option>)}
          </select>
          <select value={newForm.category} onChange={(e) => setNewForm((p) => ({ ...p, category: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            {["WARDROBE","PROPS","HAIR_MAKEUP","BLOCKING","LIGHTING","CAMERA","ENVIRONMENT","PERFORMANCE","GENERAL"].map((c)=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}
          </select>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <Input value={newForm.takeNumber} onChange={(e) => setNewForm((p) => ({ ...p, takeNumber: e.target.value }))} placeholder="Take #" className="h-9 bg-slate-900 border-slate-700 text-xs" />
          <select value={newForm.takeStatus} onChange={(e) => setNewForm((p) => ({ ...p, takeStatus: e.target.value as "GOOD" | "USABLE" | "BEST" | "DISCARD" }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            {["GOOD","USABLE","BEST","DISCARD"].map((t)=><option key={t} value={t}>{t}</option>)}
          </select>
          <Input value={newForm.actorNames} onChange={(e) => setNewForm((p) => ({ ...p, actorNames: e.target.value }))} placeholder="Characters (comma-separated)" className="h-9 bg-slate-900 border-slate-700 text-xs" />
          <Input value={newForm.tags} onChange={(e) => setNewForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="h-9 bg-slate-900 border-slate-700 text-xs" />
        </div>
        <textarea
          value={newForm.body}
          onChange={(e) => setNewForm((p) => ({ ...p, body: e.target.value }))}
          placeholder="Continuity note..."
          rows={3}
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 hover:border-slate-500">
            {uploadingMedia ? "Uploading..." : "Capture / upload media"}
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                for (const file of files) {
                  try {
                    await uploadMedia(file);
                  } catch (err) {
                    setToast((err as Error).message || "Upload failed");
                  }
                }
                e.currentTarget.value = "";
              }}
            />
          </label>
          <span className="text-xs text-slate-500">{pendingMediaByDraft.length} media attached</span>
          <Button
            size="sm"
            className="adaptive-focus-target adaptive-interactive bg-orange-500 hover:bg-orange-600"
            disabled={!newForm.body.trim() || createMutation.isPending || !hasProject}
            onClick={() => hasProject && createMutation.mutate()}
            aria-label="Save continuity record"
          >
            Save continuity record
          </Button>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className={compactMode ? "space-y-4" : "grid gap-4 lg:grid-cols-3"}>
          <div className="creator-glass-panel p-3 space-y-2 lg:col-span-2">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Scene continuity board</p>
            {scenes.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">No scenes available yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="max-h-[560px] overflow-y-auto pr-1 space-y-2">
                {visibleScenes.map((scene) => {
                  const list = byScene.get(scene.id) ?? [];
                  return (
                    <div key={scene.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-white">Scene {scene.number}{scene.heading ? ` · ${scene.heading}` : ""}</p>
                        <span className="text-[11px] text-slate-400">{scene.intExt ?? "—"} · {scene.dayNight ?? "—"} · {list.length} notes</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Characters: {scene.characters.map((c) => c.name).join(", ") || "—"}</p>
                      {list.length > 0 ? (
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {list.slice(0, 6).map((n) => (
                            <div key={n.id} className={`rounded border px-2 py-1.5 text-[11px] ${flags.inconsistentNoteIds?.includes(n.id) ? "border-red-600/60 bg-red-950/20" : "border-slate-800 bg-slate-900/80"}`}>
                              <p className="text-slate-300">[{n.meta.category.replaceAll("_"," ")}]{n.meta.takeNumber ? ` Take ${n.meta.takeNumber}` : ""} {n.meta.takeStatus ? `· ${n.meta.takeStatus}` : ""}</p>
                              <p className="text-slate-200 mt-0.5">{n.body}</p>
                              <p className="text-slate-500 mt-0.5">{new Date(n.createdAt).toLocaleString()} · {n.createdBy?.name ?? n.createdBy?.email ?? "Unknown"}</p>
                              {(n.meta.linkedImageUrls.length > 0 || n.meta.linkedVideoUrls.length > 0) && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {n.meta.linkedImageUrls.slice(0, 3).map((url, idx) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={`${url}-${idx}`} src={url} alt="continuity ref" className="h-12 w-12 rounded object-cover" />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">No continuity references yet.</p>
                      )}
                    </div>
                  );
                })}
                </div>
                {visibleSceneCount < scenes.length ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-700 text-slate-200"
                    onClick={() => setVisibleSceneCount((prev) => Math.min(prev + 5, scenes.length))}
                  >
                    Show more scenes ({Math.min(5, scenes.length - visibleSceneCount)} more)
                  </Button>
                ) : scenes.length > 5 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-slate-400"
                    onClick={() => setVisibleSceneCount(5)}
                  >
                    Show less
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <aside className={`creator-glass-panel p-3 space-y-2 ${compactMode ? "" : ""}`}>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Side-by-side compare</p>
            <select value={compareLeftId} onChange={(e) => setCompareLeftId(e.target.value)} className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
              <option value="">Previous reference</option>
              {notes.map((n) => <option key={`L-${n.id}`} value={n.id}>S{n.scene?.number ?? "?"} · {n.meta.category} · {new Date(n.createdAt).toLocaleDateString()}</option>)}
            </select>
            <select value={compareRightId} onChange={(e) => setCompareRightId(e.target.value)} className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
              <option value="">Current capture</option>
              {notes.map((n) => <option key={`R-${n.id}`} value={n.id}>S{n.scene?.number ?? "?"} · {n.meta.category} · {new Date(n.createdAt).toLocaleDateString()}</option>)}
            </select>
            {compare?.left && compare?.right ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-slate-800 bg-slate-900/70 p-2">
                  <p className="text-[11px] text-slate-400 mb-1">Previous</p>
                  {compare.left.meta.linkedImageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={compare.left.meta.linkedImageUrls[0]} alt="previous" className="h-28 w-full rounded object-cover" />
                  ) : (
                    <div className="h-28 w-full rounded bg-slate-800/60" />
                  )}
                </div>
                <div className="rounded border border-slate-800 bg-slate-900/70 p-2">
                  <p className="text-[11px] text-slate-400 mb-1">Current</p>
                  {compare.right.meta.linkedImageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={compare.right.meta.linkedImageUrls[0]} alt="current" className="h-28 w-full rounded object-cover" />
                  ) : (
                    <div className="h-28 w-full rounded bg-slate-800/60" />
                  )}
                </div>
                <div className="col-span-2 rounded border border-slate-800 bg-slate-900/70 p-2 text-[11px] text-slate-300">
                  {compare.left.meta.category} → {compare.right.meta.category} · Take {compare.left.meta.takeNumber ?? "—"} → {compare.right.meta.takeNumber ?? "—"}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Select two entries to compare visual references and notes.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function DailiesReview({ projectId, title }: { projectId?: string; title: string }) {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-dailies", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/dailies`).then((r) => r.json()),
    enabled: hasProject,
  });
  const batches = (data?.batches ?? []) as {
    id: string;
    title: string | null;
    videoUrl: string | null;
    notes: string | null;
    createdAt: string;
    scene?: { number: string };
    shootDay?: { date: string };
    reviewNotes: { body: string }[];
  }[];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Dailies batches and review notes.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get AI dailies review insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="dailies_review"
          reportTitle="Dailies review"
          prompt="Use the dailies batches and review notes in your context. Analyze for quality and consistency, and flag any issues that should be addressed before moving into post-production."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">
              {!hasProject ? "Link a project above to see dailies." : "No dailies yet. Add batches when footage is ready."}
            </p>
          ) : (
            batches.map((b) => (
              <div key={b.id} className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
                <p className="text-sm font-medium text-white">{b.title || "Untitled batch"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {b.scene ? `Scene ${b.scene.number}` : ""} {b.shootDay ? new Date(b.shootDay.date).toLocaleDateString() : ""}
                </p>
                {b.videoUrl && (
                  <a href={b.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-orange-400 hover:underline mt-1 block">
                    Watch
                  </a>
                )}
                {b.reviewNotes?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {b.reviewNotes.map((rn, i) => (
                      <li key={i}>{rn.body}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ExpenseTracker({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [toast, setToast] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "MISCELLANEOUS",
    department: "MISCELLANEOUS",
    sceneId: "",
    shootDayId: "",
    amount: "",
    vendor: "",
    paymentMethod: "OTHER",
    notes: "",
    fundingSource: "",
    paymentDueAt: "",
  });
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  const [paymentProofUrls, setPaymentProofUrls] = useState<string[]>([]);

  const { data: expensesData, isFetching } = useQuery({
    queryKey: ["project-expenses", projectId],
    queryFn: async () => {
      const r = await fetch(`/api/creator/projects/${projectId}/expenses`);
      if (!r.ok) throw new Error("Failed to load expenses");
      return r.json();
    },
    enabled: hasProject,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: budgetData } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/budget`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });
  const scenes = (scheduleData?.scenes ?? []) as Array<{ id: string; number: string; heading: string | null }>;
  const shootDays = (scheduleData?.shootDays ?? []) as Array<{ id: string; date: string; status: string }>;

  const expenses = useMemo(
    () =>
      ((expensesData?.expenses ?? []) as Array<{
        id: string;
        amount: number;
        vendor: string | null;
        department: string | null;
        spentAt: string;
        meta: {
          title: string;
          category: string;
          sceneId: string | null;
          shootDayId: string | null;
          paymentMethod: string | null;
          notes: string | null;
          receiptUrls: string[];
          paymentProofUrls: string[];
          fundingSource: string | null;
          approvalStatus: string;
          paymentStatus: string;
          paymentDueAt: string | null;
        };
      }>),
    [expensesData?.expenses],
  );
  const dashboard = (expensesData?.dashboard ?? {}) as {
    totalBudget: number;
    totalSpend: number;
    remainingFunds: number;
    fundingLimit: number;
    fundingRemaining: number | null;
    burnRateDaily: number;
    topCostDrivers: Array<{ category: string; amount: number }>;
    pendingApproval: number;
    unpaidCount: number;
  };
  const comparison = (expensesData?.comparison ?? {}) as {
    byDepartment?: Array<{ key: string; budgeted: number; actual: number; remaining: number; variance: number }>;
    byScene?: Array<{ sceneId: string; sceneNumber: string; actual: number; variance: number }>;
    byProductionDay?: Array<{ shootDayId: string; date: string | null; actual: number; variance: number }>;
    overall?: { budgeted: number; actual: number; remaining: number; variance: number };
  };
  const alerts = (expensesData?.alerts ?? []) as Array<{ type: string; severity: string; message: string }>;
  const burnRate = (expensesData?.burnRate ?? []) as Array<{ date: string; amount: number }>;

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        if (categoryFilter && (e.meta.category ?? "").toUpperCase() !== categoryFilter) return false;
        if (approvalFilter && (e.meta.approvalStatus ?? "") !== approvalFilter) return false;
        if (paymentFilter && (e.meta.paymentStatus ?? "") !== paymentFilter) return false;
        return true;
      }),
    [expenses, categoryFilter, approvalFilter, paymentFilter],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          department: form.department,
          sceneId: form.sceneId || null,
          shootDayId: form.shootDayId || null,
          amount,
          vendor: form.vendor || null,
          paymentMethod: form.paymentMethod,
          notes: form.notes || null,
          fundingSource: form.fundingSource || null,
          paymentDueAt: form.paymentDueAt ? new Date(form.paymentDueAt).toISOString() : null,
          receiptUrls,
          paymentProofUrls,
          approvalStatus: "PENDING",
          paymentStatus: "UNPAID",
          spentAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to create expense");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      setForm({
        title: "",
        category: "MISCELLANEOUS",
        department: "MISCELLANEOUS",
        sceneId: "",
        shootDayId: "",
        amount: "",
        vendor: "",
        paymentMethod: "OTHER",
        notes: "",
        fundingSource: "",
        paymentDueAt: "",
      });
      setReceiptUrls([]);
      setPaymentProofUrls([]);
      setToast("Expense logged.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update expense");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      setToast("Expense updated.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const autoCaptureMutation = useMutation({
    mutationFn: async (source: "SIGNED_CONTRACTS" | "EQUIPMENT_USAGE") => {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "AUTO_CAPTURE", autoSource: source }),
      });
      if (!res.ok) throw new Error("Auto-capture failed");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      setToast("Auto-captured expenses generated.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const uploadFile = async (file: File, type: "receipt" | "proof") => {
    if (type === "receipt") setReceiptUploading(true);
    else setProofUploading(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      if (type === "receipt") setReceiptUrls((prev) => [...prev, publicUrl]);
      else setPaymentProofUrls((prev) => [...prev, publicUrl]);
    } finally {
      if (type === "receipt") setReceiptUploading(false);
      else setProofUploading(false);
    }
  };

  const budget = budgetData?.budget as { totalPlanned?: number } | null;
  const engine = budgetData?.engine as
    | {
        dashboard?: { estimatedTotal: number; actualSpend: number; variance: number };
        byDepartment?: Array<{
          department: string;
          estimated: number;
          actual: number;
          variance: number;
        }>;
      }
    | undefined;
  const totalSpent = dashboard.totalSpend ?? expenses.reduce((s, e) => s + e.amount, 0);
  const planned = dashboard.totalBudget ?? engine?.dashboard?.estimatedTotal ?? budget?.totalPlanned ?? 0;
  const compactMode = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  return (
    <div className={`space-y-4 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time financial control: budget vs actual, burn rate, approvals, and payment tracking.</p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get AI expense insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="production_expense_tracker"
          reportTitle="Production expense tracker"
          prompt="Use the expenses and budget data in your context. Help categorize costs, summarize spending by department, and offer insights on budget adherence throughout production."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {toast && <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">{toast}</div>}
      {hasProject && projectId && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link
            href={`/creator/projects/${projectId}/pre-production/budget-builder`}
            className="text-orange-400 hover:text-orange-300"
          >
            Budget builder →
          </Link>
          <Link
            href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
            className="text-slate-400 hover:text-slate-200"
          >
            Production schedule →
          </Link>
          <Link href={`/api/creator/projects/${projectId}/expenses?format=csv`} className="text-slate-400 hover:text-slate-200">
            Export expenses CSV →
          </Link>
        </div>
      )}
      <div className={`grid gap-3 ${compactMode ? "" : "md:grid-cols-5"}`}>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Budget</p><p className="text-lg font-semibold text-white">{formatZar(planned, { maximumFractionDigits: 0 })}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Actual spend</p><p className="text-lg font-semibold text-white">{formatZar(totalSpent, { maximumFractionDigits: 0 })}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Remaining</p><p className={`text-lg font-semibold ${(dashboard.remainingFunds ?? planned - totalSpent) < planned * 0.15 ? "text-amber-300" : "text-emerald-300"}`}>{formatZar(dashboard.remainingFunds ?? planned - totalSpent, { maximumFractionDigits: 0 })}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Daily burn rate</p><p className="text-lg font-semibold text-white">{formatZar(dashboard.burnRateDaily ?? 0, { maximumFractionDigits: 0 })}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Pending approval / unpaid</p><p className="text-lg font-semibold text-white">{dashboard.pendingApproval ?? 0} / {dashboard.unpaidCount ?? 0}</p></div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2">Financial alerts</p>
          <ul className="space-y-1">
            {alerts.map((a, idx) => (
              <li key={`${a.type}-${idx}`} className="text-xs text-red-50">{a.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Real-time expense entry</p>
        <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-4"}`}>
          <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Expense title" className="bg-slate-900 border-slate-700 text-xs" />
          <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value, department: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            {["CAST","CREW","EQUIPMENT","LOCATIONS","TRANSPORT","CATERING","POST_PRODUCTION","MISCELLANEOUS"].map((c)=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}
          </select>
          <select value={form.sceneId} onChange={(e) => setForm((p) => ({ ...p, sceneId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">Scene (optional)</option>
            {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.number}</option>)}
          </select>
          <select value={form.shootDayId} onChange={(e) => setForm((p) => ({ ...p, shootDayId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">Production day (optional)</option>
            {shootDays.map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>)}
          </select>
        </div>
        <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-5"}`}>
          <Input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount (R)" type="number" className="bg-slate-900 border-slate-700 text-xs" />
          <Input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="Vendor / payee" className="bg-slate-900 border-slate-700 text-xs" />
          <select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            {["CASH","TRANSFER","CARD","MOBILE","OTHER"].map((m)=><option key={m} value={m}>{m}</option>)}
          </select>
          <Input value={form.fundingSource} onChange={(e) => setForm((p) => ({ ...p, fundingSource: e.target.value }))} placeholder="Funding source" className="bg-slate-900 border-slate-700 text-xs" />
          <Input type="date" value={form.paymentDueAt} onChange={(e) => setForm((p) => ({ ...p, paymentDueAt: e.target.value }))} className="bg-slate-900 border-slate-700 text-xs" />
        </div>
        <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes / payment terms / context" rows={2} className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 hover:border-slate-500">
            {receiptUploading ? "Uploading..." : "Upload receipt(s)"}
            <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              for (const file of files) await uploadFile(file, "receipt");
              e.currentTarget.value = "";
            }} />
          </label>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 hover:border-slate-500">
            {proofUploading ? "Uploading..." : "Upload payment proof"}
            <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              for (const file of files) await uploadFile(file, "proof");
              e.currentTarget.value = "";
            }} />
          </label>
          <span className="text-xs text-slate-500">{receiptUrls.length} receipt(s), {paymentProofUrls.length} proof file(s)</span>
          <Button
            size="sm"
            className="adaptive-focus-target adaptive-interactive bg-orange-500 hover:bg-orange-600"
            disabled={!form.title.trim() || !form.amount || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            aria-label="Log expense"
          >
            Log expense
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="adaptive-focus-target adaptive-interactive border-slate-700 text-slate-200"
            disabled={autoCaptureMutation.isPending}
            onClick={() => autoCaptureMutation.mutate("SIGNED_CONTRACTS")}
            aria-label="Auto capture expenses from signed contracts"
          >
            Auto-capture signed contracts
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="adaptive-focus-target adaptive-interactive border-slate-700 text-slate-200"
            disabled={autoCaptureMutation.isPending}
            onClick={() => autoCaptureMutation.mutate("EQUIPMENT_USAGE")}
            aria-label="Auto capture expenses from equipment usage"
          >
            Auto-capture equipment usage
          </Button>
        </div>
      </div>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Filters</p>
        <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-3"}`}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All categories</option>
            {["CAST","CREW","EQUIPMENT","LOCATIONS","TRANSPORT","CATERING","POST_PRODUCTION","MISCELLANEOUS"].map((c)=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}
          </select>
          <select value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All approval states</option>
            {["PENDING","APPROVED","REJECTED"].map((s)=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All payment states</option>
            {["UNPAID","PARTIAL","PAID"].map((s)=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="creator-glass-panel p-3 space-y-2 max-h-96 overflow-y-auto">
        {filteredExpenses.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No expenses logged yet.</p>
        ) : (
          filteredExpenses.map((e) => (
            <div key={e.id} className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-200 font-medium">{e.meta.title || e.department || "Expense"}</span>
                <span className="text-white">{formatZar(e.amount)}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {e.meta.category} · {e.vendor ?? "—"} · {new Date(e.spentAt).toLocaleString()} · approval {e.meta.approvalStatus} · payment {e.meta.paymentStatus}
              </p>
              {(e.meta.receiptUrls.length > 0 || e.meta.paymentProofUrls.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                  {e.meta.receiptUrls.length > 0 ? <span className="text-slate-400">{e.meta.receiptUrls.length} receipt(s)</span> : null}
                  {e.meta.paymentProofUrls.length > 0 ? <span className="text-slate-400">{e.meta.paymentProofUrls.length} payment proof(s)</span> : null}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-slate-700 text-slate-200" onClick={() => patchMutation.mutate({ id: e.id, meta: { approvalStatus: "APPROVED" } })}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-slate-700 text-slate-200" onClick={() => patchMutation.mutate({ id: e.id, meta: { approvalStatus: "REJECTED" } })}>
                  Reject
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-slate-700 text-slate-200" onClick={() => patchMutation.mutate({ id: e.id, meta: { paymentStatus: "PAID" } })}>
                  Mark paid
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {!!comparison.byDepartment?.length && (
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Budget vs actual by department
          </p>
          {comparison.byDepartment.map((dept) => (
            <div
              key={dept.key}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs"
            >
              <span className="text-slate-300">{dept.key.replaceAll("_", " ")}</span>
              <span className={dept.variance < 0 ? "text-red-300" : dept.remaining < dept.budgeted * 0.15 ? "text-amber-300" : "text-emerald-300"}>
                Est {formatZar(dept.budgeted, { maximumFractionDigits: 0 })} · Act {formatZar(dept.actual, { maximumFractionDigits: 0 })} · Var {formatZar(dept.variance, { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      )}
      {burnRate.length > 0 && (
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Daily burn rate trend</p>
          {burnRate.slice(-10).map((d) => (
            <div key={d.date} className="flex items-center justify-between rounded bg-slate-900/70 px-2 py-1 text-xs">
              <span className="text-slate-400">{d.date}</span>
              <span className="text-slate-200">{formatZar(d.amount, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">Integrated with budget, schedule, contracts, equipment usage, and production alerts.</p>
    </div>
  );
}

function IncidentReporting({ projectId, title }: { projectId?: string; title: string }) {
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [toast, setToast] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [draftMedia, setDraftMedia] = useState<string[]>([]);
  const [draftVideos, setDraftVideos] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "SAFETY",
    severity: "LOW",
    priority: "MEDIUM",
    shootDayId: "",
    linkedSceneId: "",
    location: "",
    involvedNames: "",
    equipmentLabels: "",
    actionSteps: "",
    resolutionNotes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["project-incidents", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/incidents`);
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
    enabled: hasProject,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const incidents = useMemo(
    () =>
      ((data?.incidents ?? []) as Array<{
        id: string;
        title: string;
        description: string;
        severity: string;
        category: string;
        location: string | null;
        createdAt: string;
        resolutionOwner: { name: string | null; email: string | null } | null;
        meta: {
          status: string;
          priority: string;
          occurredAt: string;
          linkedSceneId: string | null;
          mediaUrls: string[];
          videoUrls: string[];
          actionSteps: string[];
          resolutionNotes: string | null;
          timeline: Array<{ at: string; action: string; note?: string | null }>;
          timeToResolveMinutes: number | null;
        };
      }>),
    [data?.incidents],
  );
  const dashboard = (data?.dashboard ?? {}) as {
    total: number;
    open: number;
    criticalOpen: number;
    highOpen: number;
    avgResolutionMinutesResolved: number;
  };
  const alerts = (data?.alerts ?? []) as Array<{ message: string }>;
  const recurringIssues = (data?.recurringIssues ?? []) as Array<{ key: string; count: number; category: string; location: string | null }>;
  const references = (data?.references ?? {}) as {
    shootDays?: Array<{ id: string; date: string }>;
    scenes?: Array<{ id: string; number: string }>;
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((i) => {
      if (statusFilter && i.meta.status !== statusFilter) return false;
      if (severityFilter && i.severity !== severityFilter) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      return true;
    });
  }, [incidents, statusFilter, severityFilter, categoryFilter]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          severity: form.severity,
          priority: form.priority,
          shootDayId: form.shootDayId || null,
          linkedSceneId: form.linkedSceneId || null,
          location: form.location || null,
          involvedNames: form.involvedNames.split(",").map((s) => s.trim()).filter(Boolean),
          equipmentLabels: form.equipmentLabels.split(",").map((s) => s.trim()).filter(Boolean),
          actionSteps: form.actionSteps.split("\n").map((s) => s.trim()).filter(Boolean),
          resolutionNotes: form.resolutionNotes || null,
          mediaUrls: draftMedia,
          videoUrls: draftVideos,
          status: "OPEN",
          occurredAt: new Date().toISOString(),
          acknowledgeNow: form.severity === "CRITICAL",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-incidents", projectId] });
      setForm({
        title: "",
        description: "",
        category: "SAFETY",
        severity: "LOW",
        priority: "MEDIUM",
        shootDayId: "",
        linkedSceneId: "",
        location: "",
        involvedNames: "",
        equipmentLabels: "",
        actionSteps: "",
        resolutionNotes: "",
      });
      setDraftMedia([]);
      setDraftVideos([]);
      setToast("Incident logged.");
    },
    onError: (err) => setToast((err as Error).message),
  });
  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/incidents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-incidents", projectId] });
      setToast("Incident updated.");
    },
    onError: (err) => setToast((err as Error).message),
  });

  const uploadEvidence = async (file: File) => {
    setUploadingMedia(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      if (file.type.startsWith("video/")) setDraftVideos((prev) => [...prev, publicUrl]);
      else setDraftMedia((prev) => [...prev, publicUrl]);
    } catch (error) {
      setToast((error as Error).message);
    } finally {
      setUploadingMedia(false);
    }
  };

  const severityTone = (severityVal: string) => {
    if (severityVal === "CRITICAL") return "border-red-800 bg-red-950/55";
    if (severityVal === "HIGH") return "border-red-500/70 bg-red-950/30";
    if (severityVal === "MEDIUM") return "border-amber-500/60 bg-amber-950/25";
    return "border-emerald-500/40 bg-emerald-950/20";
  };
  const compactMode = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const tvMode = deviceClass === "tv";

  return (
    <div className={`space-y-4 ${tvMode ? "adaptive-tv-surface" : ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Log and resolve on-set incidents.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get AI incident analysis
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="incident_reporting"
          reportTitle="Incident reporting"
          prompt="Use the incidents and schedule in your context. Provide templates and analysis tools to understand the impact of incidents on production schedules and budgets."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {toast ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">
          {toast}
        </div>
      ) : null}
      {hasProject && projectId ? (
        <div className="flex flex-wrap gap-3 text-xs">
          <Link href={`/api/creator/projects/${projectId}/incidents?format=csv`} className="text-slate-400 hover:text-slate-200">
            Export incident log CSV →
          </Link>
        </div>
      ) : null}
      <div className={`grid gap-3 ${compactMode ? "" : "md:grid-cols-5"}`}>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Total</p><p className="text-lg font-semibold text-white">{dashboard.total ?? 0}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Open</p><p className="text-lg font-semibold text-white">{dashboard.open ?? 0}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">High open</p><p className="text-lg font-semibold text-red-300">{dashboard.highOpen ?? 0}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Critical open</p><p className="text-lg font-semibold text-red-400">{dashboard.criticalOpen ?? 0}</p></div>
        <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Avg resolve time</p><p className="text-lg font-semibold text-white">{dashboard.avgResolutionMinutesResolved ?? 0}m</p></div>
      </div>
      {alerts.length > 0 ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2">Active alerts</p>
          {alerts.slice(0, 8).map((a, idx) => (
            <p key={`${a.message}-${idx}`} className="text-xs text-red-100">{a.message}</p>
          ))}
        </div>
      ) : null}
      <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Instant incident capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-2"}`}>
            <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Incident title" className="bg-slate-900 border-slate-700 text-sm" />
            <Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Location" className="bg-slate-900 border-slate-700 text-sm" />
          </div>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            rows={3}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
          />
          <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-4"}`}>
            <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white">
              {["SAFETY","EQUIPMENT","DELAY","CAST_CREW","LOCATION","WEATHER","LEGAL_COMPLIANCE","OTHER"].map((cat) => <option key={cat} value={cat}>{cat.replaceAll("_"," ")}</option>)}
            </select>
            <select value={form.severity} onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white">
              {["LOW","MEDIUM","HIGH","CRITICAL"].map((sv) => <option key={sv} value={sv}>{sv}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white">
              {["LOW","MEDIUM","HIGH","CRITICAL"].map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </select>
            <select value={form.shootDayId} onChange={(e) => setForm((prev) => ({ ...prev, shootDayId: e.target.value }))} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white">
              <option value="">Production day</option>
              {(references.shootDays ?? []).map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-2"}`}>
            <select value={form.linkedSceneId} onChange={(e) => setForm((prev) => ({ ...prev, linkedSceneId: e.target.value }))} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white">
              <option value="">Linked scene</option>
              {(references.scenes ?? []).map((s) => <option key={s.id} value={s.id}>Scene {s.number}</option>)}
            </select>
            <Input value={form.involvedNames} onChange={(e) => setForm((prev) => ({ ...prev, involvedNames: e.target.value }))} placeholder="Involved individuals (comma-separated)" className="bg-slate-900 border-slate-700 text-sm" />
          </div>
          <Input value={form.equipmentLabels} onChange={(e) => setForm((prev) => ({ ...prev, equipmentLabels: e.target.value }))} placeholder="Equipment involved (comma-separated)" className="bg-slate-900 border-slate-700 text-sm" />
          <textarea value={form.actionSteps} onChange={(e) => setForm((prev) => ({ ...prev, actionSteps: e.target.value }))} placeholder="Action steps (one per line)" rows={2} className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white" />
          <textarea value={form.resolutionNotes} onChange={(e) => setForm((prev) => ({ ...prev, resolutionNotes: e.target.value }))} placeholder="Resolution notes (optional)" rows={2} className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 hover:border-slate-500">
              {uploadingMedia ? "Uploading..." : "Capture / upload evidence"}
              <input type="file" multiple accept="image/*,video/*" capture="environment" className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                for (const file of files) await uploadEvidence(file);
                e.currentTarget.value = "";
              }} />
            </label>
            <span className="text-xs text-slate-500">{draftMedia.length} photo(s), {draftVideos.length} video(s)</span>
          </div>
          <Button
            size="sm"
            className="adaptive-focus-target adaptive-interactive bg-orange-500 hover:bg-orange-600"
            disabled={!form.title.trim() || !form.description.trim() || createMutation.isPending || !hasProject}
            onClick={() => hasProject && createMutation.mutate()}
            aria-label="Report incident"
          >
            Report
          </Button>
        </CardContent>
      </Card>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Filters</p>
        <div className={`grid gap-2 ${compactMode ? "" : "md:grid-cols-3"}`}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white">
            <option value="">All statuses</option>
            {["OPEN","IN_PROGRESS","RESOLVED","CLOSED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white">
            <option value="">All severities</option>
            {["LOW","MEDIUM","HIGH","CRITICAL"].map((sv) => <option key={sv} value={sv}>{sv}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white">
            <option value="">All categories</option>
            {["SAFETY","EQUIPMENT","DELAY","CAST_CREW","LOCATION","WEATHER","LEGAL_COMPLIANCE","OTHER"].map((cat) => <option key={cat} value={cat}>{cat.replaceAll("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <div className="creator-glass-panel p-3 space-y-2">
        {isLoading ? (
          <Skeleton className="h-32 bg-slate-800/60" />
        ) : filteredIncidents.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">
            {!hasProject ? "Link a project above to report incidents." : "No incidents reported."}
          </p>
        ) : (
          filteredIncidents.map((i) => (
            <div key={i.id} className={`rounded-xl border px-3 py-2 ${severityTone(i.severity)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{i.title}</p>
                  <p className="text-xs text-slate-200">{i.category.replaceAll("_", " ")} · {i.severity} · {i.meta.priority} · {i.meta.status.replaceAll("_", " ")}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{new Date(i.meta.occurredAt || i.createdAt).toLocaleString()} · {i.location ?? "Location not set"}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patchMutation.mutate({ id: i.id, status: "IN_PROGRESS", timelineEvent: { action: "STATUS_SET_IN_PROGRESS" } })}>In progress</Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patchMutation.mutate({ id: i.id, status: "RESOLVED", timelineEvent: { action: "STATUS_SET_RESOLVED" } })}>Resolve</Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patchMutation.mutate({ id: i.id, status: "CLOSED", timelineEvent: { action: "STATUS_SET_CLOSED" } })}>Close</Button>
                </div>
              </div>
              <p className="text-xs text-slate-100 mt-2">{i.description}</p>
              {(i.meta.mediaUrls.length > 0 || i.meta.videoUrls.length > 0) ? (
                <p className="text-[11px] text-slate-300 mt-1">
                  Evidence: {i.meta.mediaUrls.length} photo(s), {i.meta.videoUrls.length} video(s)
                </p>
              ) : null}
              {i.meta.actionSteps.length > 0 ? (
                <div className="mt-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Action steps</p>
                  {i.meta.actionSteps.slice(0, 4).map((step, idx) => (
                    <p key={`${i.id}-step-${idx}`} className="text-[11px] text-slate-200">• {step}</p>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Timeline</p>
                  <div className="max-h-24 overflow-y-auto pr-1 space-y-1 mt-1">
                    {(i.meta.timeline ?? []).slice(-5).reverse().map((event, idx) => (
                      <p key={`${i.id}-event-${idx}`} className="text-[11px] text-slate-300">
                        {new Date(event.at).toLocaleString()} · {event.action.replaceAll("_", " ")}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Resolution</p>
                  <p className="text-[11px] text-slate-200 mt-1">
                    Owner: {i.resolutionOwner?.name ?? i.resolutionOwner?.email ?? "Unassigned"} ·
                    {" "}Time to resolve: {i.meta.timeToResolveMinutes != null ? `${i.meta.timeToResolveMinutes} min` : "—"}
                  </p>
                  {i.meta.resolutionNotes ? <p className="text-[11px] text-slate-300 mt-1">{i.meta.resolutionNotes}</p> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {recurringIssues.length > 0 ? (
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Recurring issue detection</p>
          {recurringIssues.slice(0, 8).map((item) => (
            <div key={item.key} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">
              {item.category.replaceAll("_", " ")} recurring {item.count}x {item.location ? `at ${item.location}` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductionWrap({ projectId, title }: { projectId?: string; title: string }) {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["project-production-wrap", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/production-wrap`);
      if (!res.ok) throw new Error("Failed to load wrap validation");
      return res.json();
    },
    enabled: hasProject,
    refetchOnWindowFocus: true,
  });

  const checklist = (data?.checklist ?? []) as Array<{ key: string; label: string; pass: boolean; detail: string; blocking: boolean }>;
  const summary = (data?.summary ?? {}) as {
    totalShootDays: number;
    totalSceneEntries: number;
    scenesCompleted: number;
    budgetPlanned: number;
    budgetActual: number;
    incidentCount: number;
    unresolvedHighCriticalIncidents: number;
    equipmentUnitsReturned: number;
    equipmentUnitsTotal: number;
    tasksCompleted: number;
    tasksTotal: number;
    contractsSigned: number;
    contractsTotal: number;
  };
  const canMoveToPost = Boolean(data?.canMoveToPost);
  const failures = (data?.failures ?? []) as Array<{ label: string; detail: string }>;

  const moveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/production-wrap`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstError = Array.isArray(json?.failures) && json.failures[0]?.detail ? json.failures[0].detail : "Wrap validation failed";
        throw new Error(firstError);
      }
      return json as { redirectUrl?: string };
    },
    onSuccess: async (payload) => {
      setToast("Production wrapped successfully. Redirecting to distribution draft...");
      await queryClient.invalidateQueries({ queryKey: ["project-production-wrap", projectId] });
      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
      } else {
        window.location.reload();
      }
    },
    onError: (e) => setToast((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Confirm principal photography complete and move to Post-Production.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get AI wrap report
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="production_wrap"
          reportTitle="Production wrap"
          prompt="Use the shoot days, incidents, tasks, and counts in your context. Generate a report on overall performance, document lessons learned, and ensure all final deliverables are accounted for before moving to post."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {toast ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">{toast}</div>
      ) : null}
      {!hasProject ? (
        <div className="creator-glass-panel p-4 text-sm text-slate-400">
          Link a project above to see wrap status and move to post-production.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Shoot days</p><p className="text-lg font-semibold text-white">{summary.totalShootDays ?? 0}</p></div>
            <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Scenes completed</p><p className="text-lg font-semibold text-white">{summary.scenesCompleted ?? 0} / {summary.totalSceneEntries ?? 0}</p></div>
            <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Budget vs actual</p><p className="text-lg font-semibold text-white">{formatZar(summary.budgetActual ?? 0, { maximumFractionDigits: 0 })} / {formatZar(summary.budgetPlanned ?? 0, { maximumFractionDigits: 0 })}</p></div>
            <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Incidents</p><p className="text-lg font-semibold text-white">{summary.incidentCount ?? 0} total</p></div>
            <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Equipment returned</p><p className="text-lg font-semibold text-white">{summary.equipmentUnitsReturned ?? 0} / {summary.equipmentUnitsTotal ?? 0}</p></div>
            <div className="creator-glass-panel p-3"><p className="text-[11px] text-slate-400">Tasks complete</p><p className="text-lg font-semibold text-white">{summary.tasksCompleted ?? 0} / {summary.tasksTotal ?? 0}</p></div>
          </div>

          <div className="creator-glass-panel p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Production completion checklist</p>
              <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-200" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? "Refreshing..." : "Re-run validation"}
              </Button>
            </div>
            {isLoading ? (
              <Skeleton className="h-32 bg-slate-800/60" />
            ) : (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.key} className={`rounded-lg border px-3 py-2 ${item.pass ? "border-emerald-500/40 bg-emerald-950/15" : "border-red-500/40 bg-red-950/20"}`}>
                    <p className="text-sm font-medium text-white">
                      {item.pass ? "PASS" : "FAIL"} · {item.label}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {failures.length > 0 ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2">Blocking wrap errors</p>
              {failures.map((f, idx) => (
                <p key={`${f.label}-${idx}`} className="text-xs text-red-100">
                  {f.label}: {f.detail}
                </p>
              ))}
            </div>
          ) : null}

          <div className="creator-glass-panel p-4">
            <p className="text-xs text-slate-400 mb-3">
              Move to Post will re-run validation, lock production logs for handoff, transition project stage, and auto-create a Distribution draft.
            </p>
            <Button
              className="adaptive-focus-target adaptive-interactive bg-orange-500 hover:bg-orange-600 text-white"
              disabled={!canMoveToPost || moveMutation.isPending}
              onClick={() => moveMutation.mutate()}
              aria-label="Move production to post-production"
            >
              {moveMutation.isPending ? "Moving to Post..." : "Move to Post"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
