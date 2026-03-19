"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Users, Clock, Film, ChevronDown, ChevronRight, CheckCircle, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  POST_PRODUCTION_TOOLS,
} from "@/lib/project-tools";

type ToolProgress = { toolId: string; phase: string; status: string; percent: number };

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
  genre: string | null;
  updatedAt: string;
  members: { id: string }[];
  projectToolProgress?: ToolProgress[];
  ideasCount?: number;
  isOriginal?: boolean;
};

type NetworkCreator = {
  id: string;
  name: string | null;
  image: string | null;
  following: boolean;
  connectionStatus?: string;
};

function toolHref(phase: string, toolSlug: string, projectId: string): string {
  const base = phase === "PRE_PRODUCTION" ? "/creator/pre" : phase === "PRODUCTION" ? "/creator/production" : "/creator/post";
  return `${base}/${toolSlug}?projectId=${projectId}`;
}

function ProjectRow({ project, defaultOpen = false }: { project: Project; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (defaultOpen && open && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [defaultOpen, open]);
  const progress = project.projectToolProgress ?? [];
  const progressMap = new Map(progress.map((p) => [p.toolId, p]));
  const ideasCount = project.ideasCount ?? 0;

  const updated = new Date(project.updatedAt);
  const stage = project.status || "DEVELOPMENT";
  const doneCount = progress.filter((p) => p.status === "COMPLETE").length + (ideasCount > 0 ? 1 : 0);
  const totalTools = PRE_PRODUCTION_TOOLS.length + PRODUCTION_TOOLS.length + POST_PRODUCTION_TOOLS.length;
  const progressPct = totalTools > 0 ? Math.round((doneCount / Math.max(totalTools, 1)) * 100) : 0;

  const renderSection = (
    title: string,
    tools: { id: string; label: string; toolSlug: string; phase: string }[]
  ) => {
    if (tools.length === 0) return null;
    return (
      <div className="mb-3 last:mb-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">{title}</p>
        <ul className="space-y-1">
          {tools.map((t) => {
            const prog = progressMap.get(t.id);
            const isIdeaLinked = t.id === "idea-development" && ideasCount > 0;
            const done = prog?.status === "COMPLETE" || isIdeaLinked;
            const inProgress = prog?.status === "IN_PROGRESS";
            const statusText = done ? "Done" : isIdeaLinked ? "Linked" : inProgress ? "In progress" : "Not started";
            const href = toolHref(t.phase, t.toolSlug, project.id);
            return (
              <li key={t.id}>
                <Link
                  href={href}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    {done ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : inProgress ? <Loader2 className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-spin" /> : <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                    {t.label}
                  </span>
                  <span className={`text-[11px] ${done ? "text-emerald-400" : isIdeaLinked ? "text-orange-400" : inProgress ? "text-amber-400" : "text-slate-500"}`}>
                    {statusText}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div ref={rowRef} id={`project-${project.id}`} className="storytime-section overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/[0.04]"
      >
        <div className="min-w-0 flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-white truncate">{project.title}</p>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-300">
                {stage}
              </span>
              <span className="rounded-full border border-white/8 bg-black/15 px-2 py-0.5 text-[10px] text-slate-400">
                {project.phase}
              </span>
              {project.isOriginal && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/40">
                  Original
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {project.genre || "Unspecified genre"} · Last edited {updated.toLocaleDateString()}
            </p>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {doneCount} done
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {project.members.length + 1} team member{project.members.length + 1 !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1 text-[11px] text-slate-400 w-32 shrink-0">
          <span className="self-end">{open ? "Hide" : "Show"} pipeline</span>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/8 bg-black/12 px-4 py-3">
          <p className="text-xs text-slate-500 mb-3">What’s been done — open a tool with this project linked:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderSection(
              "Pre-Production",
              PRE_PRODUCTION_TOOLS.map((t) => ({ id: t.id, label: t.label, toolSlug: t.toolSlug, phase: t.phase }))
            )}
            {renderSection(
              "Production",
              PRODUCTION_TOOLS.map((t) => ({ id: t.id, label: t.label, toolSlug: t.toolSlug, phase: t.phase }))
            )}
            {renderSection(
              "Post-Production",
              POST_PRODUCTION_TOOLS.map((t) => ({ id: t.id, label: t.label, toolSlug: t.toolSlug, phase: t.phase }))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreatorProjectsDashboardClient() {
  const searchParams = useSearchParams();
  const openProjectId = searchParams.get("openProject");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("FEATURE_FILM");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("");
  const [isCollaboration, setIsCollaboration] = useState(false);
  const [networkCreators, setNetworkCreators] = useState<NetworkCreator[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          logline,
          genre,
          isOriginal: true,
          isCollaboration,
          collaboratorIds: isCollaboration ? selectedCollaborators : [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      setCreating(false);
      setTitle("");
      setLogline("");
      setGenre("");
      setIsCollaboration(false);
      setSelectedCollaborators([]);
      queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
    },
  });

  const projects: Project[] = data?.projects ?? [];

  useEffect(() => {
    if (!creating || !isCollaboration) return;
    fetch("/api/network/creators")
      .then((r) => r.json())
      .then((d) => {
        const all: NetworkCreator[] = d.creators ?? [];
        const connected = all.filter(
          (c) =>
            (c.following || c.connectionStatus === "ACCEPTED") &&
            c.id !== (data?.meId ?? null)
        );
        setNetworkCreators(connected);
      })
      .catch(() => setNetworkCreators([]));
  }, [creating, isCollaboration]);

  const toggleCollaborator = (id: string) => {
    setSelectedCollaborators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            My Projects
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage all your films in one production pipeline. Open a project to move it from
            Pre-Production to Post-Production.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {creating && (
        <div className="storytime-section space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Create a new film project</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Working title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="e.g. The Last Light"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="storytime-select rounded-xl px-3 py-2"
              >
                <option value="SHORT_FILM">Short film</option>
                <option value="INDIE_FILM">Indie film</option>
                <option value="FEATURE_FILM">Feature film</option>
                <option value="TV_EPISODE">TV episode</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Logline</label>
              <input
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="One sentence that sells your film."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Genre</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="Drama, Sci-Fi, Thriller..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Collaboration</label>
              <button
                type="button"
                onClick={() => setIsCollaboration((v) => !v)}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition",
                  isCollaboration
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                    : "bg-white/[0.03] border-white/10 text-slate-300",
                ].join(" ")}
              >
                <span className="w-2 h-2 rounded-full border border-slate-500 bg-slate-900">
                  <span
                    className={[
                      "block w-full h-full rounded-full transition",
                      isCollaboration ? "bg-emerald-400" : "bg-transparent",
                    ].join(" ")}
                  />
                </span>
                {isCollaboration ? "Collaboration project" : "Solo project (you can still invite later)"}
              </button>
              <p className="text-[11px] text-slate-500">
                Mark this as a collaboration to make it easier to invite creators you follow from the Network to work on the film with you.
              </p>
            </div>
            {isCollaboration && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-400">
                  Add collaborators from your network
                </label>
                {networkCreators.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/12 px-3 py-2 text-[11px] text-slate-500">
                    You don&apos;t have any connected creators yet. Use the Network tab to follow
                    and connect with other creators – once a connection is accepted, you&apos;ll be
                    able to invite them here.
                  </p>
                ) : (
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/8 bg-black/12 px-2 py-2">
                    {networkCreators.map((c) => {
                      const active = selectedCollaborators.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCollaborator(c.id)}
                          className={[
                            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs border transition",
                            active
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                              : "bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/18",
                          ].join(" ")}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px]">
                            {c.name?.[0]?.toUpperCase() ?? "C"}
                          </span>
                          <span className="max-w-[120px] truncate">
                            {c.name ?? "Creator"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="border-white/10 text-slate-300"
              onClick={() => {
                setCreating(false);
                setTitle("");
                setLogline("");
                setGenre("");
              }}
            >
              Cancel
            </Button>
            <Button disabled={!title || !type || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating..." : "Create project"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 bg-white/[0.06]" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="storytime-empty-state p-8 text-center">
          <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-200 font-medium mb-1">No projects yet</p>
          <p className="text-sm text-slate-400 mb-4">
            Create your first film project to start using the full production pipeline.
          </p>
          <Button onClick={() => setCreating(true)} className="mx-auto flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              defaultOpen={project.id === openProjectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

