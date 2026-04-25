import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ModocFieldPopover } from "@/components/modoc";
import { useModocOptional } from "@/components/modoc/use-modoc";
import { parseScenesFromScreenplay } from "@/lib/scene-parser";

export interface ScriptWritingToolProps {
  projectId?: string;
  title?: string;
}

export function ScriptWritingTool({ projectId, title = "Script Writing" }: ScriptWritingToolProps) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    enabled: !!projectId,
    queryKey: ["project-script", projectId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/script`).then((r) => r.json()),
  });

  const { data: ideasData } = useQuery({
    enabled: !!projectId,
    queryKey: ["project-ideas", projectId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/ideas`).then((r) => r.json()),
  });

  const projectIdeas = (ideasData?.ideas ?? []) as Array<{
    id: string;
    title: string;
    logline: string | null;
    notes: string | null;
    genres: string | null;
  }>;
  const primaryIdea = projectIdeas[0];

  const modoc = useModocOptional();
  const [modocScriptOpen, setModocScriptOpen] = useState(false);

  const script = data?.script as
    | {
        id: string;
        title: string;
      }
    | undefined;

  const [scriptTitle, setScriptTitle] = useState("");
  const [content, setContent] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [contentHydrated, setContentHydrated] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      title?: string;
      content?: string;
      createNewVersion?: boolean;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/script`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save script");
      return res.json();
    },
    onSuccess: async (_data, variables) => {
      if (variables.title !== undefined) setSavedTitle(variables.title);
      if (variables.content !== undefined) setSavedContent(variables.content);
      queryClient.invalidateQueries({ queryKey: ["project-script", projectId] });
      if (variables.content !== undefined && projectId) {
        try {
          await fetch(`/api/creator/projects/${projectId}/scenes/sync-from-script`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ removeOrphans: false }),
          });
        } catch {
          /* Scene sync is best-effort (e.g. no slug lines yet). */
        }
        void queryClient.invalidateQueries({ queryKey: ["project-scenes", projectId] });
      }
    },
  });

  useEffect(() => {
    if (script?.title != null) {
      setScriptTitle(script.title);
      setSavedTitle(script.title);
    }
  }, [script?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setContentHydrated(false);
    (async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/script`);
      if (!res.ok) return;
      const json = await res.json();
      const latest = json.script?.versions?.[0];
      const next = (latest?.content as string) ?? "";
      if (!cancelled) {
        setContent(next);
        setSavedContent(next);
        setContentHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, script?.id]);

  const scriptDirty =
    contentHydrated &&
    (scriptTitle !== savedTitle || content !== savedContent);

  const detectedSceneCount = useMemo(() => parseScenesFromScreenplay(content).length, [content]);

  if (!projectId) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Select a project to start writing your screenplay.
          </p>
        </header>
      </div>
    );
  }

  if (!data && !script) {
    return <Skeleton className="h-64 bg-slate-800/60" />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Screenplay workspace — save when you are ready. Use &quot;Save new draft&quot; to keep a
            version history snapshot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400">
            {saveMutation.isPending ? "Saving…" : scriptDirty ? "Unsaved changes" : "Saved"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200 hover:bg-slate-800 text-[11px]"
            disabled={!scriptDirty || saveMutation.isPending}
            onClick={() => {
              setScriptTitle(savedTitle);
              setContent(savedContent);
            }}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white text-[11px]"
            disabled={!scriptDirty || saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({ title: scriptTitle, content })
            }
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({ content, createNewVersion: true })
            }
          >
            Save new draft
          </Button>
        </div>
      </header>

      <div className="space-y-3">
        <div className="space-y-1 max-w-md">
          <label className="text-xs text-slate-400">Script title</label>
          <Input
            value={scriptTitle}
            onChange={(e) => setScriptTitle(e.target.value)}
            className="bg-slate-900 border-slate-700 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500">
            Scene headings detected in this draft:{" "}
            <span className="font-medium text-slate-300">{detectedSceneCount}</span>
            {detectedSceneCount === 0 ? (
              <span className="text-slate-600"> (add lines starting with INT. or EXT.)</span>
            ) : (
              <span className="text-slate-600">
                {" "}
                — saving syncs them to Script Breakdown for this project.
              </span>
            )}
          </p>
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-slate-400">Screenplay</label>
            {modoc && (
              <button
                type="button"
                onClick={() => setModocScriptOpen(true)}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Bot className="w-3.5 h-3.5" />
                Get AI suggestions
              </button>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 text-[13px] font-mono text-slate-100 outline-none focus:border-orange-500 leading-relaxed"
            placeholder="INT. LOCATION - DAY&#10;&#10;Action lines, CHARACTER names, and dialogue..."
          />
        </div>
      </div>

      {modoc && modocScriptOpen && (
        <ModocFieldPopover
          open={true}
          onClose={() => setModocScriptOpen(false)}
          task="script"
          context={{
            title: scriptTitle || primaryIdea?.title,
            logline: primaryIdea?.logline ?? undefined,
            notesExcerpt: primaryIdea?.notes ? primaryIdea.notes.slice(0, 500) : undefined,
            scriptExcerpt: content.slice(0, 2500),
          }}
          onIncorporate={(text) => {
            setContent((prev) => (prev ? `${prev}\n\n${text}` : text));
            setModocScriptOpen(false);
          }}
          sectionLabel="script"
          projectId={projectId}
        />
      )}
    </div>
  );
}
