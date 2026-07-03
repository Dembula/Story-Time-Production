"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Columns2,
  Eye,
  FileUp,
  Focus,
  LayoutTemplate,
  Moon,
  Sun,
  Users,
  Wand2,
} from "lucide-react";
import { creatorToolSelect, creatorToolSelectSm } from "@/lib/ui/creator-tool-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ToolSavedViewSheet,
  ToolViewButton,
  ScriptsSavedViewer,
} from "@/components/project-tools";
import { useModocOptional } from "@/components/modoc/use-modoc";
import { useModocToolRefresh } from "@/components/modoc/use-modoc-tool-refresh";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import {
  getElementSnippet,
  SCREENPLAY_ELEMENT_LABELS,
  STUDIO_FONTS,
} from "@/lib/script-studio/elements";
import {
  downloadTextFile,
  exportAsFountain,
  importScreenplayText,
} from "@/lib/script-studio/import-export";
import {
  computeStats,
  jumpToLine,
  parseCharacters,
  parseScenes,
} from "@/lib/script-studio/parse-screenplay";
import { SCRIPT_TEMPLATES } from "@/lib/script-studio/templates";
import type { ScreenplayElementType, StudioTheme } from "@/lib/script-studio/types";
import { ScreenplayReader } from "./screenplay-reader";
import { CollaborationPresenceBar } from "./collaboration-presence-bar";
import { ScriptCommentsPanel } from "./script-comments-panel";
import { ScriptVersionsPanel } from "./script-versions-panel";
import { StoryCardsBoard } from "./story-cards-board";
import { useScriptCollaboration } from "./use-script-collaboration";
import { cn } from "@/lib/utils";

const AUTO_SAVE_MS = 30_000;

function studioToggleButtonClass(active: boolean) {
  return cn(
    "h-7 w-7 shrink-0 p-0 text-slate-300 hover:translate-y-0 active:translate-y-0",
    active && "bg-orange-500/15 text-orange-200 hover:bg-orange-500/20",
  );
}

const VA_QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  {
    label: "Continue writing",
    prompt:
      "Continue the screenplay from where it ends. Match tone and formatting. Output only paste-ready screenplay text.",
  },
  {
    label: "Improve dialogue",
    prompt:
      "Improve the dialogue in the current script excerpt. Keep character voices distinct. Suggest paste-ready replacements.",
  },
  {
    label: "Breakdown elements",
    prompt:
      "From this script, list production breakdown elements (characters, props, locations, wardrobe). Use CHARACTER:/PROP:/LOCATION: lines for auto-fill.",
  },
  {
    label: "Budget estimate",
    prompt:
      "Estimate a department-level budget from this script scope. Then emit MODOC_ACTION generate_smart_budget if a project budget shell exists, or create_budget first.",
  },
  {
    label: "Plot consistency",
    prompt: "Check plot and timeline consistency in this script. Flag continuity issues with scene references.",
  },
  {
    label: "Rewrite for suspense",
    prompt: "Rewrite the selected scene beats for suspense. Output paste-ready screenplay formatting.",
  },
];

function openCreatorVa(prompt: string) {
  window.dispatchEvent(
    new CustomEvent("modoc:open-creator", { detail: { prompt } }),
  );
}

export interface ScriptWritingStudioProps {
  projectId?: string;
  title: string;
}

export function ScriptWritingStudio({ projectId, title }: ScriptWritingStudioProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const modoc = useModocOptional();

  const listEndpoint = hasProject
    ? `/api/creator/scripts?projectId=${projectId}`
    : "/api/creator/scripts";

  const { data, isLoading } = useQuery({
    queryKey: ["creator-scripts", projectId ?? null],
    queryFn: projectToolQueryFn(listEndpoint),
  });

  const scripts = useMemo(
    () =>
      ((data?.scripts as {
        id: string;
        title: string;
        type: string;
        content: string;
        updatedAt?: string;
      }[]) ?? []),
    [data?.scripts],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => scripts.find((s) => s.id === selectedId) ?? scripts[0],
    [scripts, selectedId],
  );

  const [draft, setDraft] = useState<{
    id?: string;
    title: string;
    type: string;
    content: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [importSummary, setImportSummary] = useState<string[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [studioTheme, setStudioTheme] = useState<StudioTheme>("dark");
  const [fontId, setFontId] = useState("courier-prime");
  const [zoom, setZoom] = useState(100);
  const [focusMode, setFocusMode] = useState(false);
  const [splitOutline, setSplitOutline] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"scenes" | "characters" | "outline">("scenes");
  const [highlightCharacter, setHighlightCharacter] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [scriptsViewOpen, setScriptsViewOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ScreenplayElementType>("scene_heading");
  const elementAutoInsertReady = useRef(false);
  const [rightPanelTab, setRightPanelTab] = useState<
    "pipeline" | "comments" | "versions" | "cards"
  >("pipeline");
  const [isTyping, setIsTyping] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const savedUpdatedAtRef = useRef<string | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const collabMarkSavedRef = useRef<(updatedAt: string) => void>(() => {});

  useEffect(() => {
    if (!selectedId && scripts.length > 0) setSelectedId(scripts[0].id);
  }, [scripts, selectedId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (focusMode) setFocusMode(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  useEffect(() => {
    if (selected) {
      setDraft({
        id: selected.id,
        title: selected.title,
        type: selected.type || "FEATURE",
        content: selected.content || "",
      });
      savedUpdatedAtRef.current = selected.updatedAt ?? null;
      setDirty(false);
      setConflictMessage(null);
    } else {
      setDraft(null);
      setDirty(false);
      savedUpdatedAtRef.current = null;
    }
  }, [selected]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: hasProject ? "New project script" : "New script",
          projectId: hasProject ? projectId : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create script");
      return res.json();
    },
    onSuccess: (result: { script?: { id: string } }) => {
      if (result?.script?.id) setSelectedId(result.script.id);
      void queryClient.invalidateQueries({ queryKey: ["creator-scripts", projectId ?? null] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string; title: string; type: string; content: string }) => {
      const res = await fetch("/api/creator/scripts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          projectId: hasProject ? projectId : null,
          expectedUpdatedAt: savedUpdatedAtRef.current ?? undefined,
          createVersion: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const err = new Error("conflict") as Error & { script?: typeof payload };
        (err as { script?: { content: string; title: string; updatedAt: string } }).script =
          json.script;
        throw err;
      }
      if (!res.ok) throw new Error("Failed to save script");
      return json as { script: { updatedAt: string } };
    },
    onSuccess: (result) => {
      setDirty(false);
      setLastSavedAt(new Date());
      setConflictMessage(null);
      if (result?.script?.updatedAt) {
        savedUpdatedAtRef.current = result.script.updatedAt;
        collabMarkSavedRef.current(result.script.updatedAt);
      }
      if (hasProject && projectId) {
        void queryClient.invalidateQueries({ queryKey: ["project-script", projectId] });
        void queryClient.invalidateQueries({ queryKey: ["project-scenes", projectId] });
        void queryClient.invalidateQueries({ queryKey: ["project-breakdown", projectId] });
        void queryClient.invalidateQueries({ queryKey: ["project-script-breakdown", projectId] });
      }
    },
    onError: (err: Error & { script?: { content: string; title: string; updatedAt: string } }) => {
      if (err.message === "conflict" && err.script) {
        setConflictMessage(
          "Another collaborator saved while you were editing. Reload their version or save over it.",
        );
        savedUpdatedAtRef.current = err.script.updatedAt;
      }
    },
    onSettled: () => {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: ["creator-scripts", projectId ?? null] });
    },
  });

  const persist = useCallback(() => {
    if (!draft?.id || !dirty) return;
    setSaving(true);
    saveMutation.mutate({
      id: draft.id,
      title: draft.title,
      type: draft.type,
      content: draft.content,
    });
  }, [draft, dirty, saveMutation]);

  useEffect(() => {
    if (!dirty || !draft?.id) return;
    const t = window.setTimeout(persist, AUTO_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [dirty, draft?.id, draft?.content, draft?.title, persist]);

  useModocToolRefresh({
    queryKeys: hasProject && projectId
      ? ["creator-scripts", "project-script", "project-scenes"]
      : ["creator-scripts"],
    onFieldFill: (detail) => {
      if (detail.tool !== "script-writing" || !detail.fields.content) return;
      setDraft((prev) => {
        if (!prev) return prev;
        const next =
          detail.fields.mode === "append"
            ? `${prev.content.trimEnd()}\n\n${detail.fields.content}`
            : detail.fields.content;
        return { ...prev, content: next };
      });
      setDirty(true);
    },
  });

  useEffect(() => {
    if (!modoc) return;
    modoc.setRequestContext({
      scope: "script-writing",
      clientContext: hasProject
        ? `Script Writing Studio for project ${projectId}. Creator writes and saves scripts, then uses breakdown, budget, and schedule in Story Time.`
        : "Script Writing Studio — standalone script library.",
      pageContext: {
        tool: "script-writing",
        task: "script",
        ...(projectId ? { projectId } : {}),
        ...(draft?.title ? { scriptTitle: draft.title } : {}),
        ...(draft?.content
          ? { scriptExcerpt: draft.content.slice(0, 8000) }
          : {}),
      },
    });
  }, [modoc, projectId, hasProject, draft?.title, draft?.content]);

  const stats = useMemo(
    () => computeStats(draft?.content ?? ""),
    [draft?.content],
  );
  const scenes = useMemo(
    () => parseScenes(draft?.content ?? ""),
    [draft?.content],
  );
  const characters = useMemo(
    () => parseCharacters(draft?.content ?? "", scenes),
    [draft?.content, scenes],
  );

  const getCollaborationCursor = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !draft) {
      return {
        line: 0,
        col: 0,
        selectionStart: 0,
        selectionEnd: 0,
        sceneHeading: null,
        isTyping: false,
        isWriting: false,
      };
    }
    const pos = el.selectionStart;
    const before = draft.content.slice(0, pos);
    const line = before.split("\n").length - 1;
    const col = pos - (before.lastIndexOf("\n") + 1);
    const lines = draft.content.split("\n");
    let sceneHeading: string | null = null;
    for (let i = line; i >= 0; i--) {
      const t = lines[i]?.trim() ?? "";
      if (/^(INT\.|EXT\.|INT\.\/EXT\.)/i.test(t)) {
        sceneHeading = t;
        break;
      }
    }
    const isWriting = document.activeElement === el && (isTyping || dirty);
    return {
      line,
      col,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      sceneHeading,
      isTyping,
      isWriting,
    };
  }, [draft, dirty, isTyping]);

  const collab = useScriptCollaboration({
    scriptId: draft?.id,
    enabled: Boolean(draft?.id && hasProject),
    isDirty: dirty,
    getCursor: getCollaborationCursor,
    onRemoteScript: (remote) => {
      setDraft((prev) =>
        prev
          ? { ...prev, content: remote.content, title: remote.title }
          : prev,
      );
      savedUpdatedAtRef.current = remote.updatedAt;
      setDirty(false);
    },
  });

  collabMarkSavedRef.current = collab.markSaved;

  const effectiveCanWrite = collab.canWrite && !conflictMessage;

  const fontCss =
    STUDIO_FONTS.find((f) => f.id === fontId)?.css ??
    "'Courier Prime', 'Courier New', monospace";

  useEffect(() => {
    elementAutoInsertReady.current = true;
  }, []);

  const insertElement = useCallback(
    (type: ScreenplayElementType) => {
      if (!draft || !effectiveCanWrite) return;

      const { text: snippetText, select } = getElementSnippet(type);
      const el = textareaRef.current;
      const content = draft.content ?? "";

      let newContent: string;
      let selectionStart: number;
      let selectionEnd: number;

      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const before = content.slice(0, start);
        const after = content.slice(end);
        const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
        const insertText = (needsLeadingNewline ? "\n" : "") + snippetText;
        const snippetStart = before.length + (needsLeadingNewline ? 1 : 0);

        newContent = before + insertText + after;
        if (select) {
          selectionStart = snippetStart + select.start;
          selectionEnd = snippetStart + select.end;
        } else {
          selectionStart = snippetStart + snippetText.length;
          selectionEnd = selectionStart;
        }
      } else {
        const needsLeadingNewline = content.length > 0 && !content.endsWith("\n");
        const insertText = (needsLeadingNewline ? "\n" : "") + snippetText;
        const snippetStart = content.length + (needsLeadingNewline ? 1 : 0);

        newContent = content + insertText;
        if (select) {
          selectionStart = snippetStart + select.start;
          selectionEnd = snippetStart + select.end;
        } else {
          selectionStart = newContent.length;
          selectionEnd = selectionStart;
        }
      }

      setDraft({ ...draft, content: newContent });
      setDirty(true);

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
      });
    },
    [draft, effectiveCanWrite],
  );

  const handleElementSelect = useCallback(
    (type: ScreenplayElementType) => {
      setSelectedElement(type);
      if (!elementAutoInsertReady.current || !effectiveCanWrite) return;
      insertElement(type);
    },
    [insertElement, effectiveCanWrite],
  );

  const jumpToLineIndex = (lineIndex: number) => {
    const el = textareaRef.current;
    if (!el || !draft) return;
    const pos = jumpToLine(draft.content, lineIndex);
    el.focus();
    el.setSelectionRange(pos, pos);
    el.scrollTop = Math.max(0, (lineIndex - 3) * 20);
  };

  const jumpToScene = (lineIndex: number) => jumpToLineIndex(lineIndex);

  const applyTemplate = (templateId: string) => {
    const tpl = SCRIPT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || !draft) return;
    if (
      draft.content.trim() &&
      !window.confirm("Replace current screenplay with this template?")
    ) {
      return;
    }
    setDraft({ ...draft, type: tpl.type, content: tpl.content });
    setDirty(true);
  };

  const handleImport = async (file: File) => {
    setImportError(null);
    setImportSummary(null);
    setImporting(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/creator/scripts/import-extract", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        sourceType?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not extract text from this file.");
      }
      if (!data.text?.trim()) {
        throw new Error("No readable screenplay text found in this file.");
      }

      const lower = file.name.toLowerCase();
      const sourceLabel =
        data.sourceType === "pdf" || lower.endsWith(".pdf")
          ? "Extracted screenplay text from PDF"
          : data.sourceType === "docx" || lower.endsWith(".docx")
            ? "Extracted screenplay text from Word document"
            : data.sourceType === "fdx" || lower.endsWith(".fdx")
              ? "Imported Final Draft (FDX) screenplay"
              : data.sourceType === "rtf" || lower.endsWith(".rtf")
                ? "Extracted screenplay text from RTF"
                : data.sourceType === "odt" || lower.endsWith(".odt")
                  ? "Extracted screenplay text from OpenDocument"
                  : null;

      const { text, fixes } = importScreenplayText(data.text, file.name);
      if (!text.trim()) {
        throw new Error(
          fixes[0] ||
            "Import produced no readable screenplay text. Try PDF, DOCX, FDX, Fountain, RTF, ODT, or plain text.",
        );
      }
      if (draft) {
        setDraft({ ...draft, content: text });
        setDirty(true);
        setImportSummary(
          [sourceLabel, ...fixes].filter((item): item is string => Boolean(item)).slice(0, 12),
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const editorSurface =
    studioTheme === "dark"
      ? "bg-slate-950 border-slate-800 text-slate-100"
      : "bg-[#faf8f5] border-slate-300 text-slate-900";

  const studioGridClass = focusMode
    ? "grid grid-cols-1 gap-3"
    : splitOutline
      ? "grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,240px)]"
      : "grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]";

  const readerContent = useMemo(() => draft?.content ?? "", [draft?.content]);

  const studioRoot = (
    <div className="creator-tool-studio space-y-4">
      {focusMode ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
          <span>Focus mode — side panels hidden</span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-orange-300 hover:bg-slate-800 hover:text-orange-200"
            onClick={() => setFocusMode(false)}
          >
            Exit focus
          </button>
        </div>
      ) : null}
      {!focusMode ? (
        <header className="storytime-plan-card p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
                Script Writing Studio
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
                {title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Professional screenplay workspace with industry formatting, scene navigation, import/export,
                PDF reader, and Story Time AI.{" "}
                {hasProject
                  ? "Save links your draft to breakdown, budget, and schedule in the project pipeline."
                  : "Link a project to connect production pipeline tools."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolViewButton
                onClick={() => setReaderOpen(true)}
                label="View screenplay"
                disabled={!draft?.content}
              />
              <ToolViewButton
                onClick={() => setScriptsViewOpen(true)}
                count={scripts.length}
                disabled={scripts.length === 0}
              />
              <span className="text-[11px] text-slate-400">
                {saving ? "Saving…" : dirty ? "Unsaved" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "Saved"}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-400">
            <span>{stats.words} words</span>
            <span>• {stats.scenes} scenes</span>
            <span>• ~{stats.pages} pages</span>
            <span>• ~{stats.estimatedRuntimeMinutes} min runtime</span>
            <span>• {stats.characters} characters</span>
          </div>
        </header>
      ) : null}

      <ToolSavedViewSheet
        open={scriptsViewOpen}
        onClose={() => setScriptsViewOpen(false)}
        title="Script library"
        subtitle="Switch scripts or preview saved screenplays."
      >
        <ScriptsSavedViewer
          scripts={scripts.map((s) => ({
            id: s.id,
            title: s.title,
            type: s.type,
            content: s.content,
          }))}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </ToolSavedViewSheet>

      <ScreenplayReader
        open={readerOpen}
        onClose={() => setReaderOpen(false)}
        title={draft?.title ?? "Screenplay"}
        content={readerContent}
        fontCss={fontCss}
      />

      <div className={studioGridClass}>
        {!focusMode ? (
          <aside className="creator-glass-panel creator-tool-studio-panel hidden lg:flex flex-col overflow-hidden lg:max-h-[calc(100vh-12rem)]">
            <div className="flex border-b border-slate-800 text-[10px]">
              {(["scenes", "characters", "outline"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 px-2 py-2 capitalize ${
                    sidebarTab === tab ? "bg-slate-800 text-orange-300" : "text-slate-400"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-2 py-2 border-b border-slate-800">
              <span className="text-[10px] text-slate-500">Library</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-slate-700 text-[10px] text-slate-100"
                onClick={() => createMutation.mutate()}
              >
                New
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <Skeleton className="h-10 bg-slate-800/60" />
              ) : scripts.length === 0 ? (
                <p className="p-2 text-[11px] text-slate-500">No scripts yet.</p>
              ) : (
                scripts.map((script) => (
                  <button
                    key={script.id}
                    type="button"
                    onClick={() => setSelectedId(script.id)}
                    className={`w-full text-left px-2 py-2 rounded-lg text-[11px] truncate ${
                      script.id === selected?.id
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    {script.title}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-800 p-2 max-h-[45%] overflow-y-auto text-[11px]">
              {sidebarTab === "scenes" &&
                scenes.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => jumpToScene(scene.lineIndex)}
                    className="w-full text-left py-1.5 px-1 rounded hover:bg-slate-800 text-slate-300"
                  >
                    <span className="text-orange-400/80">{scene.number}.</span> {scene.heading}
                  </button>
                ))}
              {sidebarTab === "characters" &&
                characters.map((ch) => (
                  <button
                    key={ch.name}
                    type="button"
                    onClick={() => setHighlightCharacter(ch.name === highlightCharacter ? null : ch.name)}
                    className={`w-full text-left py-1.5 px-1 rounded ${
                      highlightCharacter === ch.name ? "bg-orange-500/20 text-orange-200" : "hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <Users className="inline h-3 w-3 mr-1 opacity-60" />
                    {ch.name}
                    <span className="text-slate-500 ml-1">({ch.dialogueLines})</span>
                  </button>
                ))}
              {sidebarTab === "outline" && (
                <div className="space-y-2 text-slate-400">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Act structure</p>
                  {["Act One", "Act Two", "Act Three"].map((act, ai) => {
                    const chunk = Math.ceil(scenes.length / 3) || 1;
                    const actScenes = scenes.slice(ai * chunk, (ai + 1) * chunk);
                    return (
                      <div key={act}>
                        <p className="font-medium text-slate-300">{act}</p>
                        {actScenes.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => jumpToScene(s.lineIndex)}
                            className="block w-full text-left pl-2 py-0.5 hover:text-orange-300 truncate"
                          >
                            Sc.{s.number} {s.heading}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <section className="creator-tool-studio-panel min-w-0 space-y-2">
          {draft ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 lg:hidden">
                <label htmlFor="mobile-script-picker" className="sr-only">
                  Select script
                </label>
                <select
                  id="mobile-script-picker"
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className={creatorToolSelect("min-w-0 flex-1 text-xs")}
                  disabled={isLoading || scripts.length === 0}
                >
                  {scripts.length === 0 ? (
                    <option value="">No scripts yet</option>
                  ) : (
                    scripts.map((script) => (
                      <option key={script.id} value={script.id}>
                        {script.title || "Untitled script"}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 border-slate-700 text-[11px] text-slate-100"
                  onClick={() => createMutation.mutate()}
                >
                  New
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 shrink-0 text-[11px] text-slate-300"
                  onClick={() => setScriptsViewOpen(true)}
                  disabled={scripts.length === 0}
                >
                  Library
                </Button>
              </div>

              <div className="creator-tool-studio-toolbar rounded-xl border border-slate-800 bg-slate-900/60 px-2 py-2">
                <select
                  value={selectedElement}
                  onChange={(e) => handleElementSelect(e.target.value as ScreenplayElementType)}
                  title="Select a format to insert at the cursor"
                  className={creatorToolSelectSm("text-[10px]")}
                  disabled={!effectiveCanWrite}
                >
                  {(Object.keys(SCREENPLAY_ELEMENT_LABELS) as ScreenplayElementType[]).map((k) => (
                    <option key={k} value={k}>
                      {SCREENPLAY_ELEMENT_LABELS[k]}
                    </option>
                  ))}
                </select>
                <select
                  value={fontId}
                  onChange={(e) => setFontId(e.target.value)}
                  className={creatorToolSelectSm("text-[10px]")}
                >
                  {STUDIO_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.type}
                  onChange={(e) => {
                    setDraft({ ...draft, type: e.target.value });
                    setDirty(true);
                  }}
                  className={creatorToolSelectSm("text-[10px]")}
                >
                  <option value="FEATURE">Feature</option>
                  <option value="SHORT">Short</option>
                  <option value="EPISODE">Episode</option>
                  <option value="OTHER">Other</option>
                </select>
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 text-slate-300" onClick={() => setZoom((z) => Math.max(80, z - 10))}>
                    −
                  </Button>
                  <span className="text-[10px] text-slate-500 w-8 text-center">{zoom}%</span>
                  <Button size="sm" variant="ghost" className="h-7 text-slate-300" onClick={() => setZoom((z) => Math.min(140, z + 10))}>
                    +
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-slate-300" onClick={() => setStudioTheme((t) => (t === "dark" ? "light" : "dark"))}>
                    {studioTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={studioToggleButtonClass(focusMode)}
                    aria-pressed={focusMode}
                    aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
                    title={focusMode ? "Exit focus mode" : "Focus mode"}
                    onClick={() => setFocusMode((f) => !f)}
                  >
                    <Focus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={studioToggleButtonClass(splitOutline && !focusMode)}
                    aria-pressed={splitOutline && !focusMode}
                    aria-label={splitOutline ? "Hide pipeline panel" : "Show pipeline panel"}
                    title={focusMode ? "Exit focus mode to toggle pipeline panel" : splitOutline ? "Hide pipeline panel" : "Show pipeline panel"}
                    disabled={focusMode}
                    onClick={() => setSplitOutline((s) => !s)}
                  >
                    <Columns2 className="h-3.5 w-3.5" />
                  </Button>
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-slate-700 text-[10px] text-slate-100"
                      onClick={() => {
                        const menu = document.getElementById("tpl-menu");
                        menu?.classList.toggle("hidden");
                      }}
                    >
                      <LayoutTemplate className="h-3 w-3 mr-1" />
                      Template
                    </Button>
                    <div
                      id="tpl-menu"
                      className="hidden absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl"
                    >
                      {SCRIPT_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="block w-full text-left px-2 py-1.5 text-[10px] text-slate-200 hover:bg-slate-800 rounded"
                          onClick={() => {
                            applyTemplate(t.id);
                            document.getElementById("tpl-menu")?.classList.add("hidden");
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    ref={importRef}
                    type="file"
                    accept=".txt,.fountain,.fdx,.pdf,.docx,.rtf,.odt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImport(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-slate-700 text-[10px] text-slate-100"
                    disabled={importing}
                    onClick={() => importRef.current?.click()}
                  >
                    <FileUp className="h-3 w-3 mr-1" />
                    {importing ? "Importing…" : "Import"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-slate-700 text-[10px] text-slate-100"
                    onClick={() =>
                      downloadTextFile(
                        `${draft.title || "screenplay"}.fountain`,
                        exportAsFountain(draft.title, draft.content),
                      )
                    }
                  >
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-slate-700 text-[10px] text-slate-100"
                    onClick={() => setReaderOpen(true)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {importError ? (
                <p className="text-[10px] text-red-300">{importError}</p>
              ) : null}
              {importSummary?.length ? (
                <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-3 py-2 text-[11px] text-cyan-200">
                  Import repairs: {importSummary.join(" · ")}
                </div>
              ) : null}

              {hasProject && draft.id ? (
                <CollaborationPresenceBar
                  peers={collab.peers}
                  collaborators={collab.collaborators}
                  myColor={collab.myColor}
                  collaborationMode={collab.collaborationMode}
                  onModeChange={collab.setMode}
                  canWrite={collab.canWrite}
                />
              ) : null}

              {collab.remoteRevision && !dirty ? (
                <div className="rounded-lg border border-orange-800/50 bg-orange-950/30 px-3 py-2 text-[11px] text-orange-200 flex flex-wrap items-center gap-2">
                  <span>
                    {collab.remoteUpdatedBy ?? "A collaborator"} updated this screenplay.
                  </span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => collab.applyRemoteRevision()}
                  >
                    Load latest
                  </button>
                  <button type="button" className="text-slate-400" onClick={collab.dismissRemoteRevision}>
                    Dismiss
                  </button>
                </div>
              ) : null}

              {conflictMessage ? (
                <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-[11px] text-red-200 flex flex-wrap gap-2">
                  <span>{conflictMessage}</span>
                  <button
                    type="button"
                    className="underline"
                    onClick={async () => {
                      if (!draft?.id) return;
                      const res = await fetch(`/api/creator/scripts/${draft.id}`);
                      if (!res.ok) return;
                      const data = await res.json();
                      setDraft({
                        id: draft.id,
                        title: data.script.title,
                        type: draft.type,
                        content: data.script.content,
                      });
                      savedUpdatedAtRef.current = data.script.updatedAt;
                      setDirty(false);
                      setConflictMessage(null);
                    }}
                  >
                    Reload collaborator version
                  </button>
                </div>
              ) : null}

              <Input
                value={draft.title}
                onChange={(e) => {
                  if (!effectiveCanWrite) return;
                  setDraft({ ...draft, title: e.target.value });
                  setDirty(true);
                }}
                readOnly={!effectiveCanWrite}
                className="bg-slate-900 border-slate-700 text-sm text-white"
                placeholder="Script title"
              />

              <div
                className={`relative mx-auto w-full max-w-[60ch] rounded-2xl border px-2 py-3 sm:px-3 focus-within:border-orange-500 ${editorSurface}`}
              >
                {collab.peers.length > 0 ? (
                  <div className="pointer-events-none absolute right-2 top-2 z-10 space-y-1">
                    {collab.peers
                      .filter((p) => p.cursorLine > 0)
                      .slice(0, 4)
                      .map((peer) => (
                        <span
                          key={peer.userId}
                          className="block rounded px-1.5 py-0.5 text-[9px] font-medium text-white shadow"
                          style={{ backgroundColor: peer.color }}
                        >
                          {peer.displayName} · L{peer.cursorLine + 1}
                        </span>
                      ))}
                  </div>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={draft.content}
                  onChange={(e) => {
                    if (!effectiveCanWrite) return;
                    setDraft({ ...draft, content: e.target.value });
                    setDirty(true);
                    setIsTyping(true);
                    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = window.setTimeout(() => setIsTyping(false), 1200);
                  }}
                  onSelect={() => {
                    setIsTyping(true);
                    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
                    typingTimerRef.current = window.setTimeout(() => setIsTyping(false), 1200);
                  }}
                  readOnly={!effectiveCanWrite}
                  spellCheck
                  rows={20}
                  className={`w-full min-h-[65dvh] sm:min-h-[60dvh] lg:min-h-[min(50vh,420px)] border-0 bg-transparent px-0 outline-none focus:ring-0 resize-y whitespace-pre-wrap ${!effectiveCanWrite ? "opacity-90" : ""}`}
                  style={{
                    fontFamily: fontCss,
                    fontSize: `${(12 * zoom) / 100}pt`,
                    lineHeight: 1.2,
                    color: "inherit",
                  }}
                  placeholder="INT. LOCATION - DAY&#10;&#10;Action, CHARACTER, dialogue…"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {VA_QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-orange-500 hover:text-orange-300"
                      onClick={() => openCreatorVa(action.prompt)}
                    >
                      <Wand2 className="inline h-3 w-3 mr-0.5 opacity-70" />
                      {action.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-xs text-slate-100"
                    disabled={!dirty}
                    onClick={() => {
                      if (!selected) return;
                      setDraft({
                        id: selected.id,
                        title: selected.title,
                        type: selected.type || "FEATURE",
                        content: selected.content || "",
                      });
                      setDirty(false);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                    disabled={!draft.id || saving || !dirty}
                    onClick={persist}
                  >
                    Save now
                  </Button>
                  {hasProject && selected?.id ? (
                    <>
                      <Link
                        href={`/creator/projects/${projectId}/pre-production/script-breakdown`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-600 px-3 text-xs text-slate-100 hover:bg-slate-800"
                      >
                        Breakdown
                      </Link>
                      <Link
                        href={`/creator/projects/${projectId}/pre-production/budget-builder`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-600 px-3 text-xs text-slate-100 hover:bg-slate-800"
                      >
                        Budget
                      </Link>
                      <Link
                        href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
                        className="inline-flex h-8 items-center rounded-md border border-slate-600 px-3 text-xs text-slate-100 hover:bg-slate-800"
                      >
                        Schedule
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
              <BookOpen className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              Create a new script to open the writing studio.
            </div>
          )}
        </section>

        {splitOutline && !focusMode ? (
          <aside className="creator-glass-panel creator-tool-studio-panel hidden lg:flex flex-col overflow-hidden text-[11px] lg:max-h-[calc(100vh-12rem)]">
            <div className="flex border-b border-slate-800 text-[9px]">
              {(
                [
                  ["pipeline", "Pipeline"],
                  ["comments", "Comments"],
                  ["versions", "Versions"],
                  ["cards", "Cards"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRightPanelTab(id)}
                  className={`flex-1 px-1 py-2 ${
                    rightPanelTab === id ? "bg-slate-800 text-orange-300" : "text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {rightPanelTab === "pipeline" && (
                <>
                  <p className="font-medium text-slate-200">Production pipeline</p>
                  <p className="text-slate-500 leading-relaxed">
                    Write → Breakdown → Budget → Schedule
                  </p>
                  {hasProject && collab.collaborators.length > 0 ? (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                        Project team
                      </p>
                      <ul className="space-y-1">
                        {collab.collaborators.map((c) => (
                          <li key={c.userId} className="text-slate-400">
                            {c.displayName}
                            <span className="text-slate-600"> · {c.role}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="space-y-1 text-slate-400">
                    <p>Reading time: ~{stats.readingMinutes} min</p>
                    <p>Est. shoot days: ~{Math.max(1, Math.ceil(stats.scenes / 5))}</p>
                  </div>
                </>
              )}
              {rightPanelTab === "comments" && (
                <ScriptCommentsPanel
                  scriptId={draft?.id}
                  canComment={collab.canComment}
                  onJumpToLine={jumpToLineIndex}
                />
              )}
              {rightPanelTab === "versions" && (
                <ScriptVersionsPanel
                  scriptId={draft?.id}
                  canWrite={effectiveCanWrite}
                  onRestore={(content, label) => {
                    if (!draft || !window.confirm(`Restore "${label}"?`)) return;
                    setDraft({ ...draft, content });
                    setDirty(true);
                  }}
                />
              )}
              {rightPanelTab === "cards" && (
                <StoryCardsBoard
                  scriptId={draft?.id}
                  canWrite={effectiveCanWrite}
                  scenes={scenes}
                />
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );

  return studioRoot;
}
