"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type ScriptVersionsPanelProps = {
  scriptId: string | null | undefined;
  canWrite: boolean;
  onRestore: (content: string, label: string) => void;
};

export function ScriptVersionsPanel({
  scriptId,
  canWrite,
  onRestore,
}: ScriptVersionsPanelProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    enabled: !!scriptId,
    queryKey: ["script-versions", scriptId],
    queryFn: () =>
      fetch(`/api/creator/scripts/${scriptId}/versions`).then((r) => r.json()),
  });

  const versions = (data?.versions ?? []) as Array<{
    id: string;
    versionLabel: string | null;
    content: string;
    createdAt: string;
    createdBy: { name: string | null; professionalName: string | null } | null;
  }>;

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/scripts/${scriptId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionLabel: `Manual snapshot ${new Date().toLocaleString()}` }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["script-versions", scriptId] });
    },
  });

  if (!scriptId) {
    return <p className="text-[11px] text-slate-500">Select a script for version history.</p>;
  }

  return (
    <div className="space-y-2 text-[11px]">
      {canWrite ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full border-slate-600 text-[10px] text-slate-100"
          disabled={snapshotMutation.isPending}
          onClick={() => snapshotMutation.mutate()}
        >
          Save version snapshot
        </Button>
      ) : null}
      {isLoading ? (
        <p className="text-slate-500">Loading versions…</p>
      ) : versions.length === 0 ? (
        <p className="text-slate-500">No saved versions yet. Auto-snapshots are created on save.</p>
      ) : (
        <div className="max-h-[360px] space-y-1 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2"
            >
              <p className="font-medium text-slate-200">{v.versionLabel || "Version"}</p>
              <p className="text-[10px] text-slate-500">
                {new Date(v.createdAt).toLocaleString()}
                {v.createdBy
                  ? ` · ${v.createdBy.professionalName || v.createdBy.name || "Creator"}`
                  : ""}
              </p>
              {canWrite ? (
                <button
                  type="button"
                  className="mt-1 text-[10px] text-orange-400 hover:underline"
                  onClick={() => onRestore(v.content, v.versionLabel || "restored version")}
                >
                  Restore this version
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
