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
  CREATOR_PER_FILM_UPLOAD_PRICE,
  CREATOR_PIPELINE_MONTHLY_ANNUAL_TOTAL,
  CREATOR_PIPELINE_YEARLY_SAVINGS_VS_12_MONTHLY,
  CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY,
  CREATOR_STUDIO_PROFILES_QUERY_KEY,
} from "@/lib/pricing";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";
import { formatZar } from "@/lib/format-currency-zar";
import { CheckoutModal } from "@/components/payments/checkout-modal";

type CreatorPackage = "PER_FILM" | "UPLOAD_YEARLY" | "PIPELINE";
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
  const [pkg, setPkg] = useState<CreatorPackage>("PER_FILM");
  const [pipelineBilling, setPipelineBilling] = useState<PipelineBilling>("YEARLY");
  const [expanded, setExpanded] = useState<string | null>("PER_FILM");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [redirectAfterCheckout, setRedirectAfterCheckout] = useState("/creator/dashboard");

  const selectedPrice = useMemo(() => {
    if (pkg === "PER_FILM") return 0;
    if (pkg === "UPLOAD_YEARLY") return CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price;
    return pipelineBilling === "YEARLY"
      ? CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price
      : CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price;
  }, [pkg, pipelineBilling]);

  const selectedInterval =
    pkg === "PER_FILM" ? "film" : pkg === "UPLOAD_YEARLY" ? "year" : pipelineBilling === "YEARLY" ? "year" : "month";

  async function submit() {
    setError("");
    setPromoMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/creator/distribution-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pkg === "PER_FILM"
            ? { package: "PER_FILM", promoCode }
            : pkg === "UPLOAD_YEARLY"
              ? { package: "UPLOAD_YEARLY", promoCode }
              : { package: "PIPELINE", billing: pipelineBilling, promoCode },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save your plan");
      }
      if (data?.requiresPayment) {
        if (typeof data?.checkoutUrl === "string" && data.checkoutUrl) {
          setCheckoutUrl(data.checkoutUrl);
          setRedirectAfterCheckout(
            typeof data?.redirectTo === "string" ? data.redirectTo : "/creator/dashboard",
          );
          setCheckoutOpen(true);
          return;
        }
        throw new Error(
          (typeof data?.checkoutWarning === "string" && data.checkoutWarning) ||
            "Unable to start checkout. Please try again.",
        );
      }
      if (data?.pricing?.promoCode) {
        setPromoMessage(`Promo ${data.pricing.promoCode} applied. Discount ${formatZar(data.pricing.discountAmount || 0)}.`);
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
      router.push("/creator/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        title="Complete creator license payment"
        subtitle="Finish payment to unlock the selected creator package."
        onClose={() => setCheckoutOpen(false)}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Film className="h-4 w-4" /> Catalogue
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Pay per film or choose unlimited yearly uploads. Pipeline tools are only on the full studio plan.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Workflow className="h-4 w-4" /> Pipeline
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Full pipeline unlocks Pre-production, Production, and Post-production workspaces.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-4 w-4" /> Billing
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Per-film billing happens at upload. Yearly and pipeline plans use secure checkout now.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pay per film */}
        <div
          data-selected={pkg === "PER_FILM"}
          className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 ${
            pkg === "PER_FILM" ? "border-orange-400/50 bg-orange-500/10 shadow-glow ring-1 ring-orange-400/25" : "hover:border-white/15"
          }`}
        >
          <button type="button" onClick={() => setPkg("PER_FILM")} className="flex w-full flex-col text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
                  <Film className="h-3.5 w-3.5" /> Pay as you go
                </div>
                <h3 className="text-2xl font-semibold text-white">Pay per film</h3>
              </div>
              <SelectionCheck active={pkg === "PER_FILM"} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Catalogue upload only. Pay {formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)} each time you submit a new title for review. Resubmissions after rejection are free.
            </p>
            <p className="mt-6 text-4xl font-bold text-white">
              {formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)}
              <span className="ml-1 text-sm font-normal text-slate-400">/film</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              {[
                "Catalogue upload & distribution",
                "Originals submissions",
                "Analytics & audience insights",
                "No production pipeline access",
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
            onClick={() => setExpanded((c) => (c === "PER_FILM" ? null : "PER_FILM"))}
            className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
          >
            <span>More detail</span>
            {expanded === "PER_FILM" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded === "PER_FILM" ? (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
              <p>
                Best for filmmakers releasing one or two titles a year. Payment is collected at submission — your film enters review only after successful payment.
              </p>
            </div>
          ) : null}
        </div>

        {/* Catalogue unlimited yearly */}
        <div
          data-selected={pkg === "UPLOAD_YEARLY"}
          className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 ${
            pkg === "UPLOAD_YEARLY" ? "border-orange-400/50 bg-orange-500/10 shadow-glow ring-1 ring-orange-400/25" : "hover:border-white/15"
          }`}
        >
          <button type="button" onClick={() => setPkg("UPLOAD_YEARLY")} className="flex w-full flex-col text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  <Clapperboard className="h-3.5 w-3.5" /> Unlimited
                </div>
                <h3 className="text-2xl font-semibold text-white">Catalogue unlimited</h3>
              </div>
              <SelectionCheck active={pkg === "UPLOAD_YEARLY"} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Unlimited catalogue uploads for 12 months. Same distribution features as pay-per-film, without a fee on each submission.
            </p>
            <p className="mt-6 text-4xl font-bold text-white">
              {formatZar(CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price)}
              <span className="ml-1 text-sm font-normal text-slate-400">/year</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              {[
                "Unlimited catalogue submissions",
                "Originals & analytics",
                "No per-film upload fees",
                "No production pipeline access",
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
            onClick={() => setExpanded((c) => (c === "UPLOAD_YEARLY" ? null : "UPLOAD_YEARLY"))}
            className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
          >
            <span>More detail</span>
            {expanded === "UPLOAD_YEARLY" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded === "UPLOAD_YEARLY" ? (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
              <p>
                Ideal if you release multiple films or series in a year. One annual payment covers every catalogue submission during your license period.
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
              Unlimited uploads plus Pre-production, Production, and Post-production tools and project workspaces.
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
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-400/95">
                Save {formatZar(CREATOR_PIPELINE_YEARLY_SAVINGS_VS_12_MONTHLY)}
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price)}
                <span className="text-xs font-normal text-slate-400">/year</span>
              </p>
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
                {formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price)}
                <span className="text-xs font-normal text-slate-400">/month</span>
              </p>
            </button>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-slate-300">
            {[
              "Unlimited catalogue uploads",
              "Pre-production, production & post sidebar",
              "Per-project workspace tools",
            ].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                {b}
              </li>
            ))}
          </ul>
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
                {pkg === "PER_FILM"
                  ? "Pay per film"
                  : pkg === "UPLOAD_YEARLY"
                    ? "Catalogue unlimited"
                    : pipelineBilling === "YEARLY"
                      ? "Full pipeline · Yearly"
                      : "Full pipeline · Monthly"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {pkg === "PER_FILM"
                  ? `You pay ${formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)} at each new film submission.`
                  : pkg === "UPLOAD_YEARLY"
                    ? "Unlimited uploads for 12 months. Pipeline sections stay hidden."
                    : "All pipeline menus and project tools are available after onboarding."}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-orange-200/80">Due now</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {pkg === "PER_FILM" ? formatZar(0) : formatZar(selectedPrice)}
              {pkg !== "PER_FILM" ? (
                <span className="text-sm font-normal text-slate-400">
                  {selectedInterval === "year" ? "/year" : "/month"}
                </span>
              ) : (
                <span className="ml-2 text-sm font-normal text-slate-400">at upload</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="storytime-section p-6">
        <p className="text-sm font-medium text-slate-300">Promo code</p>
        <p className="mt-2 text-sm text-slate-400">
          Add a creator promo code for discounted or sponsored onboarding access.
        </p>
        <div className="mt-4">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="e.g. CREATOR100"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-white"
          />
        </div>
        {promoMessage ? <p className="mt-3 text-xs text-emerald-400">{promoMessage}</p> : null}
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
