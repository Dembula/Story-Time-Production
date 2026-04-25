"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Film,
  Loader2,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  CREATOR_ONBOARDING_PLANS,
  CREATOR_PIPELINE_MONTHLY_ANNUAL_TOTAL,
  CREATOR_PIPELINE_YEARLY_SAVINGS_VS_12_MONTHLY,
  CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY,
  CREATOR_STUDIO_PROFILES_QUERY_KEY,
} from "@/lib/pricing";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";

type CreatorPackage = "UPLOAD_ONLY" | "PIPELINE";
type PipelineBilling = "YEARLY" | "MONTHLY";

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <div
      className={[
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition",
        active
          ? "border-orange-400/70 bg-orange-500/25 text-orange-200 shadow-[0_0_0_1px_rgba(249,115,22,0.2)]"
          : "border-dashed border-white/15 bg-white/[0.02]",
      ].join(" ")}
      aria-hidden
    >
      {active ? <Check className="h-5 w-5 stroke-[2.5]" /> : null}
    </div>
  );
}

export function LicenseClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pkg, setPkg] = useState<CreatorPackage>("UPLOAD_ONLY");
  const [pipelineBilling, setPipelineBilling] = useState<PipelineBilling>("YEARLY");
  const [expanded, setExpanded] = useState<string | null>("UPLOAD_ONLY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPrice = useMemo(() => {
    if (pkg === "UPLOAD_ONLY") return CREATOR_ONBOARDING_PLANS.UPLOAD_ONLY.price;
    return pipelineBilling === "YEARLY"
      ? CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price
      : CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price;
  }, [pkg, pipelineBilling]);

  const selectedInterval = pkg === "UPLOAD_ONLY"
    ? "year"
    : pipelineBilling === "YEARLY"
      ? "year"
      : "month";

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/creator/distribution-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pkg === "UPLOAD_ONLY"
            ? { package: "UPLOAD_ONLY" }
            : { package: "PIPELINE", billing: pipelineBilling },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save your plan");
      }
      if (data?.requiresPayment && data?.payment) {
        throw new Error("Payments are currently disabled on this platform.");
      }
      queryClient.setQueryData([...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY], {
        license: data.license ?? null,
        pipelineAccess: Boolean(data.pipelineAccess),
        suiteAccess: (data as { suiteAccess?: unknown }).suiteAccess ?? defaultSuiteAccessOpen(),
        planSummary: typeof data.planSummary === "string" ? data.planSummary : null,
        licensePeriodActive: data.licensePeriodActive !== false,
      });
      void queryClient.invalidateQueries({ queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY] });
      router.push("/creator/command-center");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Film className="h-4 w-4" /> Distribution
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Every plan includes catalogue upload, Originals, and analytics — the difference is whether you use our in-app production pipeline.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Workflow className="h-4 w-4" /> Pipeline
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Full pipeline unlocks Pre-production, Production, and Post-production in the sidebar and linked project workspaces.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-4 w-4" /> Billing
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Pay yearly upfront for the best rate, or choose monthly pipeline billing. Checkout is simulated until payments are enabled.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload-only */}
        <div
          data-selected={pkg === "UPLOAD_ONLY"}
          className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 ${
            pkg === "UPLOAD_ONLY" ? "border-orange-400/50 bg-orange-500/10 shadow-glow ring-1 ring-orange-400/25" : "hover:border-white/15"
          }`}
        >
          <button type="button" onClick={() => setPkg("UPLOAD_ONLY")} className="flex w-full flex-col text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                  <Clapperboard className="h-3.5 w-3.5" /> Upload focus
                </div>
                <h3 className="text-2xl font-semibold text-white">Upload &amp; originals</h3>
              </div>
              <SelectionCheck active={pkg === "UPLOAD_ONLY"} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              For creators who only release on Story Time. Sidebar hides the production pipeline; you keep uploads, Originals, network, messages, and analytics.
            </p>
            <p className="mt-6 text-4xl font-bold text-white">
              R{CREATOR_ONBOARDING_PLANS.UPLOAD_ONLY.price.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-slate-400">/year</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              {[
                "Catalogue upload & distribution workflow",
                "Originals submissions",
                "Analytics & audience insights",
                "No Pre / Production / Post sidebar sections",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  {b}
                </li>
              ))}
            </ul>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((c) => (c === "UPLOAD_ONLY" ? null : "UPLOAD_ONLY"))}
            className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
          >
            <span>More detail</span>
            {expanded === "UPLOAD_ONLY" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded === "UPLOAD_ONLY" ? (
            <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
              <p>
                Best if you already shoot offline and only need a polished home for your film on Story Time — without budgeting, scheduling, or breakdown tools in-app.
              </p>
            </div>
          ) : null}
        </div>

        {/* Full pipeline */}
        <div
          data-selected={pkg === "PIPELINE"}
          className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 ${
            pkg === "PIPELINE" ? "border-orange-400/50 bg-orange-500/10 shadow-glow ring-1 ring-orange-400/25" : "hover:border-white/15"
          }`}
        >
          <button type="button" onClick={() => setPkg("PIPELINE")} className="flex w-full flex-col text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
                  <Sparkles className="h-3.5 w-3.5" /> Full studio
                </div>
                <h3 className="text-2xl font-semibold text-white">Full production pipeline</h3>
              </div>
              <SelectionCheck active={pkg === "PIPELINE"} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Everything in the upload plan, plus Pre-production, Production, and Post-production tools, project workspaces, and linked workflows.
            </p>
          </button>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setPkg("PIPELINE");
                setPipelineBilling("YEARLY");
              }}
              className={`relative rounded-xl border px-4 py-3 text-left text-sm transition ${
                pkg === "PIPELINE" && pipelineBilling === "YEARLY"
                  ? "border-orange-400/60 bg-orange-500/15 text-white ring-1 ring-orange-400/30"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">Yearly</p>
                {pkg === "PIPELINE" && pipelineBilling === "YEARLY" ? (
                  <Check className="h-5 w-5 shrink-0 text-orange-300" strokeWidth={2.5} aria-hidden />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-md border border-white/15" aria-hidden />
                )}
              </div>
              <div className="mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/95">
                  Save R{CREATOR_PIPELINE_YEARLY_SAVINGS_VS_12_MONTHLY.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="line-through decoration-slate-600">
                    R{CREATOR_PIPELINE_MONTHLY_ANNUAL_TOTAL.toFixed(2)}
                  </span>
                  <span className="ml-1.5 text-[11px] text-slate-600">(12 × monthly)</span>
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  R{CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price.toFixed(2)}
                  <span className="text-xs font-normal text-slate-400">/year</span>
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setPkg("PIPELINE");
                setPipelineBilling("MONTHLY");
              }}
              className={`relative rounded-xl border px-4 py-3 text-left text-sm transition ${
                pkg === "PIPELINE" && pipelineBilling === "MONTHLY"
                  ? "border-orange-400/60 bg-orange-500/15 text-white ring-1 ring-orange-400/30"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white">Monthly</p>
                {pkg === "PIPELINE" && pipelineBilling === "MONTHLY" ? (
                  <Check className="h-5 w-5 shrink-0 text-orange-300" strokeWidth={2.5} aria-hidden />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-md border border-white/15" aria-hidden />
                )}
              </div>
              <p className="mt-1 text-2xl font-bold text-white">
                R{CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price.toFixed(2)}
                <span className="text-xs font-normal text-slate-400">/month</span>
              </p>
            </button>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-slate-300">
            {[
              "All upload & originals features",
              "Pre-production, production & post sidebar",
              "Per-project workspace tools (breakdown, schedule, etc.)",
            ].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                {b}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setExpanded((c) => (c === "PIPELINE" ? null : "PIPELINE"))}
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
          >
            <span>More details</span>
            {expanded === "PIPELINE" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded === "PIPELINE" ? (
            <div className="mt-3 space-y-5 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
              <p>
                The full pipeline plan keeps Story Time as your film&apos;s home from prep through delivery: the same distribution
                features as the upload plan, plus every in-app production phase and per-project workspace we expose to creators.
              </p>

              <div>
                <p className="font-medium text-slate-200">Everything in Upload &amp; originals</p>
                <ul className="mt-2 list-inside list-disc space-y-1.5 pl-0.5 marker:text-slate-600">
                  <li>Catalogue upload and distribution workflow for your releases</li>
                  <li>Originals submissions and title management</li>
                  <li>Analytics, audience insights, and creator-facing account tools</li>
                  <li>Network, messages, and dashboard access</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-slate-200">Pipeline in the sidebar</p>
                <ul className="mt-2 list-inside list-disc space-y-1.5 pl-0.5 marker:text-slate-600">
                  <li>
                    <strong className="font-medium text-slate-300">Pre-Production</strong> — hub for prep tools, casting and crew
                    shortcuts, and jumping into a project&apos;s pre-production workspace
                  </li>
                  <li>
                    <strong className="font-medium text-slate-300">Production</strong> — shoot-focused hub: control center, call sheets,
                    dailies, on-set tasks, expenses, continuity, wrap, and linked project routes
                  </li>
                  <li>
                    <strong className="font-medium text-slate-300">Post-Production</strong> — editorial and finishing hub (ingest
                    through mix, packaging) with paths into each project&apos;s post tools and distribution
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-slate-200">Per-project workspace tools</p>
                <p className="mt-2">
                  Each project opens a dedicated workspace with phase tabs. You can work through the same pipeline in one place, for
                  example:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1.5 pl-0.5 marker:text-slate-600">
                  <li>
                    <strong className="font-medium text-slate-300">Pre-production:</strong> idea and script development, script review,
                    breakdown, budget builder, production scheduling, casting portal, crew and location marketplaces, equipment
                    planning, visual planning, legal and contracts, funding hub, table reads, production workspace,
                    risk and insurance, and readiness checks
                  </li>
                  <li>
                    <strong className="font-medium text-slate-300">Production:</strong> control center, call sheets, on-set tasks,
                    equipment tracking, shoot progress, continuity, dailies review, expense tracker, incident reporting, and wrap
                  </li>
                  <li>
                    <strong className="font-medium text-slate-300">Post-production:</strong> footage ingestion, editing studio, sound
                    design, music scoring, visual effects, color grading, final sound mix, final cut approval, film packaging, and
                    project distribution handoff
                  </li>
                </ul>
              </div>

              <p className="text-xs text-slate-500">
                Exact screens evolve as we ship updates; your license is for the full creator pipeline as it exists in the product,
                including new tools added under these areas.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="storytime-section p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
              <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </div>
            <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Your selection</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {pkg === "UPLOAD_ONLY"
                ? "Upload & originals"
                : pipelineBilling === "YEARLY"
                  ? "Full pipeline · Yearly"
                  : "Full pipeline · Monthly"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {pkg === "UPLOAD_ONLY"
                ? "Pipeline sections stay hidden in the creator sidebar."
                : "All pipeline menus and project tools are available after onboarding."}
            </p>
            </div>
          </div>
          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-orange-200/80">Due now (simulated)</p>
            <p className="mt-1 text-3xl font-bold text-white">
              R{selectedPrice.toFixed(2)}
              <span className="text-sm font-normal text-slate-400">
                {selectedInterval === "year" ? "/year" : "/month"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        Continue to dashboard
      </button>
    </div>
  );
}
