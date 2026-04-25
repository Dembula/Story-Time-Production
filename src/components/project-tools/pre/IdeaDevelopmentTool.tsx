import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModocFieldPopover } from "@/components/modoc";
import { useModocOptional } from "@/components/modoc/use-modoc";

export interface IdeaDevelopmentToolProps {
  projectId?: string;
  title?: string;
}

export function IdeaDevelopmentTool({
  projectId,
  title = "Idea Development",
}: IdeaDevelopmentToolProps) {
  const queryClient = useQueryClient();

  const hasProject = !!projectId;

  const listQueryKey = hasProject
    ? ["project-ideas", projectId]
    : (["creator-ideas"] as const);
  const listEndpoint = hasProject
    ? `/api/creator/projects/${projectId}/ideas`
    : "/api/creator/ideas";

  const { data, isLoading } = useQuery({
    enabled: true,
    queryKey: listQueryKey,
    queryFn: () => fetch(listEndpoint).then((r) => r.json()),
  });

  const ideas = (data?.ideas ?? []) as {
    id: string;
    title: string;
    logline: string | null;
    notes: string | null;
    genres: string | null;
    convertedToProject: boolean;
    updatedAt: string;
  }[];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => ideas.find((i) => i.id === selectedId) ?? ideas[0],
    [ideas, selectedId]
  );

  useEffect(() => {
    if (!selectedId && ideas.length > 0) {
      setSelectedId(ideas[0].id);
    }
  }, [ideas, selectedId]);

  const [draft, setDraft] = useState<{
    id?: string;
    title: string;
    logline: string;
    notes: string;
    genres: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const modoc = useModocOptional();
  const [modocFieldOpen, setModocFieldOpen] = useState<"logline" | "idea_notes" | null>(null);

  useEffect(() => {
    if (selected) {
      setDraft({
        id: selected.id,
        title: selected.title,
        logline: selected.logline ?? "",
        notes: selected.notes ?? "",
        genres: selected.genres ?? "",
      });
      setDirty(false);
    } else {
      setDraft(null);
      setDirty(false);
    }
  }, [selected?.id]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(listEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New idea" }),
      });
      if (!res.ok) throw new Error("Failed to create idea");
      return res.json();
    },
    onSuccess: (result: any) => {
      const created = result?.idea as
        | {
            id: string;
            title: string;
            logline: string | null;
            notes: string | null;
            genres: string | null;
          }
        | undefined;

      if (created?.id) {
        setSelectedId(created.id);
      }

      queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
    onError: () => {
      // Basic feedback so users are not stuck when something goes wrong
      // You can replace this with a toast component if available in the design system.
      // eslint-disable-next-line no-alert
      alert("We couldn't create a new idea. Please try again.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title?: string;
      logline?: string;
      notes?: string;
      genres?: string;
      convert?: boolean;
    }) => {
      const res = await fetch(listEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payload.id,
          title: payload.title,
          logline: payload.logline,
          notes: payload.notes,
          genres: payload.genres,
          convertedToProject: payload.convert ?? false,
          syncToProjectMeta: payload.convert ?? false,
        }),
      });
      if (!res.ok) throw new Error("Failed to save idea");
      return res.json();
    },
    onSuccess: () => {
      setDirty(false);
    },
    onSettled: () => {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Vault for film ideas, loglines, notes, moodboards, and genres.{" "}
            {hasProject
              ? "Convert the strongest ideas into the project’s core metadata."
              : "Link a project above any time to sync your strongest ideas into that project’s metadata."}
          </p>
        </div>
        <Button
          variant="outline"
          className="border-slate-700 text-slate-200 hover:bg-slate-800"
          onClick={() => createMutation.mutate()}
        >
          New idea
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          <p className="text-xs text-slate-400">Idea vault</p>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-10 bg-slate-800/60" />
                <Skeleton className="h-10 bg-slate-800/60" />
              </div>
            ) : ideas.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                No ideas yet. Start by creating a new concept for this film.
              </div>
            ) : (
              <ul className="p-2 space-y-1 text-xs">
                {ideas.map((idea) => (
                  <li key={idea.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(idea.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition ${
                        idea.id === selected?.id
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px]">{idea.title}</span>
                        {idea.convertedToProject && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
                            In project
                          </span>
                        )}
                      </div>
                      {idea.genres && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {idea.genres}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          {draft ? (
            <Card className="border-slate-800 bg-slate-950/70 text-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-3">
                  <span>Idea details</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {saving ? "Saving..." : dirty ? "Unsaved changes" : "Saved"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Idea title</label>
                  <Input
                    value={draft.title}
                    onChange={(e) => {
                      setDraft({ ...draft, title: e.target.value });
                      setDirty(true);
                    }}
                    placeholder="e.g. The Last Light"
                    className="bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-400">Logline</label>
                    {modoc && (
                      <button
                        type="button"
                        onClick={() => setModocFieldOpen("logline")}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Get AI insights
                      </button>
                    )}
                  </div>
                  <textarea
                    value={draft.logline}
                    onChange={(e) => {
                      setDraft({ ...draft, logline: e.target.value });
                      setDirty(true);
                    }}
                    rows={2}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 resize-none"
                    placeholder="One sentence that sells this idea."
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-400">Idea notes</label>
                    {modoc && (
                      <button
                        type="button"
                        onClick={() => setModocFieldOpen("idea_notes")}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Get AI pointers
                      </button>
                    )}
                  </div>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => {
                      setDraft({ ...draft, notes: e.target.value });
                      setDirty(true);
                    }}
                    rows={5}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                    placeholder="Tone, themes, world, characters, visual ideas..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Genres / tags</label>
                  <Input
                    value={draft.genres}
                    onChange={(e) => {
                      setDraft({ ...draft, genres: e.target.value });
                      setDirty(true);
                    }}
                    placeholder="Drama, Sci-Fi, Thriller..."
                    className="bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Converting will sync the title, logline, and genre into the main
                    project metadata.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-xs text-slate-100"
                      disabled={!draft.id || saving || !dirty}
                      onClick={() => {
                        if (!draft.id) return;
                        setSaving(true);
                        saveMutation.mutate({
                          id: draft.id,
                          title: draft.title,
                          logline: draft.logline,
                          notes: draft.notes,
                          genres: draft.genres,
                        });
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                      disabled={!draft.id || saving}
                      onClick={() => {
                        if (!draft.id) return;
                        setSaving(true);
                        saveMutation.mutate({
                          id: draft.id,
                          title: draft.title,
                          logline: draft.logline,
                          notes: draft.notes,
                          genres: draft.genres,
                          convert: true,
                        });
                      }}
                    >
                      Convert to project details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
              Select an idea on the left or create a new one.
            </div>
          )}
        </div>
      </div>

      {modoc && draft && modocFieldOpen === "logline" && (
        <ModocFieldPopover
          open={true}
          onClose={() => setModocFieldOpen(null)}
          task="logline"
          context={{ title: draft.title, logline: draft.logline }}
          onIncorporate={(text) => {
            setDraft((d) => (d ? { ...d, logline: text } : null));
            setDirty(true);
            setModocFieldOpen(null);
          }}
          sectionLabel="logline"
        />
      )}
      {modoc && draft && modocFieldOpen === "idea_notes" && (
        <ModocFieldPopover
          open={true}
          onClose={() => setModocFieldOpen(null)}
          task="idea_notes"
          context={{
            title: draft.title,
            logline: draft.logline,
            notesExcerpt: draft.notes.slice(0, 600),
          }}
          onIncorporate={(text) => {
            setDraft((d) => (d ? { ...d, notes: d.notes ? `${d.notes}\n\n${text}` : text } : null));
            setDirty(true);
            setModocFieldOpen(null);
          }}
          sectionLabel="idea notes"
        />
      )}
    </div>
  );
}

