"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatDurationMss } from "@/lib/cont-sheet/types";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";

type PrintTake = {
  sceneCode: string;
  slate: string | null;
  takeNumber: number | null;
  pickup: number | null;
  durationSec: number | null;
  description: string | null;
  camera: string | null;
};

/** Soft, non-blocking Cont Sheet PRINT take suggestions for dailies. */
export function ContSheetPrintTakesHint({
  projectId,
  shootDayId,
}: {
  projectId: string;
  shootDayId?: string | null;
}) {
  const { data } = useQuery({
    queryKey: ["project-cont-sheet-print-takes", projectId, shootDayId],
    queryFn: projectToolQueryFn(
      `/api/creator/projects/${projectId}/cont-sheet?shootDayId=${encodeURIComponent(shootDayId!)}&printTakes=1`,
    ),
    enabled: Boolean(projectId && shootDayId),
  });

  const takes: PrintTake[] = Array.isArray(data?.printTakes) ? data.printTakes : [];
  if (!shootDayId || takes.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-400/20 bg-orange-500/[0.06] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-200/90">
          Cont Sheet PRINT takes
        </p>
        <Link
          href={`/creator/projects/${projectId}/production/cont-sheet`}
          className="text-[10px] text-orange-200 hover:underline"
        >
          Open Cont Sheet
        </Link>
      </div>
      <ul className="max-h-36 space-y-1 overflow-y-auto text-[11px] text-slate-300">
        {takes.slice(0, 24).map((t, i) => (
          <li key={`${t.sceneCode}-${t.slate}-${t.takeNumber}-${i}`} className="truncate">
            <span className="text-orange-100/90">{t.sceneCode}</span>
            {" · "}
            {t.slate || "—"} T{t.takeNumber ?? "—"}
            {t.pickup != null ? ` P/U ${t.pickup}` : ""}
            {t.durationSec != null ? ` · ${formatDurationMss(t.durationSec)}` : ""}
            {t.description ? ` · ${t.description}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-slate-500">
        Suggested from Cont Sheet — apply manually when logging dailies; nothing is overwritten.
      </p>
    </div>
  );
}
