"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Film,
  Loader2,
  Shield,
  Smartphone,
  Sparkles,
  Ticket,
  Tv,
  Users,
} from "lucide-react";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";

const PLANS = [
  {
    id: "BASE_1",
    name: VIEWER_PLAN_CONFIG.BASE_1.label,
    price: VIEWER_PLAN_CONFIG.BASE_1.price,
    devices: 1,
    description: "Best for solo viewers",
    highlight: "Simple access to every title",
    benefits: ["Watch on 1 device", "Full catalogue access", "HD streaming"],
    details: [
      "Ideal if you mostly watch on one phone, tablet, or TV.",
      "Great starting point for new subscribers who want the lowest monthly price.",
    ],
  },
  {
    id: "STANDARD_3",
    name: VIEWER_PLAN_CONFIG.STANDARD_3.label,
    price: VIEWER_PLAN_CONFIG.STANDARD_3.price,
    devices: 3,
    description: "Popular for couples and small households",
    highlight: "Most popular",
    benefits: ["Watch on 3 devices", "Full catalogue access", "HD streaming", "Share with family"],
    details: [
      "Lets multiple people stream at the same time without upgrading to the largest plan.",
      "Balanced option for value, flexibility, and shared household access.",
    ],
  },
  {
    id: "FAMILY_5",
    name: VIEWER_PLAN_CONFIG.FAMILY_5.label,
    price: VIEWER_PLAN_CONFIG.FAMILY_5.price,
    devices: 5,
    description: "Built for busy households",
    highlight: "Maximum flexibility",
    benefits: ["Watch on 5+ devices", "Create 5+ profiles", "Full catalogue access", "Best for households"],
    details: [
      "Perfect when different family members watch across phones, tablets, and smart TVs.",
      "Includes the highest device flexibility for shared accounts and profile switching.",
    ],
  },
] as const;

const PPV_PLAN = {
  id: "PPV_FILM",
  name: "Pay Per View",
  price: VIEWER_PLAN_CONFIG.PPV_FILM.price,
  description: "Pay only for the movies, shows, and other titles you want to unlock.",
  highlight: "One title at a time",
  benefits: [
    "R49.99 per movie, show, or title purchase",
    "Unlock each purchased title for 30 days",
    "Single profile only",
    "No household profile sharing",
  ],
  details: [
    "After onboarding, you will create one viewer profile with a name and date of birth before entering the catalogue.",
    "You only pay when you choose a title and press Pay now on its detail page.",
    "PPV accounts are limited to one profile and do not support shared household access.",
  ],
} as const;

type ViewerModel = "SUBSCRIPTION" | "PPV";

export function PackageClient() {
  const router = useRouter();
  const [viewerModel, setViewerModel] = useState<ViewerModel>("SUBSCRIPTION");
  const [selected, setSelected] = useState<string>("BASE_1");
  const [expanded, setExpanded] = useState<string | null>("BASE_1");
  const [startTrial, setStartTrial] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = PLANS.find((plan) => plan.id === selected) ?? PLANS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPromoMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewerModel,
          plan: viewerModel === "SUBSCRIPTION" ? selected : PPV_PLAN.id,
          startTrial: viewerModel === "SUBSCRIPTION" ? startTrial : false,
          promoCode: viewerModel === "SUBSCRIPTION" ? promoCode : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data?.pricing?.promoCode) {
        setPromoMessage(`Promo ${data.pricing.promoCode} applied. Discount ${formatZar(data.pricing.discountAmount || 0)}.`);
      }

      if (data?.requiresPayment && data?.payment) {
        throw new Error("Payments are currently disabled on this platform.");
      }

      if (data?.profileId) {
        const activateRes = await fetch("/api/viewer/profiles/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: data.profileId }),
        });
        if (!activateRes.ok) {
          const activateData = await activateRes.json().catch(() => ({}));
          throw new Error(activateData.error || "Failed to activate profile");
        }
      }

      router.push(typeof data?.redirectTo === "string" ? data.redirectTo : "/profiles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Tv className="h-4 w-4" /> Full access
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Subscription unlocks the full catalogue, while PPV lets viewers pay only for selected titles.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Sparkles className="h-4 w-4" /> Flexible access
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Choose shared household access or a one-profile PPV account during onboarding.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Shield className="h-4 w-4" /> Clear profile rules
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Your selected viewer model controls how many profiles can exist on the account.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-slate-400">Step 1 of 2 — Choose how this viewer account should work.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => setViewerModel("SUBSCRIPTION")}
            className={`storytime-plan-card flex flex-col p-6 text-left transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
              viewerModel === "SUBSCRIPTION" ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
            }`}
          >
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
              <Users className="h-3.5 w-3.5" />
              Shared household access
            </div>
            <h2 className="text-2xl font-semibold text-white">Subscription</h2>
            <p className="mt-2 text-sm text-slate-400">
              Best for viewers who want full-catalogue access and profile counts that match their package.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setViewerModel("PPV")}
            className={`storytime-plan-card flex flex-col p-6 text-left transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
              viewerModel === "PPV" ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
            }`}
          >
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
              <Ticket className="h-3.5 w-3.5" />
              Single-profile account
            </div>
            <h2 className="text-2xl font-semibold text-white">Pay Per View</h2>
            <p className="mt-2 text-sm text-slate-400">
              Best for viewers who only want to pay when they unlock a specific title.
            </p>
          </button>
        </div>
      </div>

      {viewerModel === "SUBSCRIPTION" ? (
        <>
          <p className="text-sm text-slate-400">Step 2 of 2 — Choose your subscription plan.</p>

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                data-selected={selected === plan.id}
                className={`storytime-plan-card group flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
                  selected === plan.id ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(plan.id)}
                  className="flex h-full flex-col text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
                        <Smartphone className="h-3.5 w-3.5" />
                        {plan.id === "FAMILY_5" ? "5+ devices / profiles" : `${plan.devices} device${plan.devices > 1 ? "s / profiles" : " / profile"}`}
                      </div>
                      <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{plan.description}</p>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      selected === plan.id
                        ? "border-orange-400/30 bg-orange-500/10 text-orange-200"
                        : "border-white/10 bg-white/[0.03] text-slate-400"
                    }`}>
                      {plan.highlight}
                    </div>
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4">
                    <p className="text-4xl font-bold text-white">
                      {formatZar(plan.price)}
                      <span className="ml-1 text-sm font-normal text-slate-400">/month</span>
                    </p>
                    {selected === plan.id ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/10">
                        <Check className="h-5 w-5 text-orange-300" />
                      </div>
                    ) : null}
                  </div>

                  <ul className="mt-5 space-y-2 text-sm text-slate-300">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </button>

                <button
                  type="button"
                  onClick={() => setExpanded((current) => (current === plan.id ? null : plan.id))}
                  className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
                >
                  <span>More about this package</span>
                  {expanded === plan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expanded === plan.id ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                    {plan.details.map((detail) => (
                      <p key={detail}>{detail}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-400">Step 2 of 2 — Review how PPV works.</p>

          <div className="storytime-plan-card p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
                  <Film className="h-3.5 w-3.5" />
                  {PPV_PLAN.highlight}
                </div>
                <h3 className="text-3xl font-semibold text-white">{PPV_PLAN.name}</h3>
                <p className="mt-2 text-sm text-slate-400">{PPV_PLAN.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  {PPV_PLAN.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-5 py-4 text-right">
                <p className="text-xs uppercase tracking-wide text-orange-200/80">Price per title</p>
                <p className="mt-1 text-4xl font-bold text-white">{formatZar(PPV_PLAN.price)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((current) => (current === PPV_PLAN.id ? null : PPV_PLAN.id))}
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
            >
              <span>More about this package</span>
              {expanded === PPV_PLAN.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expanded === PPV_PLAN.id ? (
              <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                {PPV_PLAN.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="storytime-section p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected package</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {viewerModel === "SUBSCRIPTION" ? selectedPlan.name : PPV_PLAN.name}
              </h2>
              <p className="mt-1 text-slate-400">
                {viewerModel === "SUBSCRIPTION" ? selectedPlan.description : PPV_PLAN.description}
              </p>
            </div>
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-orange-200/80">
                {viewerModel === "SUBSCRIPTION" ? "Monthly price" : "Price per title"}
              </p>
              <p className="mt-1 text-3xl font-bold text-white">
                {formatZar(viewerModel === "SUBSCRIPTION" ? selectedPlan.price : PPV_PLAN.price)}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="storytime-kpi p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Users className="h-4 w-4" /> Devices
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {viewerModel === "SUBSCRIPTION"
                  ? selectedPlan.id === "FAMILY_5"
                    ? "Watch on 5+ devices and create 5+ profiles on one account."
                    : `Watch on up to ${selectedPlan.devices} device${selectedPlan.devices > 1 ? "s" : ""} and create ${selectedPlan.devices} profile${selectedPlan.devices > 1 ? "s" : ""}.`
                  : "One profile only. This account cannot create or link multiple viewer profiles."}
              </p>
            </div>
            <div className="storytime-kpi p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Tv className="h-4 w-4" /> Catalogue access
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {viewerModel === "SUBSCRIPTION"
                  ? "Full access to original films, series, podcasts, shows, and music."
                  : "Titles stay locked until you pay on the detail page, then remain unlocked for 30 days."}
              </p>
            </div>
          </div>
        </div>

        <div className="storytime-section p-6">
          <p className="text-sm font-medium text-slate-300">What you get</p>
          <p className="mt-2 text-sm text-slate-400">
            {viewerModel === "SUBSCRIPTION"
              ? "Access to all films, series, shows, podcasts, and music. Start with a 7-day free trial with no charge until it ends."
              : "Create one viewer profile first, then browse the catalogue and pay only when you unlock an eligible title."}
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              {viewerModel === "SUBSCRIPTION" ? "Change or cancel anytime" : "One-profile viewer account"}
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              {viewerModel === "SUBSCRIPTION" ? "Profile support for households" : "Pay only when you unlock a title"}
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              {viewerModel === "SUBSCRIPTION" ? "HD streaming included" : "30-day access window after each payment"}
            </div>
          </div>
        </div>
      </div>

      {viewerModel === "SUBSCRIPTION" ? (
        <div className="storytime-section p-6">
          <p className="text-sm font-medium text-slate-300">Billing start</p>
          <p className="mt-2 text-sm text-slate-400">
            Choose whether this subscription should begin with a sleek 7-day trial or start as a paid plan immediately.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setStartTrial(true)}
              data-selected={startTrial}
              className={`storytime-plan-card flex flex-col p-5 text-left transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
                startTrial ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Recommended
                  </div>
                  <h3 className="text-xl font-semibold text-white">Start 7-day free trial</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Watch everything now and only move into billing after the 7-day trial window ends.
                  </p>
                </div>
                {startTrial ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/10">
                    <Check className="h-5 w-5 text-orange-300" />
                  </div>
                ) : null}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStartTrial(false)}
              data-selected={!startTrial}
              className={`storytime-plan-card flex flex-col p-5 text-left transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
                !startTrial ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">
                    <CreditCard className="h-3.5 w-3.5" />
                    Immediate billing
                  </div>
                  <h3 className="text-xl font-semibold text-white">Pay now</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Start the paid monthly cycle straight away and skip the free-trial period.
                  </p>
                </div>
                {!startTrial ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/10">
                    <Check className="h-5 w-5 text-orange-300" />
                  </div>
                ) : null}
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {viewerModel === "SUBSCRIPTION" ? (
        <div className="storytime-section p-6">
          <p className="text-sm font-medium text-slate-300">Promo code</p>
          <p className="mt-2 text-sm text-slate-400">
            If you received a Story Time promo code, enter it here for discounted or sponsored access.
          </p>
          <div className="mt-4">
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="e.g. STORYTIME50"
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
            />
          </div>
          {promoMessage ? (
            <p className="mt-3 text-xs text-emerald-400">{promoMessage}</p>
          ) : null}
        </div>
      ) : null}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {viewerModel === "SUBSCRIPTION"
          ? startTrial
            ? "Start 7-day free trial"
            : "Pay now"
          : "Continue with PPV"}
      </button>

    </form>
  );
}
