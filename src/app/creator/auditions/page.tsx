"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BackButton } from "@/components/layout/back-button";
import { Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Audition = {
  id: string;
  roleName: string;
  description: string | null;
  status: string;
  createdAt: string;
  content: { title: string };
};

type ContentOption = { id: string; title: string };
type ProjectOption = { id: string; title: string };

export default function AuditionsPage() {
  const queryClient = useQueryClient();
  const { data: auditions, isLoading } = useQuery<Audition[]>({
    queryKey: ["creator-auditions"],
    queryFn: () => fetch("/api/auditions").then((r) => r.json()),
  });

  const { data: contents } = useQuery<ContentOption[]>({
    queryKey: ["creator-content-for-auditions"],
    queryFn: () =>
      fetch("/api/creator/content")
        .then((r) => r.json())
        .then((arr: { id: string; title: string }[]) => (Array.isArray(arr) ? arr : [])),
  });

  const { data: projectsResp } = useQuery<{ projects: ProjectOption[] }>({
    queryKey: ["creator-projects-for-auditions"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });
  const projects = projectsResp?.projects ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ projectId: "", roleName: "", description: "" });
  const [success, setSuccess] = useState("");

  const resolvedContentId = useMemo(() => {
    if (!form.projectId || !contents) return "";
    const project = projects.find((p) => p.id === form.projectId);
    if (!project) return "";
    const match = contents.find((c) => c.title === project.title);
    return match?.id ?? "";
  }, [form.projectId, contents, projects]);

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: resolvedContentId,
          roleName: form.roleName,
          description: form.description,
          status: "OPEN",
        }),
      });
      if (!res.ok) throw new Error("Failed to post audition");
      return res.json();
    },
    onSuccess: async () => {
      setShowForm(false);
      setForm({ projectId: "", roleName: "", description: "" });
      setSuccess("Audition posted.");
      setTimeout(() => setSuccess(""), 3000);
      await queryClient.invalidateQueries({ queryKey: ["creator-auditions"] });
    },
  });

  const canSubmit = !!resolvedContentId && !!form.roleName;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <BackButton fallback="/creator/dashboard" />
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-violet-500" />
            Auditions
          </h1>
          <p className="text-slate-400">Post casting calls and manage audition shortlists</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-sm font-medium"
        >
          <Megaphone className="w-4 h-4" />
          {showForm ? "Close form" : "Post audition"}
        </button>
      </div>

      {success && (
        <div className="mb-4 text-sm text-green-400 bg-green-500/10 border border-green-500/40 px-4 py-2 rounded-lg">
          {success}
        </div>
      )}

      {showForm && (
        <div className="mb-8 rounded-2xl bg-slate-900/70 border border-slate-700/70 p-5 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Project / production</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {form.projectId && !resolvedContentId && (
                <p className="text-[11px] text-amber-300 mt-1">
                  To post auditions for this project, first create a matching production in your content library
                  with the same title. This lets Story Time link casting to the final film.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Role name</label>
              <input
                value={form.roleName}
                onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))}
                placeholder="Lead, supporting, extra, etc."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Description / requirements</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white resize-none"
              placeholder="Key requirements, dates, location, rates, union/non-union, etc."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => postMutation.mutate()}
              disabled={!canSubmit || postMutation.isPending}
              className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {postMutation.isPending ? "Posting..." : "Post audition"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 bg-slate-800" />
          ))}
        </div>
      ) : auditions && auditions.length > 0 ? (
        <div className="space-y-4">
          {auditions.map((a) => (
            <div
              key={a.id}
              className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-violet-500/30 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{a.roleName}</h3>
                  <p className="text-sm text-orange-400 mt-0.5">for {a.content.title}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    a.status === "OPEN"
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : "bg-slate-700/50 border border-slate-600 text-slate-400"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              {a.description && (
                <p className="text-sm text-slate-400 mt-3 leading-relaxed">{a.description}</p>
              )}
              <p className="text-xs text-slate-500 mt-3">
                Posted {new Date(a.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No audition posts yet. Create one for your upcoming production.</p>
        </div>
      )}
    </div>
  );
}
