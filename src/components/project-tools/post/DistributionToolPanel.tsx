"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectStageControls } from "@/app/creator/projects/[projectId]/project-stage-controls";
import { mutationErrorMessage, projectToolFetch, projectToolQueryFn } from "@/lib/project-tool-fetch";

type DistributionSubmission = {
  id: string;
  target: string;
  status: string;
  createdAt?: string;
};

export function DistributionToolPanel({ projectId, title }: { projectId?: string; title: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [target, setTarget] = useState("STORY_TIME");
  const [actionError, setActionError] = useState("");

  const { data: deliveryData } = useQuery({
    queryKey: ["project-final-delivery", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/final-delivery`),
    enabled: hasProject,
  });

  const { data: subsData, isError: subsError } = useQuery({
    queryKey: ["project-distribution", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/distribution`),
    enabled: hasProject,
  });

  const delivery = deliveryData?.delivery as { status: string } | null;
  const submissions = (subsData?.submissions ?? []) as DistributionSubmission[];

  const createMutation = useMutation({
    mutationFn: async () => {
      return projectToolFetch<{ submission: DistributionSubmission }>(
        `/api/creator/projects/${projectId}/distribution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target }),
        },
      );
    },
    onMutate: () => setActionError(""),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["project-distribution", projectId] });
      if (target === "STORY_TIME" && projectId) {
        const submissionId = data.submission?.id;
        const qs = new URLSearchParams({ projectId });
        if (submissionId) qs.set("submissionId", submissionId);
        router.push(`/creator/upload?${qs.toString()}`);
      }
    },
    onError: (err) => setActionError(mutationErrorMessage(err, "Could not create submission")),
  });

  function openUpload(submissionId?: string) {
    if (!projectId) return;
    const qs = new URLSearchParams({ projectId });
    if (submissionId) qs.set("submissionId", submissionId);
    router.push(`/creator/upload?${qs.toString()}`);
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Track release targets, then complete the catalogue upload wizard to deliver your film.
        </p>
      </header>

      {draftId && (
        <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          Production wrap created a Story Time distribution draft. Continue with{" "}
          <button type="button" className="font-semibold underline" onClick={() => openUpload(draftId)}>
            catalogue upload
          </button>{" "}
          to choose platform data or upload your own files.
        </div>
      )}

      <div className="creator-glass-panel space-y-3 p-4">
        <p className="text-xs text-slate-400">Final delivery status: {delivery?.status ?? "—"}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
          >
            <option value="STORY_TIME">Story Time catalogue</option>
            <option value="FESTIVAL">Festival</option>
            <option value="OTHER">Other</option>
          </select>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => hasProject && createMutation.mutate()}
            disabled={createMutation.isPending || !hasProject}
          >
            {target === "STORY_TIME" ? "Start catalogue upload" : "Add submission"}
          </Button>
          {target === "STORY_TIME" && (
            <Button size="sm" variant="outline" className="border-white/15" onClick={() => openUpload()} disabled={!hasProject}>
              Open upload wizard
            </Button>
          )}
        </div>
        {actionError ? (
          <p className="flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="h-3.5 w-3.5" />
            {actionError}
          </p>
        ) : null}
        {subsError ? <p className="text-xs text-red-300">Could not load submissions. Refresh or check project access.</p> : null}
        <p className="text-[11px] leading-relaxed text-slate-500">
          Story Time catalogue opens the full upload flow where you choose platform prefill (script, cast, synopsis) or
          enter everything manually with your own files.
        </p>
      </div>

      <div className="creator-glass-panel space-y-2 p-3">
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">
            {!hasProject ? "Link a project above to manage distribution." : "No distribution submissions yet."}
          </p>
        ) : (
          submissions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <span className="text-sm text-slate-300">
                {s.target} · {s.status}
              </span>
              {s.target === "STORY_TIME" && (
                <button type="button" onClick={() => openUpload(s.id)} className="text-xs font-medium text-orange-300 hover:text-orange-200">
                  Continue upload →
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => openUpload()}
        className="creator-glass-panel block w-full p-4 text-left transition hover:border-orange-400/35"
      >
        <div className="mb-1 flex items-center gap-2">
          <Upload className="h-4 w-4 text-orange-300" />
          <h3 className="text-sm font-semibold text-white">Upload &amp; delivery wizard</h3>
        </div>
        <p className="text-xs text-slate-400">
          {hasProject
            ? "Deliver master video, metadata, script, and cast — import from your project tools or upload externally."
            : "Deliver final master and metadata to Story Time."}
        </p>
      </button>

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
