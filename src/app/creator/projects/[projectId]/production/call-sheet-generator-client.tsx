"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Share2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolSavedViewSheet, ToolViewButton, CallSheetsSavedViewer } from "@/components/project-tools";
import { useModocOptional } from "@/components/modoc";
import { ProductionModocReportModal } from "./production-modoc-modal";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { buildCallSheetDocumentHtml } from "@/lib/call-sheet-html";
import { printHtmlDocument, downloadPdfFromHtmlDocument } from "@/lib/pdf/print-html-document";
import type {
  CallSheetCastRow,
  CallSheetHeader,
  CallSheetLocationRow,
  CallSheetSafetyLine,
  CallSheetScheduleRow,
  CallSheetTaskRow,
  CallSheetTiming,
} from "@/lib/call-sheet-builder";

type CrewRow = { role: string; name: string; department?: string; callTime?: string | null; wrapTime?: string | null };

type ScheduleBundle = {
  meta?: Record<string, unknown> & {
    weather?: string | null;
    logistics?: Record<string, string | null | undefined>;
    equipment?: { equipmentName: string; category: string; quantity: number }[];
    dayNotes?: string | null;
    callTime?: string | null;
    wrapTime?: string | null;
    locationSummary?: string | null;
    date?: string;
    shareablePath?: string;
    mobilePath?: string;
  };
  rows?: CallSheetScheduleRow[];
  tasks?: CallSheetTaskRow[];
  safety?: CallSheetSafetyLine[];
  header?: CallSheetHeader;
  timing?: CallSheetTiming;
};

type CallSheetViewModel = {
  header: CallSheetHeader;
  timing: CallSheetTiming;
  weather: string | null;
  logistics: Record<string, string | null | undefined> | null;
  equipment: { equipmentName: string; category: string; quantity: number }[];
  schedule: CallSheetScheduleRow[];
  cast: CallSheetCastRow[];
  crew: CrewRow[];
  locations: CallSheetLocationRow[];
  tasks: CallSheetTaskRow[];
  safety: CallSheetSafetyLine[];
  dayNotes: string | null;
  shareablePath: string | null;
  mobilePath: string | null;
};

function coerceScheduleBundle(raw: unknown): ScheduleBundle {
  if (!raw || typeof raw !== "object") return {};
  return raw as ScheduleBundle;
}

function viewModelFromLivePreview(preview: {
  meta?: ScheduleBundle["meta"];
  schedule?: CallSheetScheduleRow[];
  cast?: CallSheetCastRow[];
  crew?: CrewRow[];
  locations?: CallSheetLocationRow[];
  tasks?: CallSheetTaskRow[];
  safety?: CallSheetSafetyLine[];
  header?: CallSheetHeader;
  timing?: CallSheetTiming;
}): CallSheetViewModel | null {
  const meta = preview.meta ?? {};
  const headerDateIso = preview.header?.dateIso;
  if (!headerDateIso && !meta.date) return null;
  const header: CallSheetHeader =
    preview.header ??
    ({
      productionTitle: "Production",
      productionCompany: null,
      shootDayNumber: 1,
      totalShootDays: 1,
      dateIso: String(meta.date ?? headerDateIso ?? ""),
      primaryLocationSummary: meta.locationSummary ? String(meta.locationSummary) : null,
    } as CallSheetHeader);
  const timing: CallSheetTiming =
    preview.timing ??
    ({
      generalCall: meta.callTime ? String(meta.callTime) : null,
      estimatedWrap: meta.wrapTime ? String(meta.wrapTime) : null,
      mealBreakNotes: meta.logistics?.cateringNotes ?? null,
    } as CallSheetTiming);
  return {
    header,
    timing,
    weather: meta.weather ?? null,
    logistics: meta.logistics ?? null,
    equipment: (meta.equipment as CallSheetViewModel["equipment"]) ?? [],
    schedule: preview.schedule ?? [],
    cast: preview.cast ?? [],
    crew: preview.crew ?? [],
    locations: preview.locations ?? [],
    tasks: preview.tasks ?? [],
    safety: preview.safety ?? [],
    dayNotes: meta.dayNotes ? String(meta.dayNotes) : null,
    shareablePath: meta.shareablePath ? String(meta.shareablePath) : null,
    mobilePath: meta.mobilePath ? String(meta.mobilePath) : null,
  };
}

function viewModelFromSaved(parsed: {
  cast: unknown;
  crew: unknown;
  locations: unknown;
  schedule: unknown;
}): CallSheetViewModel | null {
  const bundle = coerceScheduleBundle(parsed.schedule);
  const meta = bundle.meta;
  if (!meta?.date) return null;
  const header: CallSheetHeader =
    bundle.header ??
    ({
      productionTitle: "Production",
      productionCompany: null,
      shootDayNumber: 1,
      totalShootDays: 1,
      dateIso: String(meta.date),
      primaryLocationSummary: meta.locationSummary ? String(meta.locationSummary) : null,
    } as CallSheetHeader);
  const timing: CallSheetTiming =
    bundle.timing ??
    ({
      generalCall: meta.callTime ? String(meta.callTime) : null,
      estimatedWrap: meta.wrapTime ? String(meta.wrapTime) : null,
      mealBreakNotes: meta.logistics?.cateringNotes ?? null,
    } as CallSheetTiming);
  return {
    header,
    timing,
    weather: meta.weather ?? null,
    logistics: meta.logistics ?? null,
    equipment: (meta.equipment as CallSheetViewModel["equipment"]) ?? [],
    schedule: Array.isArray(bundle.rows) ? (bundle.rows as CallSheetScheduleRow[]) : [],
    cast: Array.isArray(parsed.cast) ? (parsed.cast as CallSheetCastRow[]) : [],
    crew: Array.isArray(parsed.crew) ? (parsed.crew as CrewRow[]) : [],
    locations: Array.isArray(parsed.locations) ? (parsed.locations as CallSheetLocationRow[]) : [],
    tasks: Array.isArray(bundle.tasks) ? bundle.tasks : [],
    safety: Array.isArray(bundle.safety) ? bundle.safety : [],
    dayNotes: meta.dayNotes ? String(meta.dayNotes) : null,
    shareablePath: meta.shareablePath ? String(meta.shareablePath) : null,
    mobilePath: meta.mobilePath ? String(meta.mobilePath) : null,
  };
}

function CallSheetPrintBody({
  vm,
  sheetNotes,
  compact,
}: {
  vm: CallSheetViewModel;
  sheetNotes: string;
  compact: boolean;
}) {
  const dt = vm.header.dateIso ? new Date(vm.header.dateIso) : null;
  const dateStr =
    dt && !Number.isNaN(dt.getTime())
      ? dt.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <div
      className={`call-sheet-document space-y-5 text-slate-900 bg-white print:bg-white print:text-black ${
        compact ? "text-[15px] leading-snug px-1" : "text-sm px-4 py-5 sm:px-8"
      }`}
    >
      <header className="border-b-2 border-slate-900 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 print:text-slate-600">Call sheet</p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{vm.header.productionTitle}</h1>
        {vm.header.productionCompany ? (
          <p className="text-sm text-slate-600 mt-0.5">{vm.header.productionCompany}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <strong>Day {vm.header.shootDayNumber}</strong> of {vm.header.totalShootDays}
          </span>
          <span>{dateStr}</span>
          {vm.header.primaryLocationSummary ? <span className="max-w-[320px]">{vm.header.primaryLocationSummary}</span> : null}
          {vm.weather ? (
            <span>
              <strong>Weather</strong> {vm.weather}
            </span>
          ) : null}
        </div>
      </header>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">General timing</h2>
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-slate-500">General call</span>
            <p className="font-semibold">{vm.timing.generalCall ?? "—"}</p>
          </div>
          <div>
            <span className="text-slate-500">Est. wrap</span>
            <p className="font-semibold">{vm.timing.estimatedWrap ?? "—"}</p>
          </div>
          <div>
            <span className="text-slate-500">Meals / catering</span>
            <p className="font-medium">{vm.timing.mealBreakNotes ?? "—"}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Scene breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Scene</th>
                <th className="py-1.5 pr-2">INT/EXT · D/N</th>
                <th className="py-1.5 pr-2">Location</th>
                <th className="py-1.5 pr-2 w-[28%]">Description</th>
                <th className="py-1.5 text-right">Est.</th>
              </tr>
            </thead>
            <tbody>
              {vm.schedule.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-2 text-slate-500">
                    No scenes scheduled.
                  </td>
                </tr>
              ) : (
                vm.schedule.map((row) => (
                  <tr key={`${row.order}-${row.sceneNumber}`} className="border-b border-slate-200 align-top">
                    <td className="py-1.5 pr-2 font-medium">{row.order + 1}</td>
                    <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                      {row.sceneNumber}
                      {row.heading ? <span className="font-normal text-slate-600"> — {row.heading}</span> : null}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-700 whitespace-nowrap">
                      {[row.intExt, row.timeOfDay].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-700 break-words max-w-[140px]">{row.primaryLocationLabel ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-slate-600 break-words">{row.description ?? "—"}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{row.durationMinutes != null ? `${row.durationMinutes}m` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={`grid gap-5 ${compact ? "" : "md:grid-cols-2"}`}>
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Cast</h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-1 pr-1">Talent</th>
                <th className="py-1 pr-1">Role</th>
                <th className="py-1 pr-1">Call</th>
                <th className="py-1">Scenes</th>
              </tr>
            </thead>
            <tbody>
              {vm.cast.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-slate-500">
                    No cast linked yet — add characters in Script Breakdown and assign casting roles.
                  </td>
                </tr>
              ) : (
                vm.cast.map((c, i) => (
                  <tr key={i} className="border-b border-slate-200 align-top">
                    <td className="py-1 pr-1 font-medium break-words max-w-[120px]">{c.talentName ?? "TBD"}</td>
                    <td className="py-1 pr-1 break-words">{c.characterName}</td>
                    <td className="py-1 pr-1 whitespace-nowrap">{c.callTime ?? "—"}</td>
                    <td className="py-1 text-slate-600">{c.scenesInvolved?.length ? c.scenesInvolved.join(", ") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Crew</h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-1 pr-1">Name</th>
                <th className="py-1 pr-1">Role</th>
                <th className="py-1 pr-1">Dept</th>
                <th className="py-1">Call</th>
              </tr>
            </thead>
            <tbody>
              {vm.crew.map((c, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-1 pr-1 font-medium break-words max-w-[100px]">{c.name}</td>
                  <td className="py-1 pr-1 break-words">{c.role}</td>
                  <td className="py-1 pr-1 text-slate-600">{c.department ?? "—"}</td>
                  <td className="py-1 whitespace-nowrap">{c.callTime ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Equipment</h2>
        <ul className="text-xs grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
          {vm.equipment.length === 0 ? (
            <li className="text-slate-500">—</li>
          ) : (
            vm.equipment.map((e, i) => (
              <li key={i} className="break-words">
                <span className="font-medium">{e.equipmentName}</span>{" "}
                <span className="text-slate-600">
                  ({e.category}) ×{e.quantity}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Locations</h2>
        <ul className="text-xs space-y-2">
          {vm.locations.map((loc, i) => (
            <li key={i} className="border border-slate-200 rounded-md p-2 break-words">
              <p className="font-semibold">{loc.name}</p>
              {loc.addressLine ? <p className="text-slate-700">{loc.addressLine}</p> : null}
              {loc.description ? <p className="text-slate-600 mt-0.5">{loc.description}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      {vm.tasks.length > 0 ? (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Tasks & notes</h2>
          <ul className="text-xs space-y-1">
            {vm.tasks.map((t, i) => (
              <li key={i} className="break-words">
                <span className="font-medium">{t.title}</span>
                <span className="text-slate-500">
                  {" "}
                  · {t.status}
                  {t.department ? ` · ${t.department}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vm.safety.length > 0 ? (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 border-b border-amber-300 mb-2">Safety & risk</h2>
          <ul className="text-xs space-y-1">
            {vm.safety.map((s, i) => (
              <li key={i} className="break-words">
                <span className="font-semibold text-amber-900">[{s.category}]</span> {s.line}
                {s.severity ? <span className="text-red-700"> ({s.severity})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(vm.dayNotes || sheetNotes) && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 mb-2">Production notes</h2>
          <div className="text-xs text-slate-700 space-y-2 whitespace-pre-wrap break-words">
            {sheetNotes ? <p>{sheetNotes}</p> : null}
            {vm.dayNotes ? <p>{vm.dayNotes}</p> : null}
          </div>
        </section>
      )}

      <footer className="text-[10px] text-slate-400 pt-4 border-t border-slate-200 print:text-slate-600">
        Generated from Story Time scheduling, breakdown, casting, crew, equipment, tasks, and risk data. Verify on set before distribution.
      </footer>
    </div>
  );
}

export function CallSheetGenerator({ projectId, title }: { projectId?: string; title: string }) {
  const router = useRouter();
  const { deviceClass, orientation } = useAdaptiveUi();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") || "";
  const urlDayId = searchParams.get("dayId") || "";
  const urlSheetId = searchParams.get("sheetId") || "";
  /** share/mobile are crew-facing read-only modes; other view values are ignored. */
  const isShareMode = viewParam === "share" || viewParam === "mobile";

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
    version: number;
    title: string | null;
    notes: string | null;
    createdAt: string;
    stale?: boolean;
    shootDay?: { date: string };
    formats?: { shareablePath: string; mobilePath: string };
  }[];

  const [selectedDayId, setSelectedDayId] = useState("");
  /** Local snapshot selection — does not lock the URL, so day/version can change freely. */
  const [viewingSheetId, setViewingSheetId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sheetTitle, setSheetTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [callSheetsViewOpen, setCallSheetsViewOpen] = useState(false);

  const activeSheetId = isShareMode ? urlSheetId : viewingSheetId;
  const selectedDay = shootDays.find((d) => d.id === selectedDayId);
  const activeSheetMeta = callSheets.find((c) => c.id === activeSheetId) ?? null;

  const editorBasePath = projectId
    ? `/creator/projects/${projectId}/production/call-sheet-generator`
    : "";

  const replaceEditorUrl = useCallback(
    (opts?: { dayId?: string | null; sheetId?: string | null; view?: string | null }) => {
      if (!editorBasePath) return;
      const params = new URLSearchParams();
      const dayId = opts?.dayId;
      const sheetId = opts?.sheetId;
      const view = opts?.view;
      if (dayId) params.set("dayId", dayId);
      if (sheetId) params.set("sheetId", sheetId);
      if (view === "share" || view === "mobile") params.set("view", view);
      const qs = params.toString();
      router.replace(qs ? `${editorBasePath}?${qs}` : editorBasePath, { scroll: false });
    },
    [editorBasePath, router],
  );

  const exitToLiveEditor = useCallback(
    (dayId?: string | null) => {
      const nextDay = dayId ?? selectedDayId ?? urlDayId ?? "";
      setViewingSheetId(null);
      if (nextDay) setSelectedDayId(nextDay);
      replaceEditorUrl({ dayId: nextDay || null });
    },
    [replaceEditorUrl, selectedDayId, urlDayId],
  );

  const openSnapshot = useCallback(
    (sheetId: string) => {
      const sheet = callSheets.find((c) => c.id === sheetId);
      if (sheet?.shootDayId) {
        setSelectedDayId(sheet.shootDayId);
        const d = shootDays.find((x) => x.id === sheet.shootDayId);
        if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
      }
      setViewingSheetId(sheetId);
      setCallSheetsViewOpen(false);
      // Stay in the editor (no share/mobile lock).
      replaceEditorUrl({ dayId: sheet?.shootDayId ?? selectedDayId ?? null });
    },
    [callSheets, shootDays, replaceEditorUrl, selectedDayId],
  );

  // Hydrate day + optional snapshot from URL once shoot days load.
  const appliedUrl = useRef<string | null>(null);
  useEffect(() => {
    if (shootDays.length === 0) return;
    const key = `${urlDayId}|${urlSheetId}|${viewParam}`;
    if (appliedUrl.current === key) return;
    appliedUrl.current = key;

    const dayFromSheet = urlSheetId
      ? callSheets.find((c) => c.id === urlSheetId)?.shootDayId
      : null;
    const dayId =
      (urlDayId && shootDays.some((d) => d.id === urlDayId) && urlDayId) ||
      (dayFromSheet && shootDays.some((d) => d.id === dayFromSheet) && dayFromSheet) ||
      "";

    if (dayId) {
      setSelectedDayId(dayId);
      const d = shootDays.find((x) => x.id === dayId);
      if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
    }

    if (urlSheetId && isShareMode) {
      // Crew-facing share/mobile: URL is source of truth; don't use local snapshot state.
      setViewingSheetId(null);
    } else if (urlSheetId && !isShareMode) {
      // Editor opened a snapshot via URL — move it into local state and unlock the URL.
      setViewingSheetId(urlSheetId);
      replaceEditorUrl({ dayId: dayId || null });
    }
  }, [shootDays, callSheets, urlDayId, urlSheetId, viewParam, isShareMode, replaceEditorUrl]);

  const { data: previewPayload, isFetching: previewBusy } = useQuery({
    queryKey: ["call-sheet-preview", projectId, selectedDayId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/call-sheets/preview?shootDayId=${encodeURIComponent(selectedDayId)}`).then((r) => {
        if (!r.ok) throw new Error("Preview failed");
        return r.json();
      }),
    enabled: hasProject && !!selectedDayId && !activeSheetId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: savedSheetPayload } = useQuery({
    queryKey: ["call-sheet-one", projectId, activeSheetId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/call-sheets?sheetId=${encodeURIComponent(activeSheetId!)}`).then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      }),
    enabled: hasProject && !!activeSheetId,
  });

  const preview = previewPayload?.preview as Parameters<typeof viewModelFromLivePreview>[0] | undefined;
  const liveVm = useMemo(() => (preview ? viewModelFromLivePreview(preview) : null), [preview]);
  const savedVm = useMemo(() => {
    const p = savedSheetPayload?.callSheet?.parsed;
    if (!p) return null;
    return viewModelFromSaved(p);
  }, [savedSheetPayload]);

  const displayVm = activeSheetId ? savedVm : liveVm;
  const displayNotes = activeSheetId
    ? String(savedSheetPayload?.callSheet?.notes ?? activeSheetMeta?.notes ?? "")
    : notes;

  const previewConflicts = (previewPayload?.conflicts ?? []) as { type: string; severity: string; message: string }[];

  const createMutation = useMutation({
    mutationFn: async (override?: { shootDayId: string; title?: string }) => {
      const dayId = override?.shootDayId ?? selectedDayId;
      const day = shootDays.find((d) => d.id === dayId);
      const res = await fetch(`/api/creator/projects/${projectId}/call-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shootDayId: dayId,
          title:
            override?.title?.trim() ||
            sheetTitle.trim() ||
            `Call sheet – ${day ? new Date(day.date).toLocaleDateString() : "Day"}`,
          notes: override ? undefined : notes.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to save");
      return body as { warnings?: string[] };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["project-call-sheets", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["call-sheet-preview", projectId] });
      setNotes("");
      setSheetTitle("");
      if (data.warnings?.length) setToast(data.warnings.join(" "));
    },
    onError: (e: Error) => setToast(e.message),
  });

  const handlePrint = useCallback(() => {
    if (!displayVm) {
      setToast("Select a shoot day to print the call sheet.");
      return;
    }
    try {
      const { bodyHtml, extraCss } = buildCallSheetDocumentHtml({
        header: displayVm.header,
        timing: displayVm.timing,
        weather: displayVm.weather,
        equipment: displayVm.equipment,
        schedule: displayVm.schedule,
        cast: displayVm.cast,
        crew: displayVm.crew,
        locations: displayVm.locations,
        tasks: displayVm.tasks,
        safety: displayVm.safety,
        dayNotes: displayVm.dayNotes,
        sheetNotes: displayNotes,
      });
      printHtmlDocument({
        title: `Call sheet — ${displayVm.header.productionTitle}`,
        bodyHtml,
        extraCss,
      });
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not open print view. Allow pop-ups and try again.");
    }
  }, [displayVm, displayNotes]);

  const [pdfDownloading, setPdfDownloading] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!displayVm) {
      setToast("Select a shoot day to download the call sheet.");
      return;
    }
    setPdfDownloading(true);
    setToast(null);
    try {
      const { bodyHtml, extraCss } = buildCallSheetDocumentHtml({
        header: displayVm.header,
        timing: displayVm.timing,
        weather: displayVm.weather,
        equipment: displayVm.equipment,
        schedule: displayVm.schedule,
        cast: displayVm.cast,
        crew: displayVm.crew,
        locations: displayVm.locations,
        tasks: displayVm.tasks,
        safety: displayVm.safety,
        dayNotes: displayVm.dayNotes,
        sheetNotes: displayNotes,
      });
      const filename = `call-sheet-${displayVm.header.productionTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

      try {
        await downloadPdfFromHtmlDocument({
          title: `Call sheet — ${displayVm.header.productionTitle}`,
          bodyHtml,
          extraCss,
          filename,
        });
        return;
      } catch {
        // Fall through to server PDF.
      }

      const params = new URLSearchParams();
      if (activeSheetId) params.set("sheetId", activeSheetId);
      else params.set("shootDayId", selectedDayId);
      if (!activeSheetId && notes.trim()) params.set("notes", notes.trim());
      const res = await fetch(
        `/api/creator/projects/${projectId}/call-sheets/pdf?${params.toString()}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Could not download PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] ?? "call-sheet.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setPdfDownloading(false);
    }
  }, [displayVm, displayNotes, projectId, selectedDayId, activeSheetId, notes]);

  const readOnlyShare = isShareMode;
  const mobileLayout = viewParam === "mobile" || deviceClass === "mobile";
  const compactShell = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");

  if (!hasProject) {
    return <p className="text-sm text-slate-500">Link a project to use the Call Sheet Generator.</p>;
  }

  return (
    <div className={`space-y-4 ${readOnlyShare ? "max-w-3xl mx-auto" : ""} ${deviceClass === "tv" ? "adaptive-tv-surface" : ""}`}>
      {!readOnlyShare && (
        <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Auto-builds from scheduling, script breakdown, casting, crew, locations, equipment, production tasks, signed
              contracts, and risk items. Save a dated snapshot (versioned per shoot day), download a real PDF, or print.
            </p>
          </div>
          <ToolViewButton
            onClick={() => setCallSheetsViewOpen(true)}
            count={callSheets.length}
            disabled={callSheets.length === 0}
            label="View saved"
          />
        </header>
      )}

      <ToolSavedViewSheet
        open={callSheetsViewOpen}
        onClose={() => setCallSheetsViewOpen(false)}
        title="Saved call sheets"
        subtitle="Versioned snapshots per shoot day. Open one to load the full preview."
      >
        <CallSheetsSavedViewer
          sheets={callSheets.map((c) => ({
            id: c.id,
            title: c.title,
            version: c.version,
            createdAt: c.createdAt,
            shootDayDate: c.shootDay?.date,
            notes: c.notes,
          }))}
          onOpen={openSnapshot}
        />
      </ToolSavedViewSheet>

      

      {toast && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 print:hidden flex justify-between gap-2">
          <span>{toast}</span>
          <button type="button" className="text-amber-200 shrink-0" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className={`grid gap-4 ${readOnlyShare || compactShell ? "" : "lg:grid-cols-[1fr,300px]"} print:block`}>
        <div className="space-y-4 min-w-0 print:space-y-0">
          {!readOnlyShare && (
            <Card className="creator-glass-panel border-0 bg-transparent shadow-none print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Shoot day & snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={selectedDayId}
                  onChange={(e) => {
                    const nextDay = e.target.value;
                    setSelectedDayId(nextDay);
                    setViewingSheetId(null);
                    const d = shootDays.find((x) => x.id === nextDay);
                    if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
                    replaceEditorUrl({ dayId: nextDay || null });
                  }}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select a day</option>
                  {shootDays.map((d) => (
                    <option key={d.id} value={d.id}>
                      {new Date(d.date).toLocaleDateString()} {d.locationSummary ? `· ${d.locationSummary}` : ""}{" "}
                      {d.status ? `· ${d.status}` : ""}
                    </option>
                  ))}
                </select>

                {selectedDay && (
                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 text-xs space-y-2">
                    <p className="text-slate-400 font-medium">Schedule summary</p>
                    <div className="flex flex-wrap gap-3 text-slate-300">
                      {selectedDay.callTime && <span>Call: {selectedDay.callTime}</span>}
                      {selectedDay.wrapTime && <span>Wrap: {selectedDay.wrapTime}</span>}
                      {selectedDay.locationSummary && <span>Locations: {selectedDay.locationSummary}</span>}
                    </div>
                  </div>
                )}

                {activeSheetId && activeSheetMeta && (
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Viewing saved snapshot{" "}
                      <strong>v{activeSheetMeta.version}</strong>
                      {activeSheetMeta.title ? ` · ${activeSheetMeta.title}` : ""}
                      {" — "}live schedule changes are not shown.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-cyan-400/40 text-cyan-100"
                      onClick={() => exitToLiveEditor(selectedDayId || activeSheetMeta.shootDayId)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Back to live preview
                    </Button>
                  </div>
                )}

                {previewConflicts.length > 0 && !activeSheetId && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-[11px]">
                    <p className="text-red-200 font-medium mb-1">Conflicts detected</p>
                    <ul className="space-y-0.5 text-red-100/90">
                      {previewConflicts.map((c, i) => (
                        <li key={`${c.type}-${i}`}>
                          [{c.severity}] {c.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Snapshot title (optional)</label>
                  <Input
                    value={sheetTitle}
                    onChange={(e) => setSheetTitle(e.target.value)}
                    placeholder="e.g. Call sheet – 15 Mar 2026"
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Extra notes (parking, hospital, radio channel…)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional — merged into the printed call sheet"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600"
                    disabled={!selectedDayId || createMutation.isPending}
                    onClick={() => createMutation.mutate(undefined)}
                  >
                    {createMutation.isPending ? "Saving…" : "Save snapshot (new version)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600"
                    disabled={!displayVm || pdfDownloading || (!selectedDayId && !activeSheetId)}
                    onClick={() => void handleDownloadPdf()}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 inline" />
                    {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-600" disabled={!displayVm} onClick={handlePrint}>
                    <Printer className="w-3.5 h-3.5 mr-1.5 inline" />
                    Print
                  </Button>
                </div>
                {selectedDayId && (
                  <div className="flex flex-wrap gap-3 text-[11px] pt-1">
                    <Link
                      href={`${editorBasePath}?dayId=${selectedDayId}${activeSheetId ? `&sheetId=${activeSheetId}` : ""}&view=share`}
                      className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" /> Share view
                    </Link>
                    <Link
                      href={`${editorBasePath}?dayId=${selectedDayId}${activeSheetId ? `&sheetId=${activeSheetId}` : ""}&view=mobile`}
                      className="text-slate-300 hover:text-white inline-flex items-center gap-1"
                    >
                      <Smartphone className="w-3 h-3" /> Mobile view
                    </Link>
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Live preview refreshes when you change the schedule or linked tools. Saving creates an immutable snapshot with an
                  incrementing version for that shoot day.
                </p>
              </CardContent>
            </Card>
          )}

          {readOnlyShare && (
            <div className="flex flex-wrap items-center gap-2 print:hidden rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2">
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => exitToLiveEditor(urlDayId || selectedDayId || activeSheetMeta?.shootDayId)}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Exit {viewParam === "mobile" ? "mobile" : "share"} view
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600"
                disabled={pdfDownloading}
                onClick={() => void handleDownloadPdf()}
              >
                <Download className="w-3.5 h-3.5 mr-1.5 inline" />
                {pdfDownloading ? "Preparing PDF…" : "Download PDF"}
              </Button>
              <Button size="sm" variant="outline" className="border-slate-600" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1.5 inline" />
                Print
              </Button>
              <Link
                href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
                className="text-xs text-orange-400 self-center"
              >
                Edit schedule →
              </Link>
            </div>
          )}

          <div
            className={`rounded-2xl border border-slate-700 bg-slate-950/40 overflow-hidden print:border-0 print:shadow-none print:bg-white ${
              previewBusy && !activeSheetId ? "opacity-70" : ""
            }`}
          >
            {!displayVm ? (
              <p className="p-6 text-sm text-slate-500 print:text-slate-600">
                {activeSheetId
                  ? "Loading call sheet…"
                  : selectedDayId
                    ? "Building preview…"
                    : "Select a shoot day to generate the call sheet."}
              </p>
            ) : (
              <>
                {!activeSheetId && displayVm.schedule.length === 0 && (
                  <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 print:hidden">
                    No scenes are linked to this shoot day yet. Open{" "}
                    <Link
                      href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
                      className="text-orange-300 hover:underline"
                    >
                      Production Scheduling
                    </Link>
                    , select scenes for this day, save the schedule, then regenerate this call sheet.
                  </div>
                )}
                <CallSheetPrintBody vm={displayVm} sheetNotes={displayNotes} compact={mobileLayout} />
              </>
            )}
          </div>
        </div>

        {!readOnlyShare && !compactShell && (
          <aside className="space-y-2 print:hidden min-w-0">
            <p className="text-xs font-medium text-slate-400">Saved versions</p>
            {callSheets.length === 0 ? (
              <p className="text-sm text-slate-500 p-3 rounded-xl bg-slate-900/60">None yet. Pick a day and save a snapshot.</p>
            ) : (
              <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {callSheets.slice(0, 24).map((c) => {
                  const isActive = activeSheetId === c.id;
                  return (
                  <li
                    key={c.id}
                    className={`rounded-xl bg-slate-900/80 border px-3 py-2 text-sm ${
                      isActive
                        ? "border-cyan-500/50 ring-1 ring-cyan-500/20"
                        : c.stale
                          ? "border-amber-500/40"
                          : "border-slate-800"
                    }`}
                  >
                    <p className="text-white font-medium truncate">{c.title || "Call sheet"}</p>
                    <p className="text-[11px] text-slate-500">
                      v{c.version} · {c.shootDay?.date ? new Date(c.shootDay.date).toLocaleDateString() : ""} ·{" "}
                      {new Date(c.createdAt).toLocaleString()}
                      {isActive ? " · viewing" : ""}
                    </p>
                    {c.stale && (
                      <p className="mt-1 text-[11px] text-amber-400">
                        Schedule changed after this version —{" "}
                        <button
                          type="button"
                          className="underline hover:text-amber-300"
                          disabled={createMutation.isPending}
                          onClick={() =>
                            createMutation.mutate({
                              shootDayId: c.shootDayId,
                              title: c.title || undefined,
                            })
                          }
                        >
                          regenerate
                        </button>
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => openSnapshot(c.id)}
                        className={isActive ? "text-cyan-200" : "text-cyan-400 hover:text-cyan-300"}
                      >
                        {isActive ? "Viewing" : "Open"}
                      </button>
                      {isActive ? (
                        <button
                          type="button"
                          onClick={() => exitToLiveEditor(c.shootDayId)}
                          className="text-slate-300 hover:text-white"
                        >
                          Close
                        </button>
                      ) : null}
                      <Link
                        href={`${editorBasePath}?dayId=${c.shootDayId}&sheetId=${c.id}&view=share`}
                        className="text-orange-400 hover:text-orange-300"
                      >
                        Share
                      </Link>
                      <Link
                        href={`${editorBasePath}?dayId=${c.shootDayId}&sheetId=${c.id}&view=mobile`}
                        className="text-slate-300 hover:text-white"
                      >
                        Mobile
                      </Link>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
