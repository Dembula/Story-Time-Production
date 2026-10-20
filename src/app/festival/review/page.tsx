"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsRangeTabs, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalBarChart } from "@/components/festival/festival-bar-chart";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { FestivalScopeSelect } from "@/components/festival/festival-scope-select";
import { useActiveFestival } from "@/components/festival/use-active-festival";

export default function FestivalReviewHubPage() {
  const { festivals, activeId, setActiveFestivalId, isLoading: listLoading } = useActiveFestival();
  const [stage, setStage] = useState<"STAGE1" | "STAGE2">("STAGE1");

  const { data, isLoading } = useQuery({
    queryKey: ["festival-submissions", activeId, stage],
    queryFn: () =>
      fetch(`/api/festival/${activeId}/submissions?stage=${stage}`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const submissions = data?.submissions ?? [];
  const stats = useMemo(() => {
    const a = submissions.filter((s: { stage1Group?: string }) => s.stage1Group === "A").length;
    const b = submissions.filter((s: { stage1Group?: string }) => s.stage1Group === "B").length;
    const c = submissions.filter((s: { stage1Group?: string }) => s.stage1Group === "C").length;
    const pending = submissions.filter((s: { stage1Group?: string | null }) => !s.stage1Group).length;
    const official = submissions.filter(
      (s: { selectionStatus?: string }) => s.selectionStatus === "OFFICIAL_SELECTION",
    ).length;
    return { a, b, c, pending, total: submissions.length, official };
  }, [submissions]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <OpsPageHeader
        title="Review hub"
        subtitle="Stage 1 groups A/B/C · Stage 2 decides official selection."
      />

      <div className="flex flex-wrap items-end gap-4">
        <FestivalScopeSelect
          festivals={festivals}
          value={activeId}
          onChange={setActiveFestivalId}
          isLoading={listLoading}
        />
        <OpsRangeTabs
          label="Stage"
          value={stage}
          options={[
            { value: "STAGE1", label: "Stage 1" },
            { value: "STAGE2", label: "Stage 2" },
          ]}
          onChange={setStage}
        />
      </div>

      {!activeId ? (
        <FestivalEmptyPanel
          icon={ShieldCheck}
          title="Select a festival to review"
          actionHref="/festival/festivals"
          actionLabel="My festivals"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <OpsMetricCard label="Total" value={stats.total} accent="orange" />
            <OpsMetricCard label="Group A" value={stats.a} accent="emerald" />
            <OpsMetricCard label="Group B" value={stats.b} accent="cyan" />
            <OpsMetricCard label="Group C" value={stats.c} accent="violet" />
            <OpsMetricCard label="Ungrouped" value={stats.pending} accent="amber" />
            <OpsMetricCard label="Official" value={stats.official} accent="emerald" />
          </div>

          <FestivalBarChart
            title={stage === "STAGE1" ? "Stage 1 distribution" : "Stage 2 snapshot"}
            bars={
              stage === "STAGE1"
                ? [
                    { label: "Group A", value: stats.a, color: "bg-emerald-500/80" },
                    { label: "Group B", value: stats.b, color: "bg-cyan-500/80" },
                    { label: "Group C", value: stats.c, color: "bg-violet-500/70" },
                    { label: "Ungrouped", value: stats.pending, color: "bg-amber-500/70" },
                  ]
                : [
                    { label: "In stage 2", value: stats.total, color: "bg-orange-500/80" },
                    { label: "Official selection", value: stats.official, color: "bg-emerald-500/80" },
                  ]
            }
          />

          <OpsSection title={stage === "STAGE1" ? "Stage 1 queue" : "Stage 2 queue"}>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : submissions.length === 0 ? (
              <FestivalEmptyPanel
                icon={ShieldCheck}
                title="No paid submissions in this view"
                body="Entries show here after filmmakers complete payment."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Group</th>
                      <th className="px-4 py-3">Selection</th>
                      <th className="px-4 py-3">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s: {
                      id: string;
                      title: string;
                      stage1Group?: string | null;
                      selectionStatus: string;
                      escalateFlag: boolean;
                      category?: { name: string };
                    }) => (
                      <tr key={s.id} className="border-t border-white/8 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <Link
                            href={`/festival/review/${s.id}`}
                            className="font-medium text-white hover:text-orange-200"
                          >
                            {s.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{s.category?.name || "—"}</td>
                        <td className="px-4 py-3 text-slate-300">{s.stage1Group || "—"}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {s.selectionStatus.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-amber-200/80">
                          {s.escalateFlag ? "Escalate" : "—"}
                        </td>
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
