"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Printer, RefreshCw, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useModocOptional } from "@/components/modoc";
import { ProductionModocReportModal } from "./production-modoc-modal";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
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
              {vm.cast.map((c, i) => (
                <tr key={i} className="border-b border-slate-200 align-top">
                  <td className="py-1 pr-1 font-medium break-words max-w-[120px]">{c.talentName ?? "TBD"}</td>
                  <td className="py-1 pr-1 break-words">{c.characterName}</td>
                  <td className="py-1 pr-1 whitespace-nowrap">{c.callTime ?? "—"}</td>
                  <td className="py-1 text-slate-600">{c.scenesInvolved?.length ? c.scenesInvolved.join(", ") : "—"}</td>
                </tr>
              ))}
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
  const { deviceClass, orientation } = useAdaptiveUi();
  const modoc = useModocOptional();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "";
  const urlDayId = searchParams.get("dayId") || "";
  const urlSheetId = searchParams.get("sheetId") || "";

  const hasProject = !!projectId;
  const [modocReportOpen, setModocReportOpen] = useState(false);
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
    shootDay?: { date: string };
    formats?: { shareablePath: string; mobilePath: string };
  }[];

  const [selectedDayId, setSelectedDayId] = useState("");
  const [notes, setNotes] = useState("");
  const [sheetTitle, setSheetTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const selectedDay = shootDays.find((d) => d.id === selectedDayId);

  const appliedUrl = useRef(false);
  useEffect(() => {
    if (appliedUrl.current || shootDays.length === 0) return;
    if (urlDayId && shootDays.some((d) => d.id === urlDayId)) {
      setSelectedDayId(urlDayId);
      const d = shootDays.find((x) => x.id === urlDayId);
      if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
      appliedUrl.current = true;
    }
  }, [shootDays, urlDayId]);

  const { data: previewPayload, isFetching: previewBusy } = useQuery({
    queryKey: ["call-sheet-preview", projectId, selectedDayId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/call-sheets/preview?shootDayId=${encodeURIComponent(selectedDayId)}`).then((r) => {
        if (!r.ok) throw new Error("Preview failed");
        return r.json();
      }),
    enabled: hasProject && !!selectedDayId && !urlSheetId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: savedSheetPayload } = useQuery({
    queryKey: ["call-sheet-one", projectId, urlSheetId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/call-sheets?sheetId=${encodeURIComponent(urlSheetId)}`).then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      }),
    enabled: hasProject && !!urlSheetId,
  });

  const preview = previewPayload?.preview as Parameters<typeof viewModelFromLivePreview>[0] | undefined;
  const liveVm = useMemo(() => (preview ? viewModelFromLivePreview(preview) : null), [preview]);
  const savedVm = useMemo(() => {
    const p = savedSheetPayload?.callSheet?.parsed;
    if (!p) return null;
    return viewModelFromSaved(p);
  }, [savedSheetPayload]);

  const displayVm = urlSheetId ? savedVm : liveVm;
  const displayNotes = urlSheetId ? String(savedSheetPayload?.callSheet?.notes ?? "") : notes;

  const previewConflicts = (previewPayload?.conflicts ?? []) as { type: string; severity: string; message: string }[];

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
    window.print();
  }, []);

  const readOnlyShare = view === "share" || view === "mobile";
  const mobileLayout = view === "mobile" || deviceClass === "mobile";
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
              contracts, and risk items. Save a dated snapshot (versioned per shoot day) for PDF / print and crew links.
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
              AI call sheet help
            </Button>
          )}
        </header>
      )}

      {modoc && modocReportOpen && (
        <ProductionModocReportModal
          task="call_sheet_generator"
          reportTitle="Call sheet assistance"
          prompt="Use the production schedule and existing call sheets in your context. Suggest what to include on each call sheet, a completeness checklist (weather, parking, safety, etc.), and how to automate generation so every shoot day has all relevant details."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId}
        />
      )}

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
                    setSelectedDayId(e.target.value);
                    const d = shootDays.find((x) => x.id === e.target.value);
                    if (d) setSheetTitle(`Call sheet – ${new Date(d.date).toLocaleDateString()}`);
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

                {previewConflicts.length > 0 && (
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
                    onClick={() => createMutation.mutate()}
                  >
                    {createMutation.isPending ? "Saving…" : "Save snapshot (new version)"}
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-600" disabled={!displayVm} onClick={handlePrint}>
                    <Printer className="w-3.5 h-3.5 mr-1.5 inline" />
                    PDF / print
                  </Button>
                </div>
                {liveVm?.shareablePath && selectedDayId && (
                  <div className="flex flex-wrap gap-3 text-[11px] pt-1">
                    <Link href={`${liveVm.shareablePath}`} className="text-orange-400 hover:text-orange-300 inline-flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> Share view
                    </Link>
                    <Link
                      href={liveVm.mobilePath || liveVm.shareablePath}
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
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button size="sm" variant="outline" className="border-slate-600" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 mr-1.5 inline" />
                Print / PDF
              </Button>
              <Link href={`/creator/projects/${projectId}/pre-production/production-scheduling`} className="text-xs text-orange-400 self-center">
                Edit schedule →
              </Link>
            </div>
          )}

          <div
            className={`rounded-2xl border border-slate-700 bg-slate-950/40 overflow-hidden print:border-0 print:shadow-none print:bg-white ${
              previewBusy && !urlSheetId ? "opacity-70" : ""
            }`}
          >
            {!displayVm ? (
              <p className="p-6 text-sm text-slate-500 print:text-slate-600">
                {urlSheetId ? "Loading call sheet…" : selectedDayId ? "Building preview…" : "Select a shoot day to generate the call sheet."}
              </p>
            ) : (
              <CallSheetPrintBody vm={displayVm} sheetNotes={displayNotes} compact={mobileLayout} />
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
                {callSheets.slice(0, 24).map((c) => (
                  <li key={c.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm">
                    <p className="text-white font-medium truncate">{c.title || "Call sheet"}</p>
                    <p className="text-[11px] text-slate-500">
                      v{c.version} · {c.shootDay?.date ? new Date(c.shootDay.date).toLocaleDateString() : ""} ·{" "}
                      {new Date(c.createdAt).toLocaleString()}
                    </p>
                    {c.formats && (
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                        <Link href={c.formats.shareablePath} className="text-orange-400 hover:text-orange-300">
                          Share
                        </Link>
                        <Link href={c.formats.mobilePath} className="text-slate-300 hover:text-white">
                          Mobile
                        </Link>
                        <Link href={`?dayId=${c.shootDayId}&sheetId=${c.id}`} className="text-cyan-400 hover:text-cyan-300">
                          Open
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
