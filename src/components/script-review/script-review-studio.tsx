"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  MessageSquare,
  Sparkles,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { creatorToolSelect, creatorToolSelectSm } from "@/lib/ui/creator-tool-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ToolSavedViewSheet,
  ToolViewButton,
  ScriptReviewsViewer,
} from "@/components/project-tools";
import { formatZar } from "@/lib/format-currency-zar";
import { EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR } from "@/lib/pricing";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import {
  REVIEW_LAYERS,
  REVIEW_STATUSES,
  paginateScreenplay,
  type ReviewAnnotationRecord,
  type ReviewLayerId,
  type ReviewStamp,
  type ReviewTool,
} from "@/lib/script-review/types";
import { REVIEW_STAMPS } from "@/lib/script-review/stamps";
import { exportAnnotatedReviewPdf } from "@/lib/script-review/export-annotated-review";
import type { ReviewPermissions } from "@/lib/script-review/permissions";
import type { ReviewPeer } from "@/lib/script-review/collaboration-room";
import { ReviewPageCanvas } from "./review-page-canvas";
import { ReviewThreadsPanel } from "./review-threads-panel";

function openCreatorVa(prompt: string) {
  window.dispatchEvent(new CustomEvent("modoc:open-creator", { detail: { prompt } }));
}

export interface ScriptReviewStudioProps {
  projectId?: string;
  title: string;
}

type DraftOption = {
  id: string;
  label: string;
  content: string;
  scriptVersionId: string | null;
  creatorScriptId: string | null;
};

export function ScriptReviewStudio({ projectId, title }: ScriptReviewStudioProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const executiveRequestId = searchParams.get("executiveRequestId") ?? "";
  const draftFromUrl = searchParams.get("draft") ?? "";

  const [workingProjectId, setWorkingProjectId] = useState(projectId ?? "");
  const [selectedDraftId, setSelectedDraftId] = useState(draftFromUrl);
  const [payDraftId, setPayDraftId] = useState("");
  const [tool, setTool] = useState<ReviewTool>("red_pen");
  const [selectedStamp, setSelectedStamp] = useState<ReviewStamp>("approved");
  const [activeLayer, setActiveLayer] = useState<ReviewLayerId>("producer");
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    () => new Set(REVIEW_LAYERS.map((l) => l.id)),
  );
  const [rightTab, setRightTab] = useState<"layers" | "threads" | "dashboard" | "coverage">(
    "layers",
  );
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [spread, setSpread] = useState(false);
  const [darkRead, setDarkRead] = useState(false);
  const [compareDraftId, setCompareDraftId] = useState<string | null>(null);
  const [reviewsViewOpen, setReviewsViewOpen] = useState(false);
  const [reviewsViewTab, setReviewsViewTab] = useState("executive");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentName, setPaymentName] = useState("");
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [coverageDraft, setCoverageDraft] = useState("");
  const [reviewPeers, setReviewPeers] = useState<ReviewPeer[]>([]);
  const [permissions, setPermissions] = useState<ReviewPermissions | null>(null);

  useEffect(() => {
    setWorkingProjectId(projectId ?? "");
  }, [projectId]);

  const hasProject = !!workingProjectId;

  const { data: projectsData } = useQuery({
    queryKey: ["creator-projects", "script-review-studio"],
    queryFn: projectToolQueryFn("/api/creator/projects"),
  });
  const creatorProjects = useMemo(
    () => ((projectsData?.projects ?? []) as Array<{ id: string; title: string }>),
    [projectsData?.projects],
  );

  useEffect(() => {
    if (!workingProjectId && creatorProjects.length > 0) {
      setWorkingProjectId(creatorProjects[0].id);
    }
  }, [workingProjectId, creatorProjects]);

  const { data: scriptData } = useQuery({
    enabled: hasProject,
    queryKey: ["project-script-review-studio", workingProjectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${workingProjectId}/script`),
  });

  const scriptTitle = (scriptData?.script?.title as string | undefined) ?? "Project script";
  const scriptVersions = useMemo(
    () =>
      ((scriptData?.script?.versions as Array<{
        id: string;
        versionLabel: string | null;
        content: string;
        createdAt: string;
      }> | undefined) ?? []),
    [scriptData?.script?.versions],
  );

  const { data: creatorScriptsData } = useQuery({
    enabled: hasProject,
    queryKey: ["creator-scripts", "script-review-studio", workingProjectId],
    queryFn: projectToolQueryFn(`/api/creator/scripts?projectId=${workingProjectId}`),
  });

  const draftOptions: DraftOption[] = useMemo(
    () => [
      ...scriptVersions.map((v) => ({
        id: `project-version:${v.id}`,
        label: `${scriptTitle} · ${v.versionLabel || "Project draft"} · ${new Date(v.createdAt).toLocaleDateString()}`,
        content: v.content ?? "",
        scriptVersionId: v.id,
        creatorScriptId: null,
      })),
      ...((creatorScriptsData?.scripts as Array<{ id: string; title: string; content: string; updatedAt: string }>) ?? []).map(
        (s) => ({
          id: `creator-script:${s.id}`,
          label: `${s.title} · Library · ${new Date(s.updatedAt).toLocaleDateString()}`,
          content: s.content ?? "",
          scriptVersionId: null,
          creatorScriptId: s.id,
        }),
      ),
    ],
    [scriptVersions, scriptTitle, creatorScriptsData?.scripts],
  );

  useEffect(() => {
    if (draftFromUrl && draftOptions.some((d) => d.id === draftFromUrl)) {
      setSelectedDraftId(draftFromUrl);
    } else if (draftOptions.length === 0) {
      setSelectedDraftId("");
    } else if (!selectedDraftId || !draftOptions.some((d) => d.id === selectedDraftId)) {
      setSelectedDraftId(draftOptions[0].id);
    }
    if (!payDraftId && draftOptions[0]) setPayDraftId(draftOptions[0].id);
  }, [draftOptions, draftFromUrl, selectedDraftId, payDraftId]);

  const selectedDraft = draftOptions.find((d) => d.id === selectedDraftId) ?? draftOptions[0];
  const payDraft = draftOptions.find((d) => d.id === payDraftId) ?? draftOptions[0];
  const compareDraft = compareDraftId
    ? draftOptions.find((d) => d.id === compareDraftId)
    : null;

  const sessionQueryKey = ["script-review-session", workingProjectId, selectedDraft?.id, executiveRequestId];
  const { data: sessionData, refetch: refetchSession } = useQuery({
    enabled: hasProject && !!selectedDraft?.id,
    queryKey: sessionQueryKey,
    queryFn: () => {
      const params = new URLSearchParams({ draftKey: selectedDraft!.id });
      if (executiveRequestId) params.set("executiveRequestId", executiveRequestId);
      return fetch(
        `/api/creator/projects/${workingProjectId}/script-review/session?${params}`,
      ).then((r) => r.json());
    },
  });

  useEffect(() => {
    if (sessionData?.permissions) setPermissions(sessionData.permissions as ReviewPermissions);
  }, [sessionData?.permissions]);

  const session = sessionData?.session as
    | {
        id: string;
        reviewStatus: string;
        coverageReport: string | null;
        annotations: ReviewAnnotationRecord[];
      }
    | undefined;

  const canAnnotate = permissions?.canAnnotate ?? true;
  const canReply = permissions?.canReply ?? true;
  const canExport = permissions?.canExport ?? true;
  const canEditStatus = permissions?.canEditStatus ?? true;
  const allowedLayers = permissions?.allowedLayers ?? REVIEW_LAYERS.map((l) => l.id);

  useEffect(() => {
    if (allowedLayers.length && !allowedLayers.includes(activeLayer)) {
      setActiveLayer(allowedLayers[0] as ReviewLayerId);
    }
  }, [allowedLayers, activeLayer]);

  const annotations = session?.annotations ?? [];

  const postCollaboration = useCallback(
    (cursor?: { x: number; y: number; lineIndex: number }) => {
      if (!session?.id || !hasProject) return;
      void fetch(`/api/creator/projects/${workingProjectId}/script-review/collaboration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          pageIndex: page,
          lineIndex: cursor?.lineIndex ?? null,
          cursorX: cursor?.x ?? null,
          cursorY: cursor?.y ?? null,
          isDrawing: tool !== "comment" && tool !== "stamp",
          tool,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.peers) setReviewPeers(d.peers);
        });
    },
    [session?.id, workingProjectId, hasProject, page, tool],
  );

  const pages = useMemo(
    () => paginateScreenplay(selectedDraft?.content ?? ""),
    [selectedDraft?.content],
  );

  useEffect(() => {
    setCoverageDraft(session?.coverageReport ?? "");
  }, [session?.coverageReport]);

  const { data: reviewMeta } = useQuery({
    enabled: hasProject,
    queryKey: ["script-review", workingProjectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${workingProjectId}/script-review`),
  });

  const executiveRequests =
    ((reviewMeta?.requests as Array<{
      id: string;
      status: string;
      feeAmount: number;
      submittedAt: string;
      reviewedAt: string | null;
      feedbackUrl: string | null;
      feedbackNotes: string | null;
      scriptVersion?: { script: { title: string }; versionLabel: string | null } | null;
    }>) ?? []);

  const hasOpenExecutiveRequest = executiveRequests.some((r) =>
    ["AWAITING_PAYMENT", "PENDING_ADMIN_REVIEW", "IN_REVIEW"].includes(r.status),
  );

  const createAnnotation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(
        `/api/creator/projects/${workingProjectId}/script-review/annotations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session?.id, layer: activeLayer, ...payload }),
        },
      );
      if (!res.ok) throw new Error("Failed to save annotation");
      return res.json();
    },
    onSuccess: () => {
      void refetchSession();
    },
  });

  const updateSession = useMutation({
    mutationFn: async (payload: { reviewStatus?: string; coverageReport?: string }) => {
      const res = await fetch(`/api/creator/projects/${workingProjectId}/script-review/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session?.id, ...payload }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => void refetchSession(),
  });

  const requestExecutive = useMutation({
    mutationFn: async (scriptVersionId: string) => {
      const res = await fetch(`/api/creator/projects/${workingProjectId}/script-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptVersionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) window.location.href = data.checkoutUrl as string;
      void queryClient.invalidateQueries({ queryKey: ["script-review", workingProjectId] });
    },
  });

  useEffect(() => {
    if (!session?.id || !hasProject) return;
    postCollaboration();
    const id = window.setInterval(() => postCollaboration(), 2500);
    return () => window.clearInterval(id);
  }, [session?.id, hasProject, postCollaboration]);

  const updateProjectRoute = (nextProjectId: string) => {
    if (!nextProjectId) return;
    if (pathname.startsWith("/creator/projects/") && projectId) {
      router.push(pathname.replace(`/creator/projects/${projectId}`, `/creator/projects/${nextProjectId}`));
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("projectId", nextProjectId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const threadComments = annotations.filter(
    (a) => (a.type === "comment" || a.type === "margin" || (a.body && a.type !== "stamp")) && !a.parentId,
  );

  const activeExecutiveRequest = executiveRequestId
    ? executiveRequests.find((r) => r.id === executiveRequestId)
    : executiveRequests.find((r) => r.status === "COMPLETED" && r.feedbackUrl);

  const stats = useMemo(() => {
    const open = annotations.filter((a) => !a.resolved).length;
    const resolved = annotations.filter((a) => a.resolved).length;
    return {
      total: annotations.length,
      open,
      resolved,
      pct: annotations.length ? Math.round((resolved / annotations.length) * 100) : 0,
    };
  }, [annotations]);

  const handleExecutivePay = async () => {
    if (!payDraft) return;
    setProcessingPayment(true);
    setPaymentMessage(null);
    try {
      let scriptVersionId = payDraft.scriptVersionId;
      if (!scriptVersionId && payDraft.creatorScriptId) {
        const publishRes = await fetch(
          `/api/creator/projects/${workingProjectId}/script/publish-from-creator-script`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorScriptId: payDraft.creatorScriptId }),
          },
        );
        if (!publishRes.ok) throw new Error("Failed to link script to project");
        const ps = await fetch(`/api/creator/projects/${workingProjectId}/script`).then((r) =>
          r.json(),
        );
        scriptVersionId = ps?.script?.versions?.[0]?.id ?? null;
      }
      if (!scriptVersionId) throw new Error("No script version for submission");
      const result = await requestExecutive.mutateAsync(scriptVersionId);
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl as string;
        return;
      }
      setPaymentOpen(false);
    } catch (e) {
      setPaymentMessage((e as Error).message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const toolbarTools: Array<{ id: ReviewTool; label: string }> = [
    { id: "red_pen", label: "Red pen" },
    { id: "blue_pen", label: "Blue" },
    { id: "black_pen", label: "Black" },
    { id: "green_pen", label: "Green" },
    { id: "highlighter", label: "Highlight" },
    { id: "free_draw", label: "Draw" },
    { id: "line", label: "Line" },
    { id: "arrow", label: "Arrow" },
    { id: "rectangle", label: "Rect" },
    { id: "circle", label: "Circle" },
    { id: "text", label: "Text" },
    { id: "sticky", label: "Sticky" },
    { id: "comment", label: "Comment" },
    { id: "stamp", label: "Stamp" },
  ];

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Script Review Studio
            </p>
            <h2 className="font-display text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Professional screenplay markup — read-only script with red-pen annotations, layers,
              live collaboration, and coverage. Executive reviews remain a separate paid Story Time
              service.
            </p>
          </div>
          <ToolViewButton
            onClick={() => setReviewsViewOpen(true)}
            count={executiveRequests.length}
            label="Executive history"
          />
        </div>
      </header>

      {activeExecutiveRequest?.status === "COMPLETED" &&
      (activeExecutiveRequest.feedbackUrl || activeExecutiveRequest.feedbackNotes) ? (
        <div className="storytime-plan-card border border-emerald-500/30 p-4 text-sm text-emerald-100">
          <p className="font-medium text-emerald-300">Executive review delivered</p>
          {activeExecutiveRequest.feedbackNotes ? (
            <p className="mt-2 whitespace-pre-wrap text-slate-200">{activeExecutiveRequest.feedbackNotes}</p>
          ) : null}
          {activeExecutiveRequest.feedbackUrl ? (
            <a
              href={activeExecutiveRequest.feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-orange-300 underline"
            >
              Download executive feedback PDF
            </a>
          ) : null}
        </div>
      ) : null}

      {executiveRequestId && activeExecutiveRequest?.status === "NEEDS_REVISION" ? (
        <div className="storytime-plan-card border border-amber-500/30 p-4 text-sm text-amber-100">
          Story Time requested revisions on this script. Update your draft, then submit a new executive
          review when ready.
        </div>
      ) : null}

      <section className="storytime-section grid gap-3 p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] uppercase text-slate-500">Project</label>
          <select
            value={workingProjectId}
            onChange={(e) => {
              setWorkingProjectId(e.target.value);
              updateProjectRoute(e.target.value);
            }}
            className={creatorToolSelect("w-full")}
          >
            {creatorProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase text-slate-500">Draft (read-only)</label>
          <select
            value={selectedDraftId}
            onChange={(e) => {
              setSelectedDraftId(e.target.value);
              setPage(0);
            }}
            disabled={draftOptions.length === 0}
            className={creatorToolSelect("w-full disabled:opacity-60")}
          >
            {draftOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!hasProject || !selectedDraft ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Select a project and screenplay draft to open the review workspace.
        </div>
      ) : (
        <>
          {reviewPeers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px]">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Live reviewers:</span>
              {reviewPeers.map((p) => (
                <span key={p.userId} className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${p.color}22`, color: p.color }}>
                  {p.displayName}
                  {p.isDrawing ? " · marking up" : ""}
                </span>
              ))}
            </div>
          ) : null}

          {permissions ? (
            <p className="mb-2 text-[10px] text-slate-500">
              Role: <span className="text-slate-300">{permissions.mode.replace(/_/g, " ")}</span>
              {!canAnnotate ? " · read-only" : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 px-2 py-2">
            {toolbarTools.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                className={`rounded px-2 py-1 text-[10px] ${
                  tool === t.id ? "bg-orange-500/20 text-orange-300" : "text-slate-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
            {tool === "stamp" ? (
              <select
                value={selectedStamp}
                onChange={(e) => setSelectedStamp(e.target.value as ReviewStamp)}
                className={creatorToolSelectSm("text-[10px]")}
              >
                {REVIEW_STAMPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={activeLayer}
              onChange={(e) => setActiveLayer(e.target.value as ReviewLayerId)}
              className={creatorToolSelectSm("ml-auto text-[10px]")}
            >
              {REVIEW_LAYERS.filter((l) => allowedLayers.includes(l.id)).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <select
              value={session?.reviewStatus ?? "IN_REVIEW"}
              onChange={(e) => updateSession.mutate({ reviewStatus: e.target.value })}
              disabled={!canEditStatus}
              className={creatorToolSelectSm("text-[10px] disabled:opacity-50")}
            >
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" className="h-7 text-slate-300" onClick={() => setZoom((z) => Math.max(70, z - 10))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] text-slate-500">{zoom}%</span>
            <Button size="sm" variant="ghost" className="h-7 text-slate-300" onClick={() => setZoom((z) => Math.min(140, z + 10))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-slate-300" onClick={() => setSpread((s) => !s)}>
              {spread ? "Single" : "Spread"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-slate-300"
              onClick={() => setDarkRead((d) => !d)}
            >
              {darkRead ? "Light" : "Dark"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] text-slate-300"
              disabled={!canExport}
              onClick={() =>
                exportAnnotatedReviewPdf({
                  title: scriptTitle,
                  pages,
                  annotations,
                  coverageReport: session?.coverageReport,
                })
              }
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export PDF
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <div
              className={`rounded-xl border border-slate-800 p-4 overflow-y-auto max-h-[calc(100vh-14rem)] ${darkRead ? "bg-slate-950" : "bg-slate-200"}`}
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              {compareDraft ? (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <p className="col-span-2 text-xs text-slate-600">Compare: current vs {compareDraft.label}</p>
                  {paginateScreenplay(compareDraft.content).slice(page, page + 1).map((lines, i) => (
                    <div key={i} className="opacity-80 text-[10px] font-mono whitespace-pre-wrap bg-white p-4 border">
                      {lines.join("\n")}
                    </div>
                  ))}
                </div>
              ) : null}

              {(spread && page + 1 < pages.length
                ? [page, page + 1]
                : [page]
              ).map((pageIndex) => (
                <ReviewPageCanvas
                  key={pageIndex}
                  pageIndex={pageIndex}
                  lines={pages[pageIndex] ?? []}
                  globalLineOffset={pageIndex * 55}
                  annotations={annotations}
                  visibleLayers={visibleLayers}
                  tool={tool}
                  selectedStamp={selectedStamp}
                  layer={activeLayer}
                  canAnnotate={canAnnotate}
                  peers={reviewPeers}
                  onCreateAnnotation={(p) => createAnnotation.mutate(p)}
                  onAddComment={(lineIndex, text, data) =>
                    createAnnotation.mutate({
                      type: "comment",
                      lineIndex,
                      body: text,
                      data: data ?? {},
                    })
                  }
                  onCursorMove={(pt, lineIndex) => postCollaboration({ x: pt[0], y: pt[1], lineIndex })}
                />
              ))}

              <div className="flex items-center justify-center gap-3 py-4 sticky bottom-0 bg-slate-900/90 rounded-lg mt-2">
                <Button size="sm" variant="ghost" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-300">
                  Page {page + 1} / {pages.length}
                </span>
                <Button size="sm" variant="ghost" disabled={page >= pages.length - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <aside className="creator-glass-panel flex flex-col overflow-hidden max-h-[calc(100vh-14rem)]">
              <div className="flex border-b border-slate-800 text-[9px]">
                {(
                  [
                    ["layers", "Layers", Layers],
                    ["threads", "Threads", MessageSquare],
                    ["dashboard", "Stats", Sparkles],
                    ["coverage", "Coverage", Download],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRightTab(id)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${
                      rightTab === id ? "bg-slate-800 text-orange-300" : "text-slate-400"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3 text-[11px] space-y-3">
                {rightTab === "layers" && (
                  <div className="space-y-2">
                    {REVIEW_LAYERS.filter((l) => allowedLayers.includes(l.id)).map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-slate-300">
                        <input
                          type="checkbox"
                          checked={visibleLayers.has(l.id)}
                          onChange={() => {
                            setVisibleLayers((prev) => {
                              const next = new Set(prev);
                              if (next.has(l.id)) next.delete(l.id);
                              else next.add(l.id);
                              return next;
                            });
                          }}
                        />
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.label}
                      </label>
                    ))}
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-slate-500 mb-1">Compare draft</p>
                      <select
                        value={compareDraftId ?? ""}
                        onChange={(e) => setCompareDraftId(e.target.value || null)}
                        className={creatorToolSelectSm("w-full")}
                      >
                        <option value="">Off</option>
                        {draftOptions.filter((d) => d.id !== selectedDraftId).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {rightTab === "threads" && (
                  <ReviewThreadsPanel
                    threads={threadComments}
                    canReply={canReply}
                    onResolve={(id) =>
                      fetch(`/api/creator/projects/${workingProjectId}/script-review/annotations`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, resolved: true }),
                      }).then(() => refetchSession())
                    }
                    onReply={(parentId, body) =>
                      createAnnotation.mutate({
                        type: "comment",
                        parentId,
                        body,
                        data: {},
                      })
                    }
                    onJumpToLine={(lineIndex) => setPage(Math.floor(lineIndex / 55))}
                  />
                )}
                {rightTab === "dashboard" && (
                  <div className="space-y-2 text-slate-400">
                    <p>Total marks: <span className="text-white">{stats.total}</span></p>
                    <p>Open: <span className="text-amber-300">{stats.open}</span></p>
                    <p>Resolved: <span className="text-green-400">{stats.resolved}</span></p>
                    <p>Completion: <span className="text-white">{stats.pct}%</span></p>
                    <p className="pt-2 text-slate-500">Live reviewers: {reviewPeers.length + 1}</p>
                  </div>
                )}
                {rightTab === "coverage" && (
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      className="w-full bg-orange-500 text-[10px] text-white"
                      onClick={() =>
                        openCreatorVa(
                          `Generate professional script coverage for this screenplay. Sections: Logline, Synopsis, Strengths, Weaknesses, Commercial Potential, Dialogue/Character/Story/Structure scores, Overall Recommendation. Do not alter the script — output coverage only.`,
                        )
                      }
                    >
                      AI coverage report
                    </Button>
                    <textarea
                      rows={12}
                      value={coverageDraft}
                      onChange={(e) => setCoverageDraft(e.target.value)}
                      placeholder="Coverage notes…"
                      className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-white text-[11px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-slate-600 text-[10px] text-slate-100"
                      onClick={() => updateSession.mutate({ coverageReport: coverageDraft })}
                    >
                      Save coverage
                    </Button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      <Card className="creator-glass-panel border border-orange-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Story Time Executive Script Review (paid)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-300">
          <p>
            Submit to Story Time&apos;s <strong>admin executive review queue</strong> for professional
            feedback — separate from your internal markup above. Paid reviews arrive at the admin portal
            and return here when complete.
          </p>
          <p className="text-orange-300 font-medium">
            {formatZar(EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR)} per submission
          </p>
          <select
            value={payDraftId}
            onChange={(e) => setPayDraftId(e.target.value)}
            className={creatorToolSelect("w-full max-w-md text-xs")}
          >
            {draftOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <Button
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={hasOpenExecutiveRequest || !payDraft || processingPayment}
            onClick={() => setPaymentOpen(true)}
          >
            Pay &amp; submit for executive review
          </Button>
          {hasOpenExecutiveRequest && (
            <p className="text-amber-300">You have an open executive review for this project.</p>
          )}
          {paymentMessage && <p className="text-red-400">{paymentMessage}</p>}
          {paymentOpen && (
            <div className="rounded-xl border border-orange-400/30 bg-slate-950 p-4 space-y-2">
              <Input value={paymentName} onChange={(e) => setPaymentName(e.target.value)} placeholder="Card holder" />
              <Input type="email" value={paymentEmail} onChange={(e) => setPaymentEmail(e.target.value)} placeholder="Billing email" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                <Button size="sm" className="bg-orange-500 text-white" disabled={processingPayment} onClick={handleExecutivePay}>
                  Confirm payment
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ToolSavedViewSheet
        open={reviewsViewOpen}
        onClose={() => setReviewsViewOpen(false)}
        title="Executive review history"
        subtitle="Paid Story Time executive feedback (admin fulfilled)"
        tabs={[{ id: "executive", label: "Executive", badge: executiveRequests.length }]}
        activeTab={reviewsViewTab}
        onTabChange={setReviewsViewTab}
      >
        <ScriptReviewsViewer
          internalReviews={[]}
          executiveReviews={executiveRequests.map((r) => ({
            id: r.id,
            status: r.status,
            feeAmount: r.feeAmount,
            submittedAt: r.submittedAt,
            reviewedAt: r.reviewedAt,
            feedbackNotes: r.feedbackNotes,
            feedbackUrl: r.feedbackUrl,
            scriptTitle: r.scriptVersion?.script?.title ?? scriptTitle,
            versionLabel: r.scriptVersion?.versionLabel,
          }))}
        />
      </ToolSavedViewSheet>
    </div>
  );
}
