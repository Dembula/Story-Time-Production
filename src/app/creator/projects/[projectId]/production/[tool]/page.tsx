"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { ProjectStageControls } from "../../project-stage-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useModocOptional, useModoc } from "@/components/modoc";
import { useProjectSchedule, useProjectCallSheets } from "@/hooks/useCreatorProjectData";

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

function getModocMessageContent(message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((p) => (p.type === "text" ? (p as { text?: string }).text ?? "" : ""))
      .join("");
  }
  return "";
}

const PRODUCTION_MODOC_TASKS = [
  "production_control_center",
  "call_sheet_generator",
  "on_set_tasks",
  "equipment_tracking",
  "shoot_progress",
  "continuity_manager",
  "dailies_review",
  "production_expense_tracker",
  "incident_reporting",
  "production_wrap",
] as const;

interface ProductionModocReportModalProps {
  task: (typeof PRODUCTION_MODOC_TASKS)[number];
  reportTitle: string;
  prompt: string;
  onClose: () => void;
  projectId?: string | null;
}

function ProductionModocReportModal({ task, reportTitle, prompt, onClose, projectId }: ProductionModocReportModalProps) {
  const { append, messages, status, setRequestContext } = useModoc();
  const appendedRef = useRef(false);

  const scope =
    task === "production_control_center"
      ? "control-center"
      : task === "call_sheet_generator"
        ? "call-sheet-generator"
        : task === "on_set_tasks"
          ? "on-set-tasks"
          : task === "equipment_tracking"
            ? "equipment-tracking"
            : task === "shoot_progress"
              ? "shoot-progress"
              : task === "continuity_manager"
                ? "continuity-manager"
                : task === "dailies_review"
                  ? "dailies-review"
                  : task === "production_expense_tracker"
                    ? "expense-tracker"
                    : task === "incident_reporting"
                      ? "incident-reporting"
                      : "wrap";

  useEffect(() => {
    setRequestContext({
      scope,
      clientContext: `Task: ${task}. ${prompt.slice(0, 200)}...`,
      pageContext: { task, ...(projectId && { projectId }) },
    });
  }, [scope, task, prompt, projectId, setRequestContext]);

  useEffect(() => {
    if (appendedRef.current) return;
    appendedRef.current = true;
    append({ role: "user", content: prompt });
  }, [prompt, append]);

  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  const displayContent = lastAssistant ? getModocMessageContent(lastAssistant) : "";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            {reportTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {status === "streaming" || status === "submitted" ? (
            displayContent ? displayContent : <span className="text-slate-400">MODOC is working…</span>
          ) : (
            displayContent || "Waiting for MODOC…"
          )}
        </div>
      </div>
    </>
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
        <CallSheetGenerator projectId={projectId} title={title} />
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
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const hasProject = !!projectId;
  const { data: schedule } = useProjectSchedule(projectId);
  const { data: tasksData } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/tasks`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: incidentsData } = useQuery({
    queryKey: ["project-incidents", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/incidents`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: riskData } = useQuery({
    queryKey: ["project-risk", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/risk`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: callSheetsData } = useProjectCallSheets(projectId);

  const shootDays = (schedule?.shootDays ?? []) as {
    id: string;
    date: string;
    status: string;
    locationSummary: string | null;
    callTime: string | null;
    wrapTime: string | null;
    scenes?: { scene?: { number: string; heading: string | null } }[];
  }[];
  const tasks = (tasksData?.tasks ?? []) as { id: string; title: string; status: string; priority?: string | null }[];
  const incidents = (incidentsData?.incidents ?? []) as {
    id: string;
    title: string;
    resolved: boolean;
    severity: string;
    createdAt?: string;
  }[];
  const riskItems = (riskData?.plan?.items ?? []) as { id: string; category: string; status: string }[];
  const callSheets = (callSheetsData?.callSheets ?? []) as { id: string; shootDayId: string; title: string | null }[];
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = shootDays.find((d) => d.date.startsWith(today));
  const openTasks = tasks.filter((t) => t.status !== "DONE");
  const openIncidents = incidents.filter((i) => !i.resolved);
  const highPriorityTasks = openTasks.filter((t) => t.priority === "HIGH").slice(0, 5);
  const openRiskItems = riskItems.filter((r) => r.status !== "DONE").length;
  const todaysCallSheet = todayDay ? callSheets.find((c) => c.shootDayId === todayDay.id) : undefined;

  const base = projectId ? `/creator/projects/${projectId}/production` : "#";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Your daily command centre: today’s shoot, tasks, incidents, and risk. Use the links below to jump into any production tool.
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
            Get MODOC production insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="production_control_center"
          reportTitle="MODOC production control insights"
          prompt="Use the schedule, tasks, incidents, and risk data in your context. Summarize workflow and progress, highlight what needs attention, and suggest how to keep the team aligned and on course."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      {/* Today strip */}
      <div className="creator-glass-panel p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-200">Today&apos;s shoot</span>
          <span className="text-slate-400">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        {todayDay ? (
          <div className="flex flex-wrap gap-3 text-xs md:text-sm text-slate-300">
            <span>Day: {todayDay.status}</span>
            {todayDay.callTime && <span>Call: {todayDay.callTime}</span>}
            {todayDay.wrapTime && <span>Wrap: {todayDay.wrapTime}</span>}
            {todayDay.locationSummary && <span>Locations: {todayDay.locationSummary}</span>}
            {todayDay.scenes?.length ? (
              <span>Scenes: {todayDay.scenes.map((s) => s.scene?.number).filter(Boolean).join(", ")}</span>
            ) : null}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No shoot scheduled for today.</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <Link
            href={todayDay ? `${base}/call-sheet-generator?dayId=${todayDay.id}` : `${base}/call-sheet-generator`}
            className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
          >
            {todayDay
              ? todaysCallSheet
                ? "Open today’s saved call sheet flow →"
                : "Build call sheet for today →"
              : "Open Call Sheet Generator →"}
          </Link>
          {projectId ? (
            <Link
              href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
            >
              Shoot schedule (pre-prod) →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {openTasks.length === 0 ? (
              <p className="text-slate-500">No open tasks.</p>
            ) : (
              <>
                {highPriorityTasks.length > 0 && (
                  <p className="text-[11px] text-amber-400/90 font-medium">High priority</p>
                )}
                {(highPriorityTasks.length ? highPriorityTasks : openTasks.slice(0, 5)).map((t) => (
                  <p key={t.id} className="text-slate-300 truncate">{t.title}</p>
                ))}
              </>
            )}
            <Link href={`${base}/on-set-tasks`} className="text-xs text-orange-400 hover:underline mt-2 inline-block">
              On-Set Task Management →
            </Link>
          </CardContent>
        </Card>

        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incidents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {openIncidents.length === 0 ? (
              <p className="text-slate-500">No open incidents.</p>
            ) : (
              <ul className="space-y-1">
                {openIncidents.slice(0, 4).map((i) => (
                  <li key={i.id} className="text-slate-300">
                    {i.title}{" "}
                    <span className={i.severity === "HIGH" ? "text-red-400" : i.severity === "MEDIUM" ? "text-amber-400" : "text-slate-500"}>
                      ({i.severity})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`${base}/incident-reporting`} className="text-xs text-orange-400 hover:underline mt-2 inline-block">
              Incident Reporting →
            </Link>
          </CardContent>
        </Card>

        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk & readiness</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {openRiskItems > 0 ? (
              <p className="text-amber-200/90">{openRiskItems} risk item{openRiskItems === 1 ? "" : "s"} still open.</p>
            ) : (
              <p className="text-slate-500">No open risk items.</p>
            )}
            <Link href={projectId ? `/creator/projects/${projectId}/pre-production/risk-insurance` : "#"} className="text-xs text-orange-400 hover:underline mt-2 inline-block">
              Risk & Insurance (pre-prod) →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="creator-glass-panel p-4">
        <p className="text-xs font-medium text-slate-400 mb-2">Production tools</p>
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

function CallSheetGenerator({ projectId, title }: { projectId?: string; title: string }) {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data: schedule } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: callSheetsData } = useQuery({
    queryKey: ["project-call-sheets", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/call-sheets`).then((r) => r.json()),
    enabled: hasProject,
  });

  const shootDays = (schedule?.shootDays ?? []) as {
    id: string;
    date: string;
    callTime: string | null;
    wrapTime: string | null;
    locationSummary: string | null;
    status?: string;
    scenes?: { scene?: { number: string; heading: string | null } }[];
  }[];
  const callSheets = (callSheetsData?.callSheets ?? []) as {
    id: string;
    shootDayId: string;
    title: string | null;
    notes: string | null;
    createdAt: string;
    shootDay?: { date: string };
  }[];
  const [selectedDayId, setSelectedDayId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [sheetTitle, setSheetTitle] = useState("");

  const selectedDay = shootDays.find((d) => d.id === selectedDayId);

  const appliedUrlDay = useRef(false);
  useEffect(() => {
    if (appliedUrlDay.current || shootDays.length === 0 || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("dayId");
    if (q && shootDays.some((d) => d.id === q)) {
      setSelectedDayId(q);
      const d = shootDays.find((x) => x.id === q);
      if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
      appliedUrlDay.current = true;
    }
  }, [shootDays]);

  const { data: previewPayload, isFetching: previewBusy } = useQuery({
    queryKey: ["call-sheet-preview", projectId, selectedDayId],
    queryFn: () =>
      fetch(
        `/api/creator/projects/${projectId}/call-sheets/preview?shootDayId=${encodeURIComponent(selectedDayId)}`,
      ).then((r) => {
        if (!r.ok) throw new Error("Preview failed");
        return r.json();
      }),
    enabled: hasProject && !!selectedDayId,
  });
  const preview = previewPayload?.preview as
    | {
        cast: { characterName: string; roleName: string; talentName: string | null }[];
        locations: { name: string; description: string | null }[];
        schedule: { order: number; sceneNumber: string; heading: string | null }[];
      }
    | undefined;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/call-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shootDayId: selectedDayId,
          title: sheetTitle.trim() || `Call sheet – ${selectedDay ? new Date(selectedDay.date).toLocaleDateString() : "Day"}`,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-call-sheets", projectId] });
      queryClient.invalidateQueries({ queryKey: ["call-sheet-preview", projectId] });
      setNotes("");
      setSheetTitle("");
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Generate call sheets from your production schedule. Pick a shoot day to auto-fill scenes, call/wrap times, and locations; add notes and generate.
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
            Get MODOC call sheet suggestions
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="call_sheet_generator"
          reportTitle="MODOC call sheet assistance"
          prompt="Use the production schedule and existing call sheets in your context. Suggest what to include on each call sheet, a completeness checklist (weather, parking, safety, etc.), and how to automate generation so every shoot day has all relevant details."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[1fr,280px]">
        <div className="space-y-4">
          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Shoot day</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={selectedDayId}
                onChange={(e) => {
                  setSelectedDayId(e.target.value);
                  const d = shootDays.find((x) => x.id === e.target.value);
                  if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
                }}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                <option value="">Select a day</option>
                {shootDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {new Date(d.date).toLocaleDateString()} {d.locationSummary ? `· ${d.locationSummary}` : ""} {d.status ? `· ${d.status}` : ""}
                  </option>
                ))}
              </select>

              {selectedDay && (
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 text-xs space-y-2">
                  <p className="text-slate-400 font-medium">Day summary</p>
                  <div className="flex flex-wrap gap-3 text-slate-300">
                    {selectedDay.callTime && <span>Call: {selectedDay.callTime}</span>}
                    {selectedDay.wrapTime && <span>Wrap: {selectedDay.wrapTime}</span>}
                    {selectedDay.locationSummary && <span>Locations: {selectedDay.locationSummary}</span>}
                  </div>
                  {selectedDay.scenes?.length ? (
                    <p className="text-slate-300">
                      Scenes: {selectedDay.scenes.map((s) => s.scene?.number).filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                </div>
              )}

              {selectedDayId && (
                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 space-y-2" aria-busy={previewBusy}>
                  <p className="text-[11px] font-medium text-slate-400">
                    Preview (from schedule, breakdown, casting)
                  </p>
                  {previewBusy ? (
                    <p className="text-xs text-slate-500">Loading preview…</p>
                  ) : preview ? (
                    <div className="space-y-3 max-h-[280px] overflow-y-auto text-[11px]">
                      <div>
                        <p className="text-slate-500 mb-1">Scenes</p>
                        <ul className="text-slate-300 space-y-0.5">
                          {preview.schedule?.length ? (
                            preview.schedule.map((row) => (
                              <li key={`${row.order}-${row.sceneNumber}`}>
                                Sc. {row.sceneNumber}
                                {row.heading ? ` — ${row.heading}` : ""}
                              </li>
                            ))
                          ) : (
                            <li className="text-slate-500">No scenes on this day.</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Cast ({preview.cast?.length ?? 0})</p>
                        <ul className="text-slate-300 space-y-0.5">
                          {(preview.cast ?? []).slice(0, 12).map((c, i) => (
                            <li key={i}>
                              {c.characterName}
                              {c.talentName ? ` · ${c.talentName}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Locations ({preview.locations?.length ?? 0})</p>
                        <ul className="text-slate-300 space-y-0.5">
                          {(preview.locations ?? []).slice(0, 8).map((loc, i) => (
                            <li key={i}>{loc.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Could not load preview.</p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Call sheet title (optional)</label>
                <Input
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  placeholder="e.g. Call sheet – 15 Mar 2025"
                  className="bg-slate-900 border-slate-700 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Notes (crew call, parking, safety, etc.)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes for the crew..."
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                disabled={!selectedDayId || createMutation.isPending || !hasProject}
                onClick={() => hasProject && selectedDayId && createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating..." : "Save call sheet snapshot"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Recent call sheets</p>
          {callSheets.length === 0 ? (
            <p className="text-sm text-slate-500 p-3 rounded-xl bg-slate-900/60">None yet. Generate one for a shoot day above.</p>
          ) : (
            <ul className="space-y-2">
              {callSheets.slice(0, 8).map((c) => (
                <li key={c.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm">
                  <p className="text-white font-medium truncate">{c.title || "Call sheet"}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.shootDay?.date ? new Date(c.shootDay.date).toLocaleDateString() : ""} · {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function OnSetTasks({ projectId, title }: { projectId?: string; title: string }) {
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
  const tasks = (data?.tasks ?? []) as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    department: string | null;
    priority: string | null;
    shootDay?: { id: string; date: string } | null;
    scene?: { id: string; number: string; heading: string | null } | null;
  }[];
  const shootDays = (scheduleData?.shootDays ?? []) as { id: string; date: string }[];
  const scenesList = (scenesData?.scenes ?? []) as { id: string; number: string; heading: string | null }[];
  const [newTitle, setNewTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newPriority, setNewPriority] = useState<string>("MEDIUM");
  const [newShootDayId, setNewShootDayId] = useState<string>("");
  const [newSceneId, setNewSceneId] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterShootDayId, setFilterShootDayId] = useState<string>("");

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

  return (
    <div className="space-y-4">
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
            Get MODOC on-set task insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="on_set_tasks"
          reportTitle="MODOC on-set task management"
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

      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
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
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-equipment-plan", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/equipment-plan`).then((r) => r.json()),
    enabled: hasProject,
  });
  const items = (data?.items ?? []) as {
    id: string;
    category: string;
    quantity: number;
    department: string | null;
    description: string | null;
    notes: string | null;
  }[];
  const byDepartment = items.reduce((acc, i) => {
    const key = i.department || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(i);
    return acc;
  }, {} as Record<string, typeof items>);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            See what was planned for this project and track gear on set. Planned items come from Pre-Production Equipment Planning; use the Equipment marketplace to request and track actual check-out/return.
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
            Get MODOC equipment tracking insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="equipment_tracking"
          reportTitle="MODOC equipment tracking"
          prompt="Use the planned equipment and shoot days in your context. Suggest how to track usage and availability, manage resources (sign-out, return-by-wrap, damage reporting), and flag any missing gear or quantities needed for upcoming shoot days."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      {hasProject && items.length > 0 && (
        <div className="creator-glass-panel p-3 flex flex-wrap gap-4 text-sm">
          <span className="text-slate-300"><span className="font-medium text-white">{items.length}</span> line items</span>
          <span className="text-slate-300"><span className="font-medium text-white">{totalItems}</span> total units</span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="creator-glass-panel p-6 text-center">
              <p className="text-sm text-slate-500 mb-2">
                {!hasProject ? "Link a project above to see equipment." : "No equipment planned yet."}
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
                    <li key={i.id} className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm">
                      <div>
                        <span className="text-white">{i.category}</span>
                        {i.description && <p className="text-[11px] text-slate-500 mt-0.5">{i.description}</p>}
                      </div>
                      <span className="text-slate-400">Qty: {i.quantity}</span>
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
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const hasProject = !!projectId;
  const { data: schedule } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });
  const shootDays = (schedule?.shootDays ?? []) as { id: string; date: string; status: string }[];
  const scenes = (schedule?.scenes ?? []) as { id: string; number: string; heading: string | null; status?: string }[];
  const completed = shootDays.filter((d) => d.status === "WRAPPED" || d.status === "COMPLETED").length;
  const total = shootDays.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const sceneCount = scenes.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Shoot days and scene progress.
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
            Get MODOC shoot progress insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="shoot_progress"
          reportTitle="MODOC shoot progress"
          prompt="Use the shoot days and scene data in your context. Monitor progress against the schedule, highlight any delays, and suggest adjustments so we stay on track."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-slate-300">
          <span>Shoot days</span>
          <span>{completed} / {total} ({percent}%)</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="creator-glass-panel p-3">
        <p className="text-xs text-slate-400 mb-2">Scenes: {sceneCount}</p>
        <ul className="space-y-1 text-sm text-slate-300">
          {scenes.slice(0, 15).map((s) => (
            <li key={s.id}>Scene {s.number} · {s.heading || "—"}</li>
          ))}
          {scenes.length > 15 && <li className="text-slate-500">+{scenes.length - 15} more</li>}
        </ul>
      </div>
    </div>
  );
}

function ContinuityManager({ projectId, title }: { projectId?: string; title: string }) {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-continuity", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/continuity`).then((r) => r.json()),
    enabled: hasProject,
  });
  const notes = (data?.notes ?? []) as { id: string; body: string; sceneId: string | null; shootDayId: string | null; createdAt: string }[];
  const [body, setBody] = useState("");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/continuity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-continuity", projectId] });
      setBody("");
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Continuity notes by scene and shoot day.
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
            Get MODOC continuity insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="continuity_manager"
          reportTitle="MODOC continuity manager"
          prompt="Use the continuity notes and breakdown (props, wardrobes, locations) in your context. Suggest how to track costumes, props, and locations for consistency and recommend checklists to maintain continuity."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="New continuity note..."
          rows={2}
          className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
        />
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 self-end"
          disabled={!body.trim() || createMutation.isPending || !hasProject}
          onClick={() => hasProject && createMutation.mutate()}
        >
          Add
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">
              {!hasProject ? "Link a project above to add continuity notes." : "No continuity notes yet."}
            </p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm text-slate-300">
                {n.body}
                <p className="text-xs text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
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
            Get MODOC dailies review insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="dailies_review"
          reportTitle="MODOC dailies review"
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
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data: expensesData } = useQuery({
    queryKey: ["project-expenses", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/expenses`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: budgetData } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/budget`).then((r) => r.json()),
    enabled: hasProject,
  });
  const expenses = (expensesData?.expenses ?? []) as { id: string; description: string | null; amount: number; department: string | null; spentAt: string }[];
  const budget = budgetData?.budget as { totalPlanned?: number } | null;
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const planned = budget?.totalPlanned ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Track expenses against your budget.
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
            Get MODOC expense insights
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="production_expense_tracker"
          reportTitle="MODOC production expense tracker"
          prompt="Use the expenses and budget data in your context. Help categorize costs, summarize spending by department, and offer insights on budget adherence throughout production."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {hasProject && projectId && (
        <div className="flex flex-wrap gap-3 text-xs">
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
        </div>
      )}
      <div className="flex gap-4 text-sm">
        <span className="text-slate-400">Planned: R{planned.toFixed(2)}</span>
        <span className="text-white font-medium">Spent: R{totalSpent.toFixed(2)}</span>
        {planned > 0 && (
          <span className={totalSpent > planned ? "text-red-400" : "text-slate-400"}>
            {Math.round((totalSpent / planned) * 100)}%
          </span>
        )}
      </div>
      <div className="creator-glass-panel p-3 space-y-2 max-h-80 overflow-y-auto">
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No expenses logged yet.</p>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-900/80 px-3 py-2 text-sm">
              <span className="text-slate-300">{e.description || e.department || "Expense"}</span>
              <span className="text-white">R{e.amount.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-slate-500">Add expenses via API or a dedicated form; link to budget lines for variance.</p>
    </div>
  );
}

function IncidentReporting({ projectId, title }: { projectId?: string; title: string }) {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-incidents", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/incidents`).then((r) => r.json()),
    enabled: hasProject,
  });
  const incidents = (data?.incidents ?? []) as { id: string; title: string; description: string; severity: string; resolved: boolean; createdAt: string }[];
  const [titleVal, setTitleVal] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState("LOW");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleVal, description: desc, severity }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-incidents", projectId] });
      setTitleVal("");
      setDesc("");
    },
  });
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/incidents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-incidents", projectId] }),
  });

  return (
    <div className="space-y-4">
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
            Get MODOC incident analysis
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="incident_reporting"
          reportTitle="MODOC incident reporting"
          prompt="Use the incidents and schedule in your context. Provide templates and analysis tools to understand the impact of incidents on production schedules and budgets."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">New incident</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            placeholder="Title"
            className="bg-slate-900 border-slate-700 text-sm"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            disabled={!titleVal.trim() || !desc.trim() || createMutation.isPending || !hasProject}
            onClick={() => hasProject && createMutation.mutate()}
          >
            Report
          </Button>
        </CardContent>
      </Card>
      <div className="creator-glass-panel p-3 space-y-2">
        {isLoading ? (
          <Skeleton className="h-32 bg-slate-800/60" />
        ) : incidents.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">
            {!hasProject ? "Link a project above to report incidents." : "No incidents reported."}
          </p>
        ) : (
          incidents.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-white">{i.title}</p>
                <p className="text-xs text-slate-400">{i.severity} · {new Date(i.createdAt).toLocaleString()}</p>
              </div>
              {!i.resolved && (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => resolveMutation.mutate(i.id)}>
                  Resolve
                </Button>
              )}
              {i.resolved && <span className="text-xs text-emerald-400">Resolved</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProductionWrap({ projectId, title }: { projectId?: string; title: string }) {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const hasProject = !!projectId;
  const { data: schedule } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: incidentsData } = useQuery({
    queryKey: ["project-incidents", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/incidents`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: tasksData } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/tasks`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: dailiesData } = useQuery({
    queryKey: ["project-dailies", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/dailies`).then((r) => r.json()),
    enabled: hasProject,
  });
  const shootDays = (schedule?.shootDays ?? []) as { status: string }[];
  const incidents = (incidentsData?.incidents ?? []) as { resolved: boolean }[];
  const tasks = (tasksData?.tasks ?? []) as { status: string }[];
  const batches = (dailiesData?.batches ?? []) as { reviewNotes?: unknown[] }[];
  const completedDays = shootDays.filter((d) => d.status === "WRAPPED" || d.status === "COMPLETED").length;
  const openIncidents = incidents.filter((i) => !i.resolved).length;
  const openTasksCount = tasks.filter((t) => t.status !== "DONE").length;
  const dailiesPendingReview = batches.filter((b) => !b.reviewNotes || b.reviewNotes.length === 0).length;

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
            Get MODOC wrap report
          </Button>
        )}
      </header>
      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="production_wrap"
          reportTitle="MODOC production wrap"
          prompt="Use the shoot days, incidents, tasks, and counts in your context. Generate a report on overall performance, document lessons learned, and ensure all final deliverables are accounted for before moving to post."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {!hasProject ? (
        <div className="creator-glass-panel p-4 text-sm text-slate-400">
          Link a project above to see wrap status and move to post-production.
        </div>
      ) : (
        <>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Shoot days completed: {completedDays} / {shootDays.length}</li>
            <li>• Open incidents: {openIncidents}</li>
            <li>• Open on-set tasks: {openTasksCount}</li>
            <li>• Dailies batches without review notes: {dailiesPendingReview}</li>
            <li>• Equipment returned or logged</li>
            <li>• Dailies reviewed and backed up</li>
          </ul>
          <div className="creator-glass-panel p-4">
            <ProjectStageControls projectId={projectId!} status="PRODUCTION" phase="SHOOTING" />
          </div>
        </>
      )}
    </div>
  );
}
