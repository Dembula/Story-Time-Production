"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Loader2, Music2, ShieldCheck, Wallet } from "lucide-react";
import {
  CREATOR_LICENSE_CONFIG,
  CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY,
  CREATOR_STUDIO_PROFILES_QUERY_KEY,
} from "@/lib/pricing";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";

const OPTIONS = [
  {
    id: "YEARLY",
    name: "Yearly license",
    price: CREATOR_LICENSE_CONFIG.YEARLY.price,
    description: "Unlimited track submissions for one year with payment handled during onboarding.",
    highlight: "Best for active releases",
    benefits: [
      "One onboarding payment for the full year",
      "Unlimited track submissions while active",
      "No extra gateway step at upload time",
    ],
    details: [
      "Ideal for composers, artists, and labels planning multiple releases or sync-ready catalogues.",
      "Keeps your upload workflow fast when you are adding tracks regularly.",
    ],
  },
  {
    id: "PER_UPLOAD",
    name: "Pay per upload",
    price: CREATOR_LICENSE_CONFIG.PER_UPLOAD.price,
    description: "Open your account now and only pay when a track is submitted for distribution review.",
    highlight: "Lower upfront cost",
    benefits: [
      "No onboarding payment",
      "Pay only when you submit a track",
      "Great for occasional music releases",
    ],
    details: [
      "A strong fit if you are testing demand, building your catalogue, or releasing selectively.",
      "Lets you onboard quickly without committing to annual billing right away.",
    ],
  },
] as const;

export function LicenseClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"YEARLY" | "PER_UPLOAD">("YEARLY");
  const [expanded, setExpanded] = useState<string | null>("YEARLY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedOption = OPTIONS.find((option) => option.id === type) ?? OPTIONS[0];

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/creator/distribution-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save your distribution option");
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
      router.push("/music-creator/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your distribution option");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Music2 className="h-4 w-4" /> Music distribution
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Pick the billing model that best fits how often you will submit tracks to the platform.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Wallet className="h-4 w-4" /> Flexible payments
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Pay once now for faster recurring uploads or pay only when each track is sent for review.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-4 w-4" /> Professional launch
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Every option keeps the same polished music creator account and dashboard experience.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-slate-400">Step 1 of 1 — Choose your music distribution option.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {OPTIONS.map((option) => (
            <div
              key={option.id}
              data-selected={type === option.id}
              className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
                type === option.id ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
              }`}
            >
              <button type="button" onClick={() => setType(option.id)} className="flex h-full flex-col text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
                      {option.highlight}
                    </div>
                    <h3 className="text-2xl font-semibold text-white">{option.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">{option.description}</p>
                  </div>
                  {type === option.id ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/10">
                      <Check className="h-5 w-5 text-orange-300" />
                    </div>
                  ) : null}
                </div>

                <p className="mt-5 text-4xl font-bold text-white">
                  R{option.price.toFixed(2)}
                  <span className="ml-1 text-sm font-normal text-slate-400">
                    {option.id === "YEARLY" ? "/year" : "/upload"}
                  </span>
                </p>

                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  {option.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </button>

              <button
                type="button"
                onClick={() => setExpanded((current) => (current === option.id ? null : option.id))}
                className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
              >
                <span>More about this option</span>
                {expanded === option.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {expanded === option.id ? (
                <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                  {option.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="storytime-section p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected option</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{selectedOption.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{selectedOption.description}</p>
            </div>
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-orange-200/80">
                {selectedOption.id === "YEARLY" ? "Onboarding payment" : "Submission payment"}
              </p>
              <p className="mt-1 text-3xl font-bold text-white">R{selectedOption.price.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="storytime-kpi p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">After signup</p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedOption.id === "YEARLY"
                  ? "Upload tracks without another checkout step while the yearly license is active."
                  : "Your account is ready immediately, and payment appears only when a track is sent for review."}
              </p>
            </div>
            <div className="storytime-kpi p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Best for</p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedOption.id === "YEARLY"
                  ? "Composers, artists, and labels planning regular releases."
                  : "Occasional releases, smaller catalogues, or testing the platform first."}
              </p>
            </div>
          </div>
        </div>

        <div className="storytime-section p-6">
          <p className="text-sm font-medium text-slate-300">What stays the same</p>
          <p className="mt-2 text-sm text-slate-400">
            Both options unlock the same music creator dashboard. The billing difference is only when Story Time charges the distribution fee.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Keep the same upload and music management tools
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Maintain a cleaner, more professional release path
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Match payment timing to your release strategy
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <button onClick={submit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {type === "YEARLY" ? "Pay & continue" : "Continue with pay per upload"}
      </button>

    </div>
  );
}
