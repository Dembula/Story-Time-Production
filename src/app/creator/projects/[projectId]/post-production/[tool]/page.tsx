"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProjectStageControls } from "../../project-stage-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PostProductionToolPageProps {
  params: Promise<{ projectId: string; tool: string }>;
}

const LABELS: Record<string, string> = {
  "footage-ingestion": "Footage Ingestion",
  "editing-studio": "Editing Studio",
  "sound-design": "Sound Design",
  "music-scoring": "Music & Scoring",
  "visual-effects": "Visual Effects",
  "color-grading": "Color Grading",
  "final-sound-mix": "Final Sound Mix",
  "final-cut-approval": "Final Cut Approval",
  "film-packaging": "Film Packaging",
  distribution: "Distribution",
};

/** Shared task list for post departments (ties into the same project tasks API as production). */
function PostDepartmentTaskHub({
  projectId,
  department,
  blurb,
}: {
  projectId: string;
  department: string;
  blurb: string;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/tasks`).then((r) => r.json()),
    enabled: !!projectId,
  });
  const tasks = ((data?.tasks ?? []) as { id: string; title: string; status: string; department: string | null }[]).filter(
    (t) => (t.department || "") === department,
  );
  const [newTitle, setNewTitle] = useState("");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), department }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setNewTitle("");
    },
  });
  return (
    <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tasks ({department})</CardTitle>
        <p className="text-[11px] text-slate-500 font-normal">{blurb}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task…"
            className="bg-slate-900 border-slate-700 text-sm flex-1 min-w-[160px]"
          />
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            disabled={!newTitle.trim() || createMutation.isPending}
            onClick={() => newTitle.trim() && createMutation.mutate()}
          >
            Add
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 bg-slate-800/60" />
        ) : tasks.length === 0 ? (
          <p className="text-xs text-slate-500">No tasks yet for this department.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-300">
            {tasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-2 rounded-lg bg-slate-900/80 px-2 py-1">
                <span className="truncate">{t.title}</span>
                <span className="text-[10px] text-slate-500 shrink-0">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/creator/projects/${projectId}/production/on-set-tasks`}
          className="text-xs text-orange-400 hover:text-orange-300 inline-block"
        >
          Open full task board →
        </Link>
      </CardContent>
    </Card>
  );
}

export default function PostProductionToolPage({ params }: PostProductionToolPageProps) {
  const [resolved, setResolved] = useState<{ projectId: string; tool: string } | null>(null);

  // Next.js 15 hands params as a Promise
  useEffect(() => {
    let alive = true;
    void Promise.resolve(params).then((p) => {
      if (alive) setResolved(p);
    });
    return () => {
      alive = false;
    };
  }, [params]);

  const projectId = resolved?.projectId ?? "";
  const tool = resolved?.tool ?? "";
  const title = LABELS[tool] ?? "Post-Production Workspace";

  if (tool === "footage-ingestion") return <FootageIngestion projectId={projectId} title={title} />;
  if (tool === "editing-studio") return <EditingStudio projectId={projectId} title={title} />;
  if (tool === "sound-design") return <SoundDesign projectId={projectId} title={title} />;
  if (tool === "music-scoring") return <MusicScoring projectId={projectId} title={title} />;
  if (tool === "visual-effects") return <VisualEffects projectId={projectId} title={title} />;
  if (tool === "color-grading") return <ColorGrading projectId={projectId} title={title} />;
  if (tool === "final-sound-mix") return <FinalSoundMix projectId={projectId} title={title} />;
  if (tool === "final-cut-approval") return <FinalCutApproval projectId={projectId} title={title} />;
  if (tool === "film-packaging") return <FilmPackaging projectId={projectId} title={title} />;
  if (tool === "distribution") return <Distribution projectId={projectId} title={title} />;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Post-production workspace.</p>
      </header>
    </div>
  );
}

function FootageIngestion({ projectId, title }: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [listTypeFilter, setListTypeFilter] = useState<string>("");
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
  const assets = (data?.assets ?? []) as { id: string; type: string; label: string | null; fileUrl: string; sceneId: string | null }[];
  const [fileUrl, setFileUrl] = useState("");
  const [type, setType] = useState("RAW_FOOTAGE");
  const [label, setLabel] = useState("");
  const [newSceneId, setNewSceneId] = useState("");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/footage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fileUrl,
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
          Add footage assets (URLs). Filter by type, tag scenes for editing and dailies handoff.
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
          <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="File URL" className="bg-slate-900 border-slate-700" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="bg-slate-900 border-slate-700" />
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
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={!fileUrl.trim() || createMutation.isPending || !hasProject} onClick={() => hasProject && createMutation.mutate()}>
            Add asset
          </Button>
        </CardContent>
      </Card>
      {isLoading ? <Skeleton className="h-32 bg-slate-800/60" /> : (
        <div className="creator-glass-panel p-3 space-y-2">
          {assets.length === 0 && !hasProject ? (
            <p className="text-sm text-slate-500">Link a project above to add and track footage assets.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">Assets: {assets.length} (raw on screen: {rawCount})</p>
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

function EditingStudio({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const { data: reviewsData } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/reviews`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: footageData } = useQuery({
    queryKey: ["project-footage", projectId, "EDIT"],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/footage?type=EDIT`).then((r) => r.json()),
    enabled: hasProject,
  });
  const reviews = (reviewsData?.reviews ?? []) as { id: string; status: string; cutAssetId: string | null; notes: { body: string }[] }[];
  const edits = (footageData?.assets ?? []) as { id: string; label: string | null; fileUrl: string }[];
  if (!hasProject || !projectId) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">Link a project to manage edits and reviews.</p>
        </header>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Rough cuts and review sessions.</p>
      </header>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs text-slate-400">Edit assets: {edits.length}</p>
        {edits.slice(0, 5).map((e) => (
          <div key={e.id} className="text-sm text-slate-300">{e.label || e.id} · <a href={e.fileUrl} target="_blank" rel="noreferrer" className="text-orange-400">Watch</a></div>
        ))}
      </div>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs text-slate-400">Reviews: {reviews.length}</p>
        {reviews.map((r) => (
          <div key={r.id} className="text-sm text-slate-300">Review {r.id.slice(0, 8)} · {r.status} · {r.notes?.length ?? 0} notes</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <Link href={`/creator/projects/${projectId}/post-production/footage-ingestion`} className="text-orange-400 hover:underline">
          Footage ingestion →
        </Link>
        <Link href={`/creator/projects/${projectId}/post-production/final-cut-approval`} className="text-slate-400 hover:text-slate-200">
          Final cut approval →
        </Link>
      </div>
    </div>
  );
}

function SoundDesign({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Sound design, ADR, and FX. Track work with post tasks (department POST_SOUND) and scene-tagged footage.
        </p>
      </header>
      <div className="creator-glass-panel p-4 text-sm text-slate-400">
        Tag relevant clips in Footage Ingestion by scene. Use tasks below for milestones and handoffs.
      </div>
      {hasProject && projectId && (
        <PostDepartmentTaskHub
          projectId={projectId}
          department="POST_SOUND"
          blurb="Tasks here use department POST_SOUND so they stay separate from on-set departments."
        />
      )}
    </div>
  );
}

function MusicScoring({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-music-selection", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/music-selection`).then((r) => r.json()),
    enabled: hasProject,
  });
  const selections = (data?.selections ?? []) as { id: string; usage: string | null; notes: string | null; track?: { title: string } }[];
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Music selections for this project. Use the Story Time music library to add licensed tracks so music creators are credited and paid.
        </p>
      </header>
      {isLoading ? <Skeleton className="h-24 bg-slate-800/60" /> : (
        <div className="creator-glass-panel p-3 space-y-2">
          {selections.length === 0 ? (
            <p className="text-sm text-slate-500">
              {!hasProject ? "Link a project above to manage music selections." : "No music selected. Use the music catalog to add tracks."}
            </p>
          ) : (
            selections.map((s) => (
              <div key={s.id} className="text-sm text-slate-300">{s.track?.title ?? "Track"} · {s.usage || "—"}</div>
            ))
          )}
        </div>
      )}
      <Link
        href="/creator/music"
        className="creator-glass-panel block p-4 text-sm text-slate-400 transition hover:border-orange-400/35"
      >
        Browse the Story Time music library to add songs to your film. Usage here ensures track owners are credited and compensated.
      </Link>
    </div>
  );
}

function VisualEffects({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">VFX shot tracking via tasks (POST_VFX) and scene-linked footage.</p>
      </header>
      <div className="creator-glass-panel p-4 text-sm text-slate-400">
        Each task can represent a shot or vendor deliverable. Move status on the full task board when you are on set or in post.
      </div>
      {hasProject && projectId && (
        <PostDepartmentTaskHub
          projectId={projectId}
          department="POST_VFX"
          blurb="Use POST_VFX tasks for vendors, comps, and delivery dates."
        />
      )}
    </div>
  );
}

function ColorGrading({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Color grading status. Link graded masters in Footage Ingestion (MASTER).</p>
      </header>
      <div className="creator-glass-panel p-4 text-sm text-slate-400">
        Use Final Cut Approval and Film Packaging once the graded master is uploaded.
      </div>
      {hasProject && projectId && (
        <PostDepartmentTaskHub
          projectId={projectId}
          department="POST_COLOR"
          blurb="Track grading rounds, notes back to the colorist, and approval checkpoints."
        />
      )}
    </div>
  );
}

function FinalSoundMix({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Final sound mix checklist. Attach mix stems or master in Footage Ingestion.</p>
      </header>
      <div className="creator-glass-panel p-4 text-sm text-slate-400">
        Use POST_MIX tasks for mix reviews, deliverables, and final approvals.
      </div>
      {hasProject && projectId && (
        <PostDepartmentTaskHub
          projectId={projectId}
          department="POST_MIX"
          blurb="Final dub, M&E, and delivery-specific mix versions."
        />
      )}
    </div>
  );
}

function FinalCutApproval({ projectId, title }: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data: reviewsData } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/reviews`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: deliveryData } = useQuery({
    queryKey: ["project-final-delivery", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/final-delivery`).then((r) => r.json()),
    enabled: hasProject,
  });
  const reviews = (reviewsData?.reviews ?? []) as { id: string; status: string }[];
  const delivery = deliveryData?.delivery as { id: string; status: string; masterAssetId: string | null } | null;
  const approveMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/reviews`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId, status: "APPROVED" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] }),
  });
  if (!hasProject || !projectId) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">Link a project to manage reviews and delivery.</p>
        </header>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Approve final cut and set delivery master.</p>
      </header>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs text-slate-400">Delivery status: {delivery?.status ?? "—"}</p>
        {reviews.filter((r) => r.status !== "APPROVED").map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Review {r.id.slice(0, 8)}</span>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMutation.mutate(r.id)}>Approve</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilmPackaging({ projectId, title }: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const { data } = useQuery({
    queryKey: ["project-footage", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/footage`).then((r) => r.json()),
    enabled: hasProject,
  });
  const assets = (data?.assets ?? []) as { type: string; label: string | null }[];
  const required = ["MASTER", "POSTER", "TRAILER"] as const;
  const byType = (t: string) => assets.filter((a) => a.type === t).length;
  if (!hasProject || !projectId) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">Link a project to track packaging assets.</p>
        </header>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Film packaging checklist. Use this to track that your master, marketing assets, subtitles, and delivery documents are ready before distribution.
        </p>
      </header>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
          Picture &amp; marketing assets
        </p>
        {required.map((t) => (
          <div key={t} className="flex justify-between text-sm">
            <span className="text-slate-300">{t}</span>
            <span className={byType(t) > 0 ? "text-emerald-400" : "text-slate-500"}>
              {byType(t) > 0 ? "✓" : "—"}
            </span>
          </div>
        ))}
        <p className="text-xs text-slate-500 mt-2">
          Add assets in Footage Ingestion with the correct type (MASTER, TRAILER, POSTER).
        </p>
      </div>
      <div className="creator-glass-panel p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Packaging checklist</p>
        <ul className="space-y-1.5 text-sm text-slate-300">
          <li>• Subtitles / captions (English and required languages) prepared</li>
          <li>• Key art and artwork variants exported (poster, thumbnail, banner)</li>
          <li>• Synopsis, logline, and credits list finalized</li>
          <li>• Music cue sheet and sound reports ready</li>
          <li>• Legal &amp; delivery documents complete (contracts, licenses, releases)</li>
          <li>• Technical specs sheet confirmed (resolution, aspect ratio, audio format)</li>
        </ul>
        <p className="text-xs text-slate-500">
          Use this list as a guide to confirm everything is in place before moving to Distribution and Upload &amp; delivery.
        </p>
      </div>
    </div>
  );
}

function Distribution({ projectId, title }: { projectId?: string; title: string }) {
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
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Prepare for release. Final delivery and distribution submissions.</p>
      </header>
      <div className="creator-glass-panel p-3 space-y-2">
        <p className="text-xs text-slate-400">Final delivery: {delivery?.status ?? "—"}</p>
        <div className="flex gap-2 mt-2">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white">
            <option value="STORY_TIME">Story Time</option>
            <option value="FESTIVAL">Festival</option>
            <option value="OTHER">Other</option>
          </select>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => hasProject && createMutation.mutate()} disabled={createMutation.isPending || !hasProject}>Add submission</Button>
        </div>
      </div>
      <div className="creator-glass-panel p-3 space-y-2">
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">
            {!hasProject ? "Link a project above to manage distribution." : "No distribution submissions yet."}
          </p>
        ) : (
          submissions.map((s) => (
            <div key={s.id} className="text-sm text-slate-300">{s.target} · {s.status}</div>
          ))
        )}
      </div>
      <Link
        href={hasProject && projectId ? `/creator/upload?projectId=${projectId}` : "/creator/upload"}
        className="creator-glass-panel block p-4 transition hover:border-orange-400/35"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Upload &amp; delivery</h3>
        <p className="text-xs text-slate-400">
          {hasProject
            ? "Open the catalogue wizard with this project linked for tracking."
            : "Deliver final master and metadata to Story Time."}
        </p>
      </Link>
      {hasProject && (
        <div className="creator-glass-panel p-4">
          <ProjectStageControls projectId={projectId!} status="POST_PRODUCTION" phase="EDITING" />
        </div>
      )}
      {hasProject && projectId && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <Link href={`/creator/projects/${projectId}/post-production/final-cut-approval`} className="hover:text-orange-400">
            Final cut →
          </Link>
          <Link href={`/creator/projects/${projectId}/post-production/film-packaging`} className="hover:text-orange-400">
            Film packaging →
          </Link>
          <Link href={`/creator/projects/${projectId}/post-production/footage-ingestion`} className="hover:text-orange-400">
            Footage →
          </Link>
        </div>
      )}
    </div>
  );
}
