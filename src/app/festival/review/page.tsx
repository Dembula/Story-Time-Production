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
              <ul className="space-y-2">
                {submissions.map((s: {
                  id: string;
                  title: string;
                  stage1Group?: string | null;
                  selectionStatus: string;
                  escalateFlag: boolean;
                  reviewStage?: string;
                  category?: { name: string };
                  creator?: { name?: string | null; email?: string | null };
                }) => {
                  const official = s.selectionStatus === "OFFICIAL_SELECTION";
                  return (
                    <li
                      key={s.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                        official
                          ? "border-emerald-400/30 bg-emerald-500/[0.06]"
                          : s.escalateFlag || s.reviewStage === "STAGE2"
                            ? "border-orange-400/20 bg-orange-500/[0.04]"
                            : "border-white/8 bg-white/[0.02]"
                      }`}
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/festival/review/${s.id}`}
                          className="font-medium text-white hover:text-orange-200"
                        >
                          {s.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {s.category?.name || "—"}
                          {s.creator?.name || s.creator?.email
                            ? ` · ${s.creator?.name || s.creator?.email}`
                            : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            {s.reviewStage === "STAGE2" ? "Stage 2" : "Stage 1"}
                            {s.stage1Group ? ` · ${s.stage1Group}` : ""}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              official
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-white/[0.06] text-slate-400"
                            }`}
                          >
                            {s.selectionStatus.replace(/_/g, " ")}
                          </span>
                          {s.escalateFlag ? (
                            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-100">
                              Escalated
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Link
                        href={`/festival/review/${s.id}`}
                        className="rounded-xl bg-orange-500/90 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400"
                      >
                        Review
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </OpsSection>
        </>
      )}
    </div>
  );
}
