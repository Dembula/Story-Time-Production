"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStageControls } from "@/app/creator/projects/[projectId]/project-stage-controls";

export function FootageIngestion({
  projectId,
  title,
}: {
  projectId?: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-footage", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/footage`).then((r) => r.json()),
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/footage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, fileUrl, label: label || null }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
      setFileUrl("");
      setLabel("");
    },
  });

  const rawCount = assets.filter((a) => a.type === "RAW_FOOTAGE").length;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Add footage assets (URLs). Associate with scene when available.
        </p>
      </header>

      <Card className="border-slate-800 bg-slate-950/70">
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
          </select>
          <Input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="File URL"
            className="bg-slate-900 border-slate-700"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="bg-slate-900 border-slate-700"
          />
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
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          {assets.length === 0 && !hasProject ? (
            <p className="text-sm text-slate-500">
              Link a project above to add and track footage assets.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">
                Assets: {assets.length} (raw: {rawCount})
              </p>
              <ul className="space-y-1 text-sm text-slate-300">
                {assets.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    {a.type} · {a.label || a.fileUrl.slice(0, 40)}
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

