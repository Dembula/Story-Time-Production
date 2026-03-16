import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ModocFieldPopover } from "@/components/modoc";
import { useModocOptional } from "@/components/modoc/use-modoc";

export interface ScriptWritingToolProps {
  projectId?: string;
  title?: string;
}

export function ScriptWritingTool({ projectId, title = "Script Writing" }: ScriptWritingToolProps) {
  const queryClient = useQueryClient();

  // #region agent log
  fetch("http://127.0.0.1:7661/ingest/e765b01c-cec5-485d-8f2c-447ed6fafc98", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "d1fe7d",
    },
    body: JSON.stringify({
      sessionId: "d1fe7d",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "ScriptWritingTool.tsx:line18",
      message: "ScriptWritingTool mount",
      data: { hasProjectId: !!projectId },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

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

  const [scriptTitle, setScriptTitle] = useState(script?.title ?? "Screenplay");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

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
    onSettled: () => {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["project-script", projectId] });
    },
  });

  useEffect(() => {
    if (script?.title) {
      setScriptTitle(script.title);
    }
  }, [script?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/script`);
      if (!res.ok) return;
      const json = await res.json();
      const latest = json.script?.versions?.[0];
      if (!cancelled && latest?.content) {
        setContent(latest.content as string);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!content || !projectId) return;
    setSaving(true);
    const timeout = setTimeout(() => {
      saveMutation.mutate({ content });
    }, 1200);
    return () => clearTimeout(timeout);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Select a project to start writing and autosaving your screenplay.
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
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Screenplay workspace with screenplay-style text and automatic draft
            saving while you type.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] text-slate-400">
            {saving ? "Saving..." : "Auto-saved"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
            onClick={() => saveMutation.mutate({ content, createNewVersion: true })}
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
            onBlur={() => scriptTitle && saveMutation.mutate({ title: scriptTitle })}
            className="bg-slate-900 border-slate-700 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-slate-400">Screenplay</label>
            {modoc && (
              <button
                type="button"
                onClick={() => setModocScriptOpen(true)}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Bot className="w-3.5 h-3.5" />
                Get MODOC suggestions
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

