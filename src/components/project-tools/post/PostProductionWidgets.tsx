"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStageControls } from "@/app/creator/projects/[projectId]/project-stage-controls";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  {
    value: "RAW_FOOTAGE",
    label: "Raw footage",
    hint: "Camera files / plates for editorial",
  },
  {
    value: "EDIT",
    label: "Edit / cut",
    hint: "Rough cuts for Edit Review",
  },
  {
    value: "TRAILER",
    label: "Trailer",
    hint: "Marketing trailer",
  },
  {
    value: "MASTER",
    label: "Master",
    hint: "Final delivery master",
  },
  {
    value: "POSTER",
    label: "Poster / still",
    hint: "Key art, stills, PDFs",
  },
] as const;

function typeLabel(type: string) {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type.replace(/_/g, " ");
}

export function FootageIngestion({
  projectId,
  title,
}: {
  projectId?: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [listTypeFilter, setListTypeFilter] = useState("");
  const { data: scenesData } = useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/scenes`).then((r) => r.json()),
    enabled: hasProject,
  });
  const scenes = (scenesData?.scenes ?? []) as { id: string; number: string; heading: string | null }[];

  const { data, isLoading } = useQuery({
    queryKey: ["project-footage", projectId, listTypeFilter],
    queryFn: () =>
      fetch(
        `/api/creator/projects/${projectId}/footage${listTypeFilter ? `?type=${encodeURIComponent(listTypeFilter)}` : ""}`,
      ).then((r) => r.json()),
    enabled: hasProject,
  });
  const assets = (data?.assets ?? []) as {
    id: string;
    type: string;
    label: string | null;
    fileUrl: string;
    sceneId: string | null;
    createdAt?: string;
  }[];

  const [type, setType] = useState("RAW_FOOTAGE");
  const [label, setLabel] = useState("");
  const [newSceneId, setNewSceneId] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fileAccept =
    type === "POSTER"
      ? "image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
      : "video/*,image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf";

  const createMutation = useMutation({
    mutationFn: async (payload: {
      type: string;
      fileUrl: string;
      label: string | null;
      sceneId?: string;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/footage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Could not add asset");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
      setLabel("");
      setNewSceneId("");
      setFormSuccess("Asset added to this project.");
      setFormError(null);
    },
    onError: (e) => {
      setFormError(e instanceof Error ? e.message : "Could not add asset");
      setFormSuccess(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/footage?id=${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Could not delete");
      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] });
    },
  });

  const patchSceneMutation = useMutation({
    mutationFn: async ({ id, sceneId }: { id: string; sceneId: string | null }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/footage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sceneId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] }),
  });

  const [promoteMessage, setPromoteMessage] = useState("");
  const promoteDailiesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/footage/promote-dailies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Promote failed");
      return json as { promoted: number; skipped: number; message?: string };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
      setPromoteMessage(
        result.message ??
          (result.promoted > 0
            ? `Imported ${result.promoted} approved dailies clip${result.promoted === 1 ? "" : "s"} as raw footage.`
            : "All approved dailies clips are already imported."),
      );
    },
    onError: (e) => setPromoteMessage((e as Error).message),
  });

  const counts = {
    total: assets.length,
    raw: assets.filter((a) => a.type === "RAW_FOOTAGE").length,
    edit: assets.filter((a) => a.type === "EDIT").length,
  };

  async function handleChooseFile(file: File | undefined) {
    if (!file || !hasProject) return;
    setUploadingFile(true);
    setUploadProgress(0);
    setFormError(null);
    setFormSuccess(null);
    try {
      const url = await uploadContentMediaViaApi(file, {
        onProgress: (pct) => setUploadProgress(pct),
      });
      const autoLabel = label.trim() || file.name.replace(/\.[^.]+$/, "") || null;
      await createMutation.mutateAsync({
        type,
        fileUrl: url,
        label: autoLabel,
        sceneId: newSceneId || undefined,
      });
      setUploadProgress(null);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFile(false);
      setUploadProgress(null);
    }
  }

  const selectedHint = TYPE_OPTIONS.find((t) => t.value === type)?.hint;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            One place for post media. Pick a category, choose a file — it uploads and lands in the
            list. Use <span className="text-slate-300">Edit / cut</span> for versions you want to
            review in Edit Review.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasProject ? (
            <Link
              href={`/creator/projects/${projectId}/post-production/editing-studio`}
              className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-200 hover:bg-orange-500/20"
            >
              Open Edit Review →
            </Link>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200 hover:bg-slate-800"
            disabled={!hasProject || promoteDailiesMutation.isPending}
            onClick={() => promoteDailiesMutation.mutate()}
            title="Copy approved / circle-take dailies into post as raw footage"
          >
            {promoteDailiesMutation.isPending ? "Importing…" : "Import approved dailies"}
          </Button>
        </div>
      </header>

      {promoteMessage ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {promoteMessage}
        </p>
      ) : null}

      <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
        <CardContent className="space-y-4 pt-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              1. What are you adding?
            </p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition",
                    type === opt.value
                      ? "border-orange-400/50 bg-orange-500/15 text-orange-100"
                      : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500",
                  )}
                >
                  <span className="block font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            {selectedHint ? (
              <p className="mt-2 text-[11px] text-slate-500">{selectedHint}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                2. Label (optional)
              </p>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Trailer v3, Scene 12 plates"
                className="bg-slate-900 border-slate-700"
              />
            </div>
            {scenes.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Scene tag (optional)
                </p>
                <select
                  value={newSceneId}
                  onChange={(e) => setNewSceneId(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
                >
                  <option value="">No scene</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sc. {s.number}
                      {s.heading ? ` — ${s.heading.slice(0, 40)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              3. Upload file
            </p>
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-4 py-8 text-center transition hover:border-orange-400/40 hover:bg-slate-900",
                (uploadingFile || !hasProject) && "pointer-events-none opacity-60",
              )}
            >
              {uploadingFile ? (
                <Loader2 className="h-6 w-6 animate-spin text-orange-300" />
              ) : (
                <Upload className="h-6 w-6 text-slate-400" />
              )}
              <span className="text-sm text-slate-200">
                {uploadingFile
                  ? uploadProgress != null
                    ? `Uploading ${Math.round(uploadProgress)}%…`
                    : "Uploading…"
                  : "Click to choose a file"}
              </span>
              <span className="text-[11px] text-slate-500">
                {type === "POSTER"
                  ? "JPG, PNG, WebP, GIF, AVIF, or PDF"
                  : "Video preferred as H.264 MP4 for browser playback · images & PDF also OK"}
              </span>
              <input
                type="file"
                accept={fileAccept}
                className="hidden"
                disabled={uploadingFile || !hasProject || createMutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void handleChooseFile(file);
                }}
              />
            </label>
          </div>

          {formError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {formError}
            </p>
          ) : null}
          {formSuccess ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {formSuccess}
              {type === "EDIT" && hasProject ? (
                <>
                  {" "}
                  <Link
                    href={`/creator/projects/${projectId}/post-production/editing-studio`}
                    className="underline hover:text-white"
                  >
                    Open in Edit Review
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel space-y-3 p-4">
          {!hasProject ? (
            <p className="text-sm text-slate-500">Link a project above to add and track footage.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Library · {counts.total} asset{counts.total === 1 ? "" : "s"}
                  {counts.raw || counts.edit
                    ? ` · ${counts.raw} raw · ${counts.edit} edit`
                    : ""}
                </p>
                <select
                  value={listTypeFilter}
                  onChange={(e) => setListTypeFilter(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                >
                  <option value="">All types</option>
                  <option value="RAW_FOOTAGE">Raw</option>
                  <option value="EDIT">Edit</option>
                  <option value="MASTER">Master</option>
                  <option value="TRAILER">Trailer</option>
                  <option value="POSTER">Poster</option>
                </select>
              </div>

              {assets.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No assets yet. Upload a file above to get started.
                </p>
              ) : (
                <ul className="space-y-2">
                  {assets.map((a) => (
                    <li
                      key={a.id}
                      className="group flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-100">
                          <span className="text-slate-500">{typeLabel(a.type)}</span>
                          {" · "}
                          {a.label || "Untitled"}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
                          {a.fileUrl.length > 64 ? `${a.fileUrl.slice(0, 64)}…` : a.fileUrl}
                        </p>
                      </div>

                      {scenes.length > 0 ? (
                        <select
                          value={a.sceneId ?? ""}
                          onChange={(e) =>
                            patchSceneMutation.mutate({
                              id: a.id,
                              sceneId: e.target.value || null,
                            })
                          }
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                        >
                          <option value="">No scene</option>
                          {scenes.map((s) => (
                            <option key={s.id} value={s.id}>
                              Sc. {s.number}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      {a.type === "EDIT" && hasProject ? (
                        <Link
                          href={`/creator/projects/${projectId}/post-production/editing-studio`}
                          className="text-[11px] text-orange-400 hover:underline"
                        >
                          Review
                        </Link>
                      ) : null}

                      <button
                        type="button"
                        title="Delete asset"
                        className="rounded p-1.5 text-slate-500 transition hover:bg-red-500/15 hover:text-red-300"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete “${a.label || typeLabel(a.type)}”? This removes it from the project${
                                a.type === "EDIT" ? " and any Edit Review session" : ""
                              }.`,
                            )
                          ) {
                            return;
                          }
                          deleteMutation.mutate(a.id, {
                            onError: (err) => {
                              alert(err instanceof Error ? err.message : "Delete failed");
                            },
                          });
                        }}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MusicScoring({
  projectId,
  title,
}: {
  projectId?: string;
  title: string;
}) {
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-music-selection", projectId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/music-selection`).then((r) => r.json()),
    enabled: hasProject,
  });
  const selections = (data?.selections ?? []) as {
    id: string;
    usage: string | null;
    notes: string | null;
    track?: { title: string };
  }[];

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Music selections for this project. Use the Story Time music library to add licensed
          tracks so music creators are credited and paid.
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-24 bg-slate-800/60" />
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
          {selections.length === 0 ? (
            <p className="text-sm text-slate-500">
              {!hasProject
                ? "Link a project above to manage music selections."
                : "No music selected. Use the music catalog to add tracks."}
            </p>
          ) : (
            selections.map((s) => (
              <div key={s.id} className="text-sm text-slate-300">
                {s.track?.title ?? "Track"} · {s.usage || "—"}
              </div>
            ))
          )}
        </div>
      )}

      <Link
        href="/creator/music"
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-orange-500/60 block text-sm text-slate-400"
      >
        Browse the Story Time music library to add songs to your film. Usage here ensures track
        owners are credited and compensated.
      </Link>
    </div>
  );
}

export function Distribution({
  projectId,
  title,
}: {
  projectId?: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;

  const { data: deliveryData } = useQuery({
    queryKey: ["project-final-delivery", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/final-delivery`).then((r) => r.json()),
    enabled: hasProject,
  });

  const { data: subsData } = useQuery({
    queryKey: ["project-distribution", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/distribution`).then((r) => r.json()),
    enabled: hasProject,
  });

  const delivery = deliveryData?.delivery as { status: string } | null;
  const submissions = (subsData?.submissions ?? []) as { id: string; target: string; status: string }[];

  const [target, setTarget] = useState("STORY_TIME");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/distribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["project-distribution", projectId] }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Prepare for release. Final delivery and distribution submissions.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
        <p className="text-xs text-slate-400">Final delivery: {delivery?.status ?? "—"}</p>
        <div className="flex gap-2 mt-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
          >
            <option value="STORY_TIME">Story Time</option>
            <option value="FESTIVAL">Festival</option>
            <option value="OTHER">Other</option>
          </select>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => hasProject && createMutation.mutate()}
            disabled={createMutation.isPending || !hasProject}
          >
            Add submission
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">
            {!hasProject ? "Link a project above to manage distribution." : "No distribution submissions yet."}
          </p>
        ) : (
          submissions.map((s) => (
            <div key={s.id} className="text-sm text-slate-300">
              {s.target} · {s.status}
            </div>
          ))
        )}
      </div>

      <Link
        href={hasProject && projectId ? `/creator/upload?projectId=${projectId}` : "/creator/upload"}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-orange-500/60 block"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Upload &amp; delivery</h3>
        <p className="text-xs text-slate-400">
          {hasProject
            ? "Open the catalogue wizard with this project linked for tracking."
            : "Deliver final master and metadata to Story Time."}
        </p>
      </Link>

      {hasProject && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <ProjectStageControls projectId={projectId} status="POST_PRODUCTION" phase="EDITING" />
        </div>
      )}
    </div>
  );
}

