"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Clapperboard, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { CREATOR_LICENSE_CONFIG } from "@/lib/pricing";

const OPTIONS = [
  {
    id: "YEARLY",
    name: "Yearly license",
    price: CREATOR_LICENSE_CONFIG.YEARLY.price,
    description: "Unlimited film and series submissions for one year with payment handled during onboarding.",
    highlight: "Best for active filmmakers",
    benefits: [
      "One onboarding payment for the full year",
      "Unlimited title submissions during the license period",
      "Uploads go straight to admin review later",
    ],
    details: [
      "Ideal if you plan to release multiple titles and want the cleanest workflow after signup.",
      "Best fit for filmmakers building a consistent release slate or running a studio pipeline.",
    ],
  },
  {
    id: "PER_UPLOAD",
    name: "Pay per upload",
    price: CREATOR_LICENSE_CONFIG.PER_UPLOAD.price,
    description: "Create your account now and only pay when you actually submit a title for distribution review.",
    highlight: "Flexible start",
    benefits: [
      "No payment during onboarding",
      "Pay only when a title is sent for review",
      "Good for occasional releases or testing demand",
    ],
    details: [
      "A strong option if you are still building your catalogue and want lower upfront commitment.",
      "Best for independent creators who release films or episodes less frequently.",
    ],
  },
] as const;

export function LicenseClient() {
  const router = useRouter();
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
      router.push("/creator/dashboard");
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
            <Clapperboard className="h-4 w-4" /> Release workflow
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Choose a billing model that matches how often you plan to submit films, shows, or series.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Wallet className="h-4 w-4" /> Clear billing
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Pay once for the year or pay only at the exact moment a title is submitted for review.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-4 w-4" /> Professional setup
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Your choice controls how distribution payments work after onboarding, not your creative ownership.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-slate-400">Step 1 of 1 — Choose your distribution option.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {OPTIONS.map((option) => (
            <div
              key={option.id}
              data-selected={type === option.id}
              className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
                type === option.id ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
              }`}
            >
              <button
                type="button"
                onClick={() => setType(option.id)}
                className="flex h-full flex-col text-left"
              >
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
              <p className="mt-1 text-3xl font-bold text-white">
                R{selectedOption.price.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="storytime-kpi p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">After signup</p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedOption.id === "YEARLY"
                  ? "Submit titles without another checkout step while the annual license is active."
                  : "Your account is ready immediately, and payment only appears when a title is actually sent for distribution."}
              </p>
            </div>
            <div className="storytime-kpi p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Best for</p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedOption.id === "YEARLY"
                  ? "Filmmakers, studios, or teams with multiple planned releases."
                  : "Independent creators testing the platform or releasing occasionally."}
              </p>
            </div>
          </div>
        </div>

        <div className="storytime-section p-6">
          <p className="text-sm font-medium text-slate-300">What changes with each option</p>
          <p className="mt-2 text-sm text-slate-400">
            Both options create the same professional creator account. The only difference is when Story Time collects the distribution fee.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Keep the same dashboard and creator tools
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Submit to Story Time review with a clear payment path
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Maintain a polished release workflow from day one
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
