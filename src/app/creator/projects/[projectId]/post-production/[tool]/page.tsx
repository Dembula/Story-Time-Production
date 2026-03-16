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
  "music-scoring": "Music & Scoring",
  distribution: "Distribution",
};

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
  if (tool === "music-scoring") return <MusicScoring projectId={projectId} title={title} />;
  if (tool === "distribution") return <Distribution projectId={projectId} title={title} />;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Post-production workspace.</p>
      </header>
    </div>
  );
}

function FootageIngestion({ projectId, title }: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-footage", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/footage`).then((r) => r.json()),
    enabled: hasProject,
  });
  const assets = (data?.assets ?? []) as { id: string; type: string; label: string | null; fileUrl: string; sceneId: string | null }[];
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
        <p className="text-sm text-slate-400 mt-1">Add footage assets (URLs). Associate with scene when available.</p>
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
          <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="File URL" className="bg-slate-900 border-slate-700" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="bg-slate-900 border-slate-700" />
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={!fileUrl.trim() || createMutation.isPending || !hasProject} onClick={() => hasProject && createMutation.mutate()}>
            Add asset
          </Button>
        </CardContent>
      </Card>
      {isLoading ? <Skeleton className="h-32 bg-slate-800/60" /> : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          {assets.length === 0 && !hasProject ? (
            <p className="text-sm text-slate-500">Link a project above to add and track footage assets.</p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-2">Assets: {assets.length} (raw: {rawCount})</p>
              <ul className="space-y-1 text-sm text-slate-300">
                {assets.slice(0, 10).map((a) => (
                  <li key={a.id}>{a.type} · {a.label || a.fileUrl.slice(0, 40)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EditingStudio({ projectId, title }: { projectId: string; title: string }) {
  const queryClient = useQueryClient();
  const { data: reviewsData } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/reviews`).then((r) => r.json()),
  });
  const { data: footageData } = useQuery({
    queryKey: ["project-footage", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/footage?type=EDIT`).then((r) => r.json()),
  });
  const reviews = (reviewsData?.reviews ?? []) as { id: string; status: string; cutAssetId: string | null; notes: { body: string }[] }[];
  const edits = (footageData?.assets ?? []) as { id: string; label: string | null; fileUrl: string }[];
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Rough cuts and review sessions.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
        <p className="text-xs text-slate-400">Edit assets: {edits.length}</p>
        {edits.slice(0, 5).map((e) => (
          <div key={e.id} className="text-sm text-slate-300">{e.label || e.id} · <a href={e.fileUrl} target="_blank" rel="noreferrer" className="text-orange-400">Watch</a></div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
        <p className="text-xs text-slate-400">Reviews: {reviews.length}</p>
        {reviews.map((r) => (
          <div key={r.id} className="text-sm text-slate-300">Review {r.id.slice(0, 8)} · {r.status} · {r.notes?.length ?? 0} notes</div>
        ))}
      </div>
    </div>
  );
}

function SoundDesign({ projectId, title }: { projectId: string; title: string }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Sound design notes per scene. Use tasks or footage metadata for detailed tracking.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
        Track FX, ADR, and ambience per scene in your edit. Link to footage assets when ready.
      </div>
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
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Music selections for this project. Use the Story Time music library to add licensed tracks so music creators are credited and paid.
        </p>
      </header>
      {isLoading ? <Skeleton className="h-24 bg-slate-800/60" /> : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
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
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-orange-500/60 block text-sm text-slate-400"
      >
        Browse the Story Time music library to add songs to your film. Usage here ensures track owners are credited and compensated.
      </Link>
    </div>
  );
}

function VisualEffects({ projectId, title }: { projectId: string; title: string }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">VFX shot tracking. Use project tasks with department VFX or footage metadata.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
        Track VFX shots (PLANNED / IN_PROGRESS / DONE) via tasks or a dedicated board. Link to footage when available.
      </div>
    </div>
  );
}

function ColorGrading({ projectId, title }: { projectId: string; title: string }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Color grading status. Mark when complete and link master asset.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
        Use Final Cut Approval and Film Packaging to attach the graded master.
      </div>
    </div>
  );
}

function FinalSoundMix({ projectId, title }: { projectId: string; title: string }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Final sound mix checklist. Attach mix asset when complete.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
        Mark mix complete and add a MASTER or mix asset in Footage Ingestion when ready.
      </div>
    </div>
  );
}

function FinalCutApproval({ projectId, title }: { projectId: string; title: string }) {
  const queryClient = useQueryClient();
  const { data: reviewsData } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/reviews`).then((r) => r.json()),
  });
  const { data: deliveryData } = useQuery({
    queryKey: ["project-final-delivery", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/final-delivery`).then((r) => r.json()),
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
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Approve final cut and set delivery master.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
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

function FilmPackaging({ projectId, title }: { projectId: string; title: string }) {
  const { data } = useQuery({
    queryKey: ["project-footage", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/footage`).then((r) => r.json()),
  });
  const assets = (data?.assets ?? []) as { type: string; label: string | null }[];
  const required = ["MASTER", "POSTER", "TRAILER"] as const;
  const byType = (t: string) => assets.filter((a) => a.type === t).length;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Film packaging checklist. Use this to track that your master, marketing assets, subtitles, and delivery documents are ready before distribution.
        </p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
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
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
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
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">Prepare for release. Final delivery and distribution submissions.</p>
      </header>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
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
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
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
      <Link href="/creator/upload" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-orange-500/60 block">
        <h3 className="text-sm font-semibold text-white mb-1">Upload & delivery</h3>
        <p className="text-xs text-slate-400">Deliver final master and metadata to Story Time.</p>
      </Link>
      {hasProject && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <ProjectStageControls projectId={projectId!} status="POST_PRODUCTION" phase="EDITING" />
        </div>
      )}
    </div>
  );
}
