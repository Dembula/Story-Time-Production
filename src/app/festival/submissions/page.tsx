"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clapperboard } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { FestivalScopeSelect } from "@/components/festival/festival-scope-select";
import { useActiveFestival } from "@/components/festival/use-active-festival";

type SubmissionRow = {
  id: string;
  title: string;
  feeAmountZar: number;
  reviewStage: string;
  selectionStatus: string;
  stage1Group?: string | null;
  submittedAt?: string | null;
  category?: { name: string };
  creator?: { name: string | null; email: string | null };
};

export default function FestivalSubmissionsPage() {
  const { festivals, activeId, setActiveFestivalId, isLoading: listLoading } = useActiveFestival();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["festival-submissions-all", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/submissions`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const rows: SubmissionRow[] = data?.submissions ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((s) =>
      [s.title, s.creator?.name, s.creator?.email, s.category?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const inReview = rows.filter((s) => s.reviewStage === "STAGE1" || s.reviewStage === "STAGE2").length;
  const official = rows.filter((s) => s.selectionStatus === "OFFICIAL_SELECTION").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <OpsPageHeader title="Submissions" subtitle="Paid entries across review stages." />

      <FestivalScopeSelect
        festivals={festivals}
        value={activeId}
        onChange={setActiveFestivalId}
        isLoading={listLoading}
      />

      {!activeId ? (
        <FestivalEmptyPanel
          icon={Clapperboard}
          title="Select or create a festival"
          actionHref="/festival/festivals"
          actionLabel="My festivals"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <OpsMetricCard label="Paid" value={rows.length} accent="orange" />
            <OpsMetricCard label="In review" value={inReview} accent="cyan" />
            <OpsMetricCard label="Official selection" value={official} accent="emerald" />
          </div>

          <OpsSection title="Entry queue">
            <div className="mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, filmmaker, category…"
                className="h-11 w-full max-w-md rounded-xl border border-white/12 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400/50"
              />
            </div>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : filtered.length === 0 ? (
              <FestivalEmptyPanel
                icon={Clapperboard}
                title="No paid submissions yet"
                body="When filmmakers pay to enter, they appear here for review."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Film</th>
                      <th className="px-4 py-3">Filmmaker</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Fee</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Selection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-t border-white/8 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <Link href={`/festival/review/${s.id}`} className="font-medium text-white hover:text-orange-200">
                            {s.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          <div>{s.creator?.name || "—"}</div>
                          <div className="text-[11px] text-slate-600">{s.creator?.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{s.category?.name || "—"}</td>
                        <td className="px-4 py-3 text-slate-300">R{Number(s.feeAmountZar).toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {s.reviewStage}
                          {s.stage1Group ? ` · ${s.stage1Group}` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{s.selectionStatus.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsSection>
        </>
      )}
    </div>
  );
}
