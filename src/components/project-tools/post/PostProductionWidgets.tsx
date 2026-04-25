"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStageControls } from "@/app/creator/projects/[projectId]/project-stage-controls";

async function uploadContentMediaFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { error?: string; publicUrl?: string };
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  if (!data.publicUrl) throw new Error("Upload did not return a file URL");
  return data.publicUrl;
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
  }[];

  const [fileUrl, setFileUrl] = useState("");
  const [type, setType] = useState("RAW_FOOTAGE");
  const [label, setLabel] = useState("");
  const [newSceneId, setNewSceneId] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const fileAccept =
    type === "POSTER"
      ? "image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
      : "video/*,image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf";

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/footage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileUrl: fileUrl.trim(),
          label: label || null,
          sceneId: newSceneId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
      setFileUrl("");
      setLabel("");
      setNewSceneId("");
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] }),
  });

  const rawCount = assets.filter((a) => a.type === "RAW_FOOTAGE").length;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Upload files (video, PDF, or images) to storage, or paste a direct link. Tag scenes when available.
        </p>
      </header>

      <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
        <CardContent className="pt-6 space-y-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
          >
            <option value="RAW_FOOTAGE">Raw footage</option>
            <option value="EDIT">Edit</option>
            <option value="TRAILER">Trailer</option>
            <option value="MASTER">Master</option>
            <option value="POSTER">Poster</option>
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              {uploadingFile ? "Uploading…" : "Choose file"}
              <input
                type="file"
                accept={fileAccept}
                className="hidden"
                disabled={uploadingFile || !hasProject}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploadingFile(true);
                  try {
                    const url = await uploadContentMediaFile(file);
                    setFileUrl(url);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setUploadingFile(false);
                  }
                }}
              />
            </label>
            <span className="text-[11px] text-slate-500">
              {type === "POSTER" ? "JPG/PNG/WebP/GIF/AVIF or PDF" : "Video, image, or PDF"}
            </span>
          </div>
          <Input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="Storage URL (filled after upload) or paste a direct https link"
            className="bg-slate-900 border-slate-700"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="bg-slate-900 border-slate-700"
          />
          {scenes.length > 0 && (
            <select
              value={newSceneId}
              onChange={(e) => setNewSceneId(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
            >
              <option value="">Scene (optional)</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  Sc. {s.number}
                  {s.heading ? ` — ${s.heading.slice(0, 40)}` : ""}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            disabled={!fileUrl.trim() || createMutation.isPending || !hasProject}
            onClick={() => hasProject && createMutation.mutate()}
          >
            Add asset
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {assets.length === 0 && !hasProject ? (
            <p className="text-sm text-slate-500">
              Link a project above to add and track footage assets.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Assets: {assets.length} (raw: {rawCount})
                </p>
                <select
                  value={listTypeFilter}
                  onChange={(e) => setListTypeFilter(e.target.value)}
                  className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                >
                  <option value="">All types</option>
                  <option value="RAW_FOOTAGE">Raw</option>
                  <option value="EDIT">Edit</option>
                  <option value="MASTER">Master</option>
                  <option value="TRAILER">Trailer</option>
                  <option value="POSTER">Poster</option>
                </select>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {assets.slice(0, 20).map((a) => (
                  <li key={a.id} className="rounded-lg bg-slate-900/80 border border-slate-800 px-2 py-2 space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">
                        {a.type} · {a.label || a.fileUrl.slice(0, 48)}
                      </span>
                    </div>
                    {hasProject && scenes.length > 0 && (
                      <select
                        value={a.sceneId ?? ""}
                        onChange={(e) =>
                          patchSceneMutation.mutate({
                            id: a.id,
                            sceneId: e.target.value || null,
                          })
                        }
                        className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white"
                      >
                        <option value="">No scene tag</option>
                        {scenes.map((s) => (
                          <option key={s.id} value={s.id}>
                            Sc. {s.number}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-distribution", projectId] }),
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

