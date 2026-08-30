"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Circle,
  Copy,
  Download,
  FileDown,
  LayoutTemplate,
  Loader2,
  MonitorPlay,
  Palette,
  Plus,
  Save,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TreatmentAssetsPanel } from "./treatment-assets-panel";
import { TreatmentPresenter } from "./treatment-presenter";
import {
  TreatmentSlideCanvas,
  TreatmentSlideThumbnail,
} from "./treatment-slide-canvas";
import {
  adaptSlideToLayout,
  createImageElement,
  createShapeElement,
  createSlideFromTemplate,
  createTextElement,
  newId,
  nextElementZIndex,
  parseTreatmentDocument,
  placeAssetOnSlideDocument,
  TREATMENT_SLIDE_TEMPLATES,
  type TreatmentSlideTemplateId,
} from "@/lib/treatment-studio/document";
import {
  downloadTreatmentPdf,
  downloadTreatmentPptx,
} from "@/lib/treatment-studio/export-treatment";
import type {
  CreatorTreatmentRecord,
  TreatmentDocument,
  TreatmentElement,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "@/lib/treatment-studio/types";
import { cn } from "@/lib/utils";
import { ConfirmDeletePanel } from "@/components/ui/confirm-delete-panel";
import { CONFIRM_DELETE_TREATMENT } from "@/lib/confirm-delete";

const AUTO_SAVE_MS = 25_000;

const LAYOUT_OPTIONS: { id: TreatmentSlideLayout; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "content", label: "Content" },
  { id: "split", label: "Split" },
  { id: "image", label: "Full image" },
  { id: "references", label: "References" },
  { id: "blank", label: "Blank" },
];

const SLIDE_COLORS = [
  "#ffffff",
  "#f8fafc",
  "#0f172a",
  "#111827",
  "#1e293b",
  "#7c2d12",
  "#14532d",
  "#1e3a5f",
  "#4c1d95",
  "#fef3c7",
  "#fee2e2",
  "#ecfccb",
];

type TreatmentCreatorStudioProps = {
  projectId?: string;
  title?: string;
};

export function TreatmentCreatorStudio({
  projectId,
  title = "Treatment Creator",
}: TreatmentCreatorStudioProps) {
  const queryClient = useQueryClient();
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [newSlideMenuOpen, setNewSlideMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "pptx" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null);
  const [dropSlideIndex, setDropSlideIndex] = useState<number | null>(null);
  const slideDragDidMoveRef = useRef(false);
  const slideListRef = useRef<HTMLDivElement | null>(null);
  const dirtyRef = useRef(false);
  const localDocRef = useRef<TreatmentDocument | null>(null);
  const hydratedTreatmentKey = useRef<string | null>(null);

  const treatmentsKey = ["creator-treatments", projectId ?? "standalone"];

  const { data, isLoading } = useQuery({
    queryKey: treatmentsKey,
    queryFn: async () => {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const res = await fetch(`/api/creator/treatments${qs}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to load treatments");
      return j as { treatments: CreatorTreatmentRecord[] };
    },
  });

  const treatments = data?.treatments ?? [];
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);

  useEffect(() => {
    if (treatments.length === 0) {
      setSelectedTreatmentId(null);
      return;
    }
    if (!selectedTreatmentId || !treatments.some((t) => t.id === selectedTreatmentId)) {
      setSelectedTreatmentId(treatments[0].id);
    }
  }, [treatments, selectedTreatmentId]);

  const treatment =
    treatments.find((t) => t.id === selectedTreatmentId) ?? treatments[0] ?? null;

  const [docTitle, setDocTitle] = useState("");
  const [document, setDocument] = useState<TreatmentDocument | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!treatment) return;
    const key = `${treatment.id}:${treatment.updatedAt}`;
    if (dirtyRef.current) return;
    if (hydratedTreatmentKey.current === key) return;

    const parsed = parseTreatmentDocument(treatment.document);
    setDocTitle(treatment.title);
    setDocument(parsed);
    setUpdatedAt(treatment.updatedAt);
    localDocRef.current = parsed;
    hydratedTreatmentKey.current = key;
    setActiveSlideId((prev) => {
      if (prev && parsed.slides.some((s) => s.id === prev)) return prev;
      return parsed.slides[0]?.id ?? null;
    });
  }, [treatment]);

  const activeSlide = useMemo(() => {
    if (!document || !activeSlideId) return document?.slides[0] ?? null;
    return document.slides.find((s) => s.id === activeSlideId) ?? document.slides[0] ?? null;
  }, [document, activeSlideId]);

  const activeIndex = document?.slides.findIndex((s) => s.id === activeSlide?.id) ?? 0;

  const selectedElement = useMemo(() => {
    if (!activeSlide || !selectedElementId) return null;
    return activeSlide.elements.find((el) => el.id === selectedElementId) ?? null;
  }, [activeSlide, selectedElementId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Treatment",
          projectId: projectId ?? null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to create treatment");
      return j as { treatment: CreatorTreatmentRecord };
    },
    onSuccess: (result) => {
      if (result.treatment?.id) {
        dirtyRef.current = false;
        hydratedTreatmentKey.current = null;
        setSelectedTreatmentId(result.treatment.id);
      }
      void queryClient.invalidateQueries({ queryKey: treatmentsKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/creator/treatments/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_DELETE_TREATMENT }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to delete treatment");
      return id;
    },
    onSuccess: (deletedId) => {
      dirtyRef.current = false;
      hydratedTreatmentKey.current = null;
      setDocument(null);
      setDocTitle("");
      setUpdatedAt(null);
      const remaining = treatments.filter((t) => t.id !== deletedId);
      setSelectedTreatmentId(remaining[0]?.id ?? null);
      void queryClient.invalidateQueries({ queryKey: treatmentsKey });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      title?: string;
      document?: TreatmentDocument;
      expectedUpdatedAt?: string;
    }) => {
      if (!treatment) throw new Error("No treatment");
      const res = await fetch(`/api/creator/treatments/${treatment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Save failed");
      return j as { treatment: CreatorTreatmentRecord };
    },
    onSuccess: (result) => {
      dirtyRef.current = false;
      setUpdatedAt(result.treatment.updatedAt);
      hydratedTreatmentKey.current = `${result.treatment.id}:${result.treatment.updatedAt}`;
      setSaveState("saved");
      void queryClient.invalidateQueries({ queryKey: treatmentsKey });
    },
    onError: () => setSaveState("error"),
  });

  const persist = useCallback(
    async (overrides?: { title?: string; document?: TreatmentDocument }) => {
      if (!treatment) return;
      const nextDoc = overrides?.document ?? localDocRef.current;
      if (!nextDoc) return;
      setSaveState("saving");
      await saveMutation.mutateAsync({
        title: overrides?.title ?? docTitle,
        document: nextDoc,
        expectedUpdatedAt: updatedAt ?? undefined,
      });
    },
    [treatment, docTitle, updatedAt, saveMutation],
  );

  const markDirty = useCallback((next: TreatmentDocument) => {
    localDocRef.current = next;
    dirtyRef.current = true;
    if (treatment) {
      hydratedTreatmentKey.current = `${treatment.id}:`;
    }
    setDocument(next);
    setSaveState("idle");
  }, [treatment]);

  const updateSlide = useCallback(
    (slideId: string, patch: Partial<TreatmentSlide>) => {
      if (!document) return;
      const slides = document.slides.map((s) =>
        s.id === slideId ? { ...s, ...patch } : s,
      );
      markDirty({ ...document, slides });
    },
    [document, markDirty],
  );

  // Promote stray freeform boxes into Full image / Split heroes when needed.
  useEffect(() => {
    if (!activeSlide) return;
    if (activeSlide.layout !== "image" && activeSlide.layout !== "split") return;
    if (activeSlide.referenceIds[0]) return;
    const hasFreeform = activeSlide.elements.some(
      (el) => el.type === "image" && el.referenceId,
    );
    if (!hasFreeform) return;
    const adapted = adaptSlideToLayout(activeSlide, activeSlide.layout);
    updateSlide(activeSlide.id, adapted);
  }, [activeSlide, updateSlide]);

  const addSlide = useCallback(
    (templateId: TreatmentSlideTemplateId = "content") => {
      if (!document) return;
      const slide = createSlideFromTemplate(templateId);
      markDirty({ ...document, slides: [...document.slides, slide] });
      setActiveSlideId(slide.id);
      setSelectedElementId(null);
      setLayoutMenuOpen(false);
      setNewSlideMenuOpen(false);
    },
    [document, markDirty],
  );

  const duplicateSlide = useCallback(() => {
    if (!document || !activeSlide) return;
    const copy: TreatmentSlide = {
      ...activeSlide,
      id: newId(),
      title: activeSlide.title ? `${activeSlide.title} (copy)` : activeSlide.title,
      elements: activeSlide.elements.map((el) => ({ ...el, id: newId() })),
      referenceIds: [...activeSlide.referenceIds],
    };
    const idx = document.slides.findIndex((s) => s.id === activeSlide.id);
    const slides = [...document.slides];
    slides.splice(idx + 1, 0, copy);
    markDirty({ ...document, slides });
    setActiveSlideId(copy.id);
    setSelectedElementId(null);
  }, [document, activeSlide, markDirty]);

  const deleteSlide = useCallback(() => {
    if (!document || !activeSlide || document.slides.length <= 1) return;
    const slides = document.slides.filter((s) => s.id !== activeSlide.id);
    markDirty({ ...document, slides });
    setActiveSlideId(slides[Math.max(0, activeIndex - 1)]?.id ?? slides[0]?.id ?? null);
    setSelectedElementId(null);
  }, [document, activeSlide, activeIndex, markDirty]);

  const reorderSlides = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!document) return;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= document.slides.length || toIndex > document.slides.length) return;
      const slides = [...document.slides];
      const [moved] = slides.splice(fromIndex, 1);
      if (!moved) return;
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
      slides.splice(insertAt, 0, moved);
      markDirty({ ...document, slides });
      setActiveSlideId(moved.id);
      setSelectedElementId(null);
    },
    [document, markDirty],
  );

  const placeAssetOnSlide = useCallback(
    (
      assetId: string,
      x = 18,
      y = 18,
      options?: { toggle?: boolean },
    ) => {
      if (!document || !activeSlide) return;
      const result = placeAssetOnSlideDocument(activeSlide, assetId, {
        toggle: options?.toggle,
        x,
        y,
      });
      updateSlide(activeSlide.id, result.slide);
      setSelectedElementId(result.selectedElementId);
      setAssetsOpen(true);
    },
    [document, activeSlide, updateSlide],
  );

  const toggleReference = useCallback(
    (assetId: string) => {
      placeAssetOnSlide(assetId, 18, 18, { toggle: true });
    },
    [placeAssetOnSlide],
  );

  const changeSlideLayout = useCallback(
    (layout: TreatmentSlideLayout) => {
      if (!activeSlide) return;
      const adapted = adaptSlideToLayout(activeSlide, layout);
      updateSlide(activeSlide.id, adapted);
      setSelectedElementId(null);
      setLayoutMenuOpen(false);
    },
    [activeSlide, updateSlide],
  );

  const addPexelsAsset = useCallback(
    (
      imported: {
        storageUrl: string;
        storageRef: string;
        title: string;
        caption: string;
      },
      options?: { place?: boolean; x?: number; y?: number },
    ) => {
      if (!document || !activeSlide) return null;
      const assetId = newId();
      const asset = {
        id: assetId,
        type: "image" as const,
        url: imported.storageRef || imported.storageUrl,
        title: imported.title,
        caption: imported.caption,
        source: "pexels" as const,
        createdAt: new Date().toISOString(),
      };

      if (!options?.place) {
        markDirty({
          ...document,
          assets: [...document.assets, asset],
        });
        return assetId;
      }

      const result = placeAssetOnSlideDocument(activeSlide, assetId, {
        x: options.x,
        y: options.y,
      });
      markDirty({
        ...document,
        assets: [...document.assets, asset],
        slides: document.slides.map((s) =>
          s.id === activeSlide.id ? { ...s, ...result.slide } : s,
        ),
      });
      setSelectedElementId(result.selectedElementId);
      setAssetsOpen(true);
      return assetId;
    },
    [document, activeSlide, markDirty],
  );

  const dropPexelsOnSlide = useCallback(
    async (photoId: number, x: number, y: number) => {
      if (!document || !activeSlide) return;
      const { importPexelsPhotoClient } = await import("@/components/pexels/pexels-media-browser");
      const imported = await importPexelsPhotoClient(photoId);
      addPexelsAsset(imported, { place: true, x, y });
    },
    [document, activeSlide, addPexelsAsset],
  );

  const updateAssets = useCallback(
    (assets: TreatmentDocument["assets"]) => {
      if (!document) return;
      const ids = new Set(assets.map((a) => a.id));
      const slides = document.slides.map((slide) => ({
        ...slide,
        referenceIds: slide.referenceIds.filter((id) => ids.has(id)),
        elements: slide.elements.filter(
          (el) => !el.referenceId || ids.has(el.referenceId),
        ),
      }));
      markDirty({ ...document, assets, slides });
    },
    [document, markDirty],
  );

  const addTextBox = useCallback(() => {
    if (!activeSlide) return;
    const el = createTextElement({
      zIndex: nextElementZIndex(activeSlide.elements),
    });
    updateSlide(activeSlide.id, { elements: [...activeSlide.elements, el] });
    setSelectedElementId(el.id);
  }, [activeSlide, updateSlide]);

  const addShape = useCallback(
    (shape: "rect" | "ellipse") => {
      if (!activeSlide) return;
      const el = createShapeElement(shape, {
        zIndex: nextElementZIndex(activeSlide.elements),
      });
      updateSlide(activeSlide.id, { elements: [...activeSlide.elements, el] });
      setSelectedElementId(el.id);
    },
    [activeSlide, updateSlide],
  );

  const updateSelectedElement = useCallback(
    (patch: Partial<TreatmentElement>) => {
      if (!activeSlide || !selectedElementId) return;
      updateSlide(activeSlide.id, {
        elements: activeSlide.elements.map((el) =>
          el.id === selectedElementId ? { ...el, ...patch } : el,
        ),
      });
    },
    [activeSlide, selectedElementId, updateSlide],
  );

  const runExport = useCallback(
    async (format: "pdf" | "pptx") => {
      if (!document) return;
      setExporting(format);
      setDownloadMenuOpen(false);
      try {
        if (dirtyRef.current) {
          await persist();
        }
        const payload = {
          title: docTitle.trim() || "Untitled Treatment",
          document,
          projectId,
        };
        if (format === "pdf") {
          await downloadTreatmentPdf(payload);
        } else {
          await downloadTreatmentPptx(payload);
        }
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Export failed. Please try again.");
      } finally {
        setExporting(null);
      }
    },
    [document, docTitle, projectId, persist],
  );

  useEffect(() => {
    if (!treatment || !dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      if (dirtyRef.current) void persist();
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [document, docTitle, treatment, persist]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const goToSlideIndex = useCallback(
    (index: number) => {
      if (!document?.slides.length) return;
      const next = document.slides[Math.max(0, Math.min(document.slides.length - 1, index))];
      if (!next || next.id === activeSlideId) return;
      setActiveSlideId(next.id);
      setSelectedElementId(null);
      setNewSlideMenuOpen(false);
      setLayoutMenuOpen(false);
      setColorMenuOpen(false);
      setDownloadMenuOpen(false);
    },
    [document?.slides, activeSlideId],
  );

  // ↑ / ↓ (and PageUp / PageDown) cycle slides without clicking each thumbnail.
  useEffect(() => {
    if (presenting || !document?.slides.length) return;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest("[contenteditable='true']"));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToSlideIndex(activeIndex + 1);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToSlideIndex(activeIndex - 1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        goToSlideIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        goToSlideIndex(document.slides.length - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presenting, document?.slides.length, activeIndex, goToSlideIndex]);

  // Keep the active thumbnail visible in the left rail while arrowing through.
  useEffect(() => {
    if (!activeSlideId || !slideListRef.current) return;
    const node = slideListRef.current.querySelector(
      `[data-slide-thumb-id="${activeSlideId}"]`,
    );
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeSlideId]);

  if (isLoading) {
    return (
      <div className="treatment-studio-loading space-y-4 p-6">
        <Skeleton className="h-10 w-64 bg-slate-800" />
        <Skeleton className="h-[480px] w-full bg-slate-800/60" />
      </div>
    );
  }

  if (!treatment) {
    return (
      <div className="creator-tool-workspace">
        <header className="creator-tool-workspace-header">
          <p className="creator-tool-workspace-eyebrow">Pre-production workspace</p>
          <h2 className="creator-tool-workspace-title">{title}</h2>
          <p className="creator-tool-workspace-description">
            Build a professional pitch treatment with slides, references, and presentation mode —
            the step between your idea and screenplay.
          </p>
        </header>
        <div className="treatment-studio-empty flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 py-20 text-center">
          <p className="text-slate-300">Create your first treatment deck</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Add slides, upload visual references, and present to collaborators or investors.
          </p>
          <Button
            type="button"
            className="mt-6 bg-orange-500 text-white hover:bg-orange-600"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Treatment
          </Button>
          {createMutation.isError ? (
            <p className="mt-3 text-sm text-red-400">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Could not create treatment"}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!document || !activeSlide) return null;

  return (
    <>
      <div className="treatment-studio flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-black">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-3 py-2.5 md:px-4">
          <Link
            href={projectId ? `/creator/pre-production` : "/creator/pre-production"}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Back to pre-production"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <Input
            value={docTitle}
            onChange={(e) => {
              setDocTitle(e.target.value);
              dirtyRef.current = true;
              if (treatment) hydratedTreatmentKey.current = `${treatment.id}:`;
              setSaveState("idle");
            }}
            onBlur={() => {
              if (dirtyRef.current) void persist({ title: docTitle });
            }}
            className="h-8 max-w-[200px] border-0 bg-transparent text-sm font-medium text-white focus-visible:ring-0 md:max-w-xs"
          />

          {treatments.length > 1 ? (
            <select
              value={treatment.id}
              onChange={(e) => {
                if (dirtyRef.current) {
                  void persist().finally(() => {
                    dirtyRef.current = false;
                    hydratedTreatmentKey.current = null;
                    setSelectedTreatmentId(e.target.value);
                  });
                  return;
                }
                hydratedTreatmentKey.current = null;
                setSelectedTreatmentId(e.target.value);
              }}
              className="h-8 max-w-[160px] rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-slate-200"
              aria-label="Switch treatment"
            >
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || "Untitled"}
                </option>
              ))}
            </select>
          ) : null}

          <ConfirmDeletePanel
            variant="inline"
            label="Delete"
            confirmPhrase={CONFIRM_DELETE_TREATMENT}
            pending={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutateAsync(treatment.id)}
          />

          <span className="hidden text-xs text-slate-500 sm:inline">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : dirtyRef.current
                    ? "Unsaved changes"
                    : null}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5 md:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-slate-300 hover:text-white"
              onClick={addTextBox}
              title="Add text box"
            >
              <Type className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Text</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-slate-300 hover:text-white"
              onClick={() => addShape("rect")}
              title="Add rectangle"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-slate-300 hover:text-white"
              onClick={() => addShape("ellipse")}
              title="Add ellipse"
            >
              <Circle className="h-4 w-4" />
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-slate-300 hover:text-white"
                onClick={() => {
                  setColorMenuOpen((o) => !o);
                  setLayoutMenuOpen(false);
                }}
              >
                <Palette className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Page</span>
              </Button>
              {colorMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-white/10 bg-black p-2 shadow-xl">
                  <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-slate-500">
                    Slide background
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {SLIDE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        className={cn(
                          "h-6 w-6 rounded border border-white/20",
                          activeSlide.backgroundColor === color && "ring-2 ring-orange-400",
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          updateSlide(activeSlide.id, { backgroundColor: color });
                          setColorMenuOpen(false);
                        }}
                      />
                    ))}
                  </div>
                  <label className="mt-2 flex items-center gap-2 px-1 text-[10px] text-slate-400">
                    Custom
                    <input
                      type="color"
                      value={activeSlide.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        updateSlide(activeSlide.id, { backgroundColor: e.target.value })
                      }
                      className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-slate-300 hover:text-white"
                onClick={() => {
                  setLayoutMenuOpen((o) => !o);
                  setColorMenuOpen(false);
                }}
              >
                <LayoutTemplate className="mr-1.5 h-4 w-4" />
                Layout
              </Button>
              {layoutMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-white/10 bg-black py-1 shadow-xl">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        changeSlideLayout(opt.id);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-slate-300 hover:text-white"
              onClick={duplicateSlide}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Duplicate</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-slate-300 hover:text-red-300 disabled:opacity-40"
              disabled={document.slides.length <= 1}
              onClick={deleteSlide}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 border-white/15",
                assetsOpen && "bg-white/10 text-white",
              )}
              onClick={() => setAssetsOpen((o) => !o)}
            >
              Assets
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-white/15 text-slate-200"
                disabled={Boolean(exporting)}
                onClick={() => {
                  setDownloadMenuOpen((o) => !o);
                  setLayoutMenuOpen(false);
                  setColorMenuOpen(false);
                }}
              >
                {exporting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                {exporting === "pdf"
                  ? "PDF…"
                  : exporting === "pptx"
                    ? "PPTX…"
                    : "Download"}
              </Button>
              {downloadMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-white/10 bg-black py-1 shadow-xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    onClick={() => void runExport("pdf")}
                  >
                    <FileDown className="h-4 w-4 text-orange-300" />
                    <span>
                      <span className="block font-medium text-white">PDF</span>
                      <span className="text-[10px] text-slate-500">
                        Print-ready landscape slides
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                    onClick={() => void runExport("pptx")}
                  >
                    <FileDown className="h-4 w-4 text-sky-300" />
                    <span>
                      <span className="block font-medium text-white">PowerPoint</span>
                      <span className="text-[10px] text-slate-500">
                        Editable .pptx with layout &amp; images
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              className="h-8 bg-white text-black hover:bg-slate-200"
              onClick={() => {
                setSelectedElementId(null);
                // Heal accidental double-placements (same asset as freeform + layout hero).
                if (document) {
                  let changed = false;
                  const slides = document.slides.map((slide) => {
                    const seenFreeform = new Set<string>();
                    let elements = [...slide.elements]
                      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                      .filter((el) => {
                        if (el.type !== "image" || !el.referenceId) return true;
                        if (seenFreeform.has(el.referenceId)) {
                          changed = true;
                          return false;
                        }
                        seenFreeform.add(el.referenceId);
                        return true;
                      });
                    // Layout heroes win: drop freeform clones of referenceIds
                    if (
                      slide.layout === "image" ||
                      slide.layout === "split" ||
                      slide.layout === "references"
                    ) {
                      const refSet = new Set(slide.referenceIds);
                      const next = elements.filter((el) => {
                        if (el.type === "image" && el.referenceId && refSet.has(el.referenceId)) {
                          changed = true;
                          return false;
                        }
                        return true;
                      });
                      if (next.length !== elements.length) elements = next;
                    }
                    return { ...slide, elements };
                  });
                  if (changed) markDirty({ ...document, slides });
                }
                setPresenting(true);
              }}
            >
              <MonitorPlay className="mr-1.5 h-4 w-4" />
              Present
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => void persist()}
              disabled={saveMutation.isPending}
              title="Save treatment"
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              {saveMutation.isPending
                ? "Saving…"
                : saveState === "saved" && !dirtyRef.current
                  ? "Saved"
                  : "Save"}
            </Button>
          </div>
        </div>

        {selectedElement?.type === "text" ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Text</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Size
              <input
                type="number"
                min={12}
                max={96}
                value={selectedElement.fontSize ?? 28}
                onChange={(e) =>
                  updateSelectedElement({ fontSize: Number(e.target.value) || 28 })
                }
                className="h-7 w-16 rounded border border-white/10 bg-black/40 px-2 text-white"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Color
              <input
                type="color"
                value={selectedElement.color ?? "#0f172a"}
                onChange={(e) => updateSelectedElement({ color: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
            <select
              value={selectedElement.align ?? "left"}
              onChange={(e) =>
                updateSelectedElement({
                  align: e.target.value as "left" | "center" | "right",
                })
              }
              className="h-7 rounded border border-white/10 bg-black/40 px-2 text-xs text-white"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <select
              value={selectedElement.fontWeight ?? "600"}
              onChange={(e) => updateSelectedElement({ fontWeight: e.target.value })}
              className="h-7 rounded border border-white/10 bg-black/40 px-2 text-xs text-white"
            >
              <option value="400">Regular</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
            </select>
          </div>
        ) : null}

        {selectedElement?.type === "shape" ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Shape</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Fill
              <input
                type="color"
                value={selectedElement.fill ?? "#fb923c"}
                onChange={(e) => updateSelectedElement({ fill: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-36 shrink-0 flex-col border-r border-white/10 bg-black md:w-44">
            <div className="relative p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                onClick={() => setNewSlideMenuOpen((o) => !o)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Slide
              </Button>
              {newSlideMenuOpen ? (
                <div className="absolute left-2 right-2 top-full z-30 mt-1 max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-white/10 bg-black py-1 shadow-xl md:left-0 md:right-auto md:w-64">
                  <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                    Templates
                  </p>
                  {TREATMENT_SLIDE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-white/5"
                      onClick={() => addSlide(tpl.id)}
                    >
                      <span className="block text-xs font-medium text-white">{tpl.label}</span>
                      <span className="block text-[10px] text-slate-500">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div
              ref={slideListRef}
              className="flex-1 space-y-2 overflow-y-auto px-2 pb-4"
              onDragOver={(e) => {
                if (!draggingSlideId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!document || draggingSlideId == null || dropSlideIndex == null) {
                  setDraggingSlideId(null);
                  setDropSlideIndex(null);
                  return;
                }
                const fromIndex = document.slides.findIndex((s) => s.id === draggingSlideId);
                if (fromIndex >= 0) reorderSlides(fromIndex, dropSlideIndex);
                setDraggingSlideId(null);
                setDropSlideIndex(null);
              }}
            >
              <p className="px-0.5 pb-1 text-[9px] leading-relaxed uppercase tracking-wide text-slate-600">
                Hold & drag to reorder · ↑↓ to move
              </p>
              {document.slides.map((slide, i) => {
                const dropBefore =
                  dropSlideIndex === i &&
                  draggingSlideId != null &&
                  draggingSlideId !== slide.id;
                const dropAfter =
                  dropSlideIndex === document.slides.length &&
                  i === document.slides.length - 1 &&
                  draggingSlideId != null;
                return (
                  <div key={slide.id} data-slide-thumb-id={slide.id}>
                    <TreatmentSlideThumbnail
                      slide={slide}
                      assets={document.assets}
                      index={i}
                      active={slide.id === activeSlide.id}
                      projectId={projectId}
                      draggable={document.slides.length > 1}
                      dragging={draggingSlideId === slide.id}
                      dropBefore={dropBefore}
                      dropAfter={dropAfter}
                      onDragStart={(e) => {
                        slideDragDidMoveRef.current = false;
                        setDraggingSlideId(slide.id);
                        setDropSlideIndex(i);
                        e.dataTransfer.setData(
                          "application/x-treatment-slide",
                          slide.id,
                        );
                        if (e.currentTarget instanceof HTMLElement) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          e.dataTransfer.setDragImage(
                            e.currentTarget,
                            Math.min(24, rect.width / 2),
                            Math.min(16, rect.height / 2),
                          );
                        }
                      }}
                      onDragEnd={() => {
                        setDraggingSlideId(null);
                        setDropSlideIndex(null);
                      }}
                      onDragOver={(e) => {
                        if (!draggingSlideId || draggingSlideId === slide.id) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        slideDragDidMoveRef.current = true;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const before = e.clientY < rect.top + rect.height / 2;
                        setDropSlideIndex(before ? i : i + 1);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!document || !draggingSlideId) return;
                        const fromIndex = document.slides.findIndex(
                          (s) => s.id === draggingSlideId,
                        );
                        const toIndex =
                          dropSlideIndex ??
                          (() => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            return e.clientY < rect.top + rect.height / 2 ? i : i + 1;
                          })();
                        if (fromIndex >= 0) reorderSlides(fromIndex, toIndex);
                        setDraggingSlideId(null);
                        setDropSlideIndex(null);
                      }}
                      onClick={() => {
                        if (slideDragDidMoveRef.current) {
                          slideDragDidMoveRef.current = false;
                          return;
                        }
                        goToSlideIndex(i);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-black p-4 md:p-8">
            <div className="treatment-editor-stage w-full">
              <TreatmentSlideCanvas
                slide={activeSlide}
                assets={document.assets}
                aspectRatio={document.settings.aspectRatio}
                projectId={projectId}
                selectedElementId={selectedElementId}
                onFieldChange={(patch) => updateSlide(activeSlide.id, patch)}
                onElementsChange={(elements) => updateSlide(activeSlide.id, { elements })}
                onSelectElement={setSelectedElementId}
                onDropAsset={(assetId, x, y) => placeAssetOnSlide(assetId, x, y)}
                onDropPexels={(photoId, x, y) => dropPexelsOnSlide(photoId, x, y)}
                className="shadow-2xl"
              />
            </div>
            <p className="mt-4 max-w-xl text-center text-xs text-slate-500">
              Presentation preview — what you see is what Present shows
              {" · "}
              Slide {activeIndex + 1} of {document.slides.length}
              {activeSlide.layout !== "content" && activeSlide.layout !== "title"
                ? ` · ${LAYOUT_OPTIONS.find((l) => l.id === activeSlide.layout)?.label}`
                : ""}
              {" · "}↑↓ slides
              {activeSlide.layout === "image" || activeSlide.layout === "split"
                ? " · Click a library still for the hero"
                : activeSlide.layout === "references"
                  ? " · Click stills for the grid"
                  : " · Click text to edit · drag boxes to move"}
            </p>
          </main>

          {assetsOpen ? (
            <TreatmentAssetsPanel
              assets={document.assets}
              selectedReferenceIds={activeSlide.referenceIds}
              placedAssetIds={activeSlide.elements
                .map((el) => el.referenceId)
                .filter((id): id is string => Boolean(id))}
              onAssetsChange={updateAssets}
              onToggleReference={toggleReference}
              onAddPexels={(imported) => addPexelsAsset(imported, { place: false })}
              onClose={() => setAssetsOpen(false)}
              projectId={projectId}
            />
          ) : null}
        </div>
      </div>

      {presenting ? (
        <TreatmentPresenter
          document={document}
          initialIndex={activeIndex}
          projectId={projectId}
          onClose={() => {
            setPresenting(false);
            setSelectedElementId(null);
          }}
        />
      ) : null}
    </>
  );
}
