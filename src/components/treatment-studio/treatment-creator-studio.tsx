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
  Copy,
  LayoutTemplate,
  Loader2,
  MonitorPlay,
  MoreHorizontal,
  Plus,
  Trash2,
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
import { createSlide, newId, parseTreatmentDocument } from "@/lib/treatment-studio/document";
import type {
  CreatorTreatmentRecord,
  TreatmentDocument,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "@/lib/treatment-studio/types";
import { cn } from "@/lib/utils";

const AUTO_SAVE_MS = 25_000;

const LAYOUT_OPTIONS: { id: TreatmentSlideLayout; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "content", label: "Content" },
  { id: "split", label: "Split" },
  { id: "image", label: "Full image" },
  { id: "references", label: "References" },
  { id: "blank", label: "Blank" },
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
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [presenting, setPresenting] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirtyRef = useRef(false);
  const localDocRef = useRef<TreatmentDocument | null>(null);

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

  const treatment = data?.treatments?.[0] ?? null;

  const [docTitle, setDocTitle] = useState("");
  const [document, setDocument] = useState<TreatmentDocument | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!treatment) return;
    const parsed = parseTreatmentDocument(treatment.document);
    setDocTitle(treatment.title);
    setDocument(parsed);
    setUpdatedAt(treatment.updatedAt);
    localDocRef.current = parsed;
    if (!activeSlideId && parsed.slides[0]) {
      setActiveSlideId(parsed.slides[0].id);
    }
  }, [treatment, activeSlideId]);

  const activeSlide = useMemo(() => {
    if (!document || !activeSlideId) return document?.slides[0] ?? null;
    return document.slides.find((s) => s.id === activeSlideId) ?? document.slides[0] ?? null;
  }, [document, activeSlideId]);

  const activeIndex = document?.slides.findIndex((s) => s.id === activeSlide?.id) ?? 0;

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
    onSuccess: () => {
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
    setDocument(next);
    setSaveState("idle");
  }, []);

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

  const addSlide = useCallback(
    (layout: TreatmentSlideLayout = "content") => {
      if (!document) return;
      const slide = createSlide(layout);
      markDirty({ ...document, slides: [...document.slides, slide] });
      setActiveSlideId(slide.id);
      setLayoutMenuOpen(false);
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
    };
    const idx = document.slides.findIndex((s) => s.id === activeSlide.id);
    const slides = [...document.slides];
    slides.splice(idx + 1, 0, copy);
    markDirty({ ...document, slides });
    setActiveSlideId(copy.id);
  }, [document, activeSlide, markDirty]);

  const deleteSlide = useCallback(() => {
    if (!document || !activeSlide || document.slides.length <= 1) return;
    const slides = document.slides.filter((s) => s.id !== activeSlide.id);
    markDirty({ ...document, slides });
    setActiveSlideId(slides[Math.max(0, activeIndex - 1)]?.id ?? slides[0]?.id ?? null);
  }, [document, activeSlide, activeIndex, markDirty]);

  const toggleReference = useCallback(
    (assetId: string) => {
      if (!document || !activeSlide) return;
      const ids = activeSlide.referenceIds;
      const next = ids.includes(assetId)
        ? ids.filter((id) => id !== assetId)
        : [...ids, assetId];
      updateSlide(activeSlide.id, { referenceIds: next });
    },
    [document, activeSlide, updateSlide],
  );

  const updateAssets = useCallback(
    (assets: TreatmentDocument["assets"]) => {
      if (!document) return;
      markDirty({ ...document, assets });
    },
    [document, markDirty],
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
      <div className="treatment-studio flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#08080a]">
        {/* Top bar */}
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
              setSaveState("idle");
            }}
            onBlur={() => {
              if (dirtyRef.current) void persist({ title: docTitle });
            }}
            className="h-8 max-w-[200px] border-0 bg-transparent text-sm font-medium text-white focus-visible:ring-0 md:max-w-xs"
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

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-slate-300 hover:text-white"
                onClick={() => setLayoutMenuOpen((o) => !o)}
              >
                <LayoutTemplate className="mr-1.5 h-4 w-4" />
                Layout
              </Button>
              {layoutMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-white/10 bg-[#141416] py-1 shadow-xl">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        updateSlide(activeSlide.id, { layout: opt.id });
                        setLayoutMenuOpen(false);
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

            <Button
              type="button"
              size="sm"
              className="h-8 bg-white text-black hover:bg-slate-200"
              onClick={() => setPresenting(true)}
            >
              <MonitorPlay className="mr-1.5 h-4 w-4" />
              Present
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500"
              onClick={() => void persist()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Slide navigator */}
          <aside className="flex w-36 shrink-0 flex-col border-r border-white/10 bg-[#0a0a0c] md:w-44">
            <div className="p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
                onClick={() => addSlide("content")}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Slide
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-4">
              {document.slides.map((slide, i) => (
                <TreatmentSlideThumbnail
                  key={slide.id}
                  slide={slide}
                  assets={document.assets}
                  index={i}
                  active={slide.id === activeSlide.id}
                  onClick={() => setActiveSlideId(slide.id)}
                />
              ))}
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#050506] p-4 md:p-8">
            <TreatmentSlideCanvas
              slide={activeSlide}
              assets={document.assets}
              aspectRatio={document.settings.aspectRatio}
              onFieldChange={(patch) => updateSlide(activeSlide.id, patch)}
            />
            <p className="mt-4 text-center text-xs text-slate-500">
              Slide {activeIndex + 1} of {document.slides.length}
              {activeSlide.layout !== "content" && activeSlide.layout !== "title"
                ? ` · ${LAYOUT_OPTIONS.find((l) => l.id === activeSlide.layout)?.label} layout`
                : ""}
            </p>
          </main>

          {assetsOpen ? (
            <TreatmentAssetsPanel
              assets={document.assets}
              selectedReferenceIds={activeSlide.referenceIds}
              onAssetsChange={updateAssets}
              onToggleReference={toggleReference}
              onClose={() => setAssetsOpen(false)}
            />
          ) : null}
        </div>
      </div>

      {presenting ? (
        <TreatmentPresenter
          document={document}
          initialIndex={activeIndex}
          onClose={() => setPresenting(false)}
        />
      ) : null}
    </>
  );
}
