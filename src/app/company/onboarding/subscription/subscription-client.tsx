"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Loader2, Megaphone, Shield, Sparkles } from "lucide-react";
import { COMPANY_PLAN_CONFIG } from "@/lib/pricing";

const PLANS = [
  {
    id: "STANDARD",
    name: COMPANY_PLAN_CONFIG.STANDARD.label,
    price: COMPANY_PLAN_CONFIG.STANDARD.price,
    description: "Reliable visibility for creators searching for partners.",
    highlight: "Steady visibility",
    benefits: [
      "Visible in creator dashboards",
      "One listing for your business",
      "Discoverable by all creators",
    ],
    details: [
      "Best for teams that want a professional presence without paying for featured placement.",
      "A solid entry point if you are validating demand or launching your company profile.",
    ],
  },
  {
    id: "FEATURED",
    name: COMPANY_PLAN_CONFIG.FEATURED.label,
    price: COMPANY_PLAN_CONFIG.FEATURED.price,
    description: "Featured placement designed to increase discovery and inbound requests.",
    highlight: "Higher exposure",
    benefits: [
      "Featured placement in creator dashboards",
      "Higher visibility across discovery surfaces",
      "Best for reaching more active projects",
    ],
    details: [
      "Ideal if you want your company surfaced earlier and more often when creators browse service partners.",
      "Great for teams focused on lead generation and stronger brand presence on the platform.",
    ],
  },
] as const;

export function CompanySubscriptionClient({ dashboardUrl }: { dashboardUrl: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<"STANDARD" | "FEATURED">("STANDARD");
  const [expanded, setExpanded] = useState<string | null>("STANDARD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = PLANS.find((entry) => entry.id === plan) ?? PLANS[0];

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/company-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data?.requiresPayment && data?.payment) {
          setError("Payments are currently disabled on this platform.");
        } else {
          router.push(dashboardUrl);
          router.refresh();
        }
      } else {
        setError(data.error || "Payment failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Megaphone className="h-4 w-4" /> Creator discovery
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Your listing appears where creators search for companies to hire and contact.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Sparkles className="h-4 w-4" /> Better presentation
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Choose the visibility level that fits your growth stage and sales goals.
          </p>
        </div>
        <div className="storytime-kpi p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Shield className="h-4 w-4" /> Flexible upgrade path
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Start lean or go featured now, then adjust later as your demand grows.
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-400">Step 1 of 1 — Choose how prominently your company should be listed.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLANS.map((entry) => (
          <div
            key={entry.id}
            data-selected={plan === entry.id}
            className={`storytime-plan-card flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:scale-[1.02] ${
              plan === entry.id ? "border-orange-400/50 bg-orange-500/10 shadow-glow" : "hover:border-white/15"
            }`}
          >
            <button
              type="button"
              onClick={() => setPlan(entry.id)}
              className="flex h-full flex-col text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
                    {entry.highlight}
                  </div>
                  <h3 className="text-2xl font-semibold text-white">{entry.name}</h3>
                  <p className="mt-2 text-sm text-slate-400">{entry.description}</p>
                </div>
                {plan === entry.id ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/10">
                    <Check className="h-5 w-5 text-orange-300" />
                  </div>
                ) : null}
              </div>

              <p className="mt-5 text-4xl font-bold text-white">
                R{entry.price}
                <span className="ml-1 text-sm font-normal text-slate-400">/month</span>
              </p>

              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {entry.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </button>

            <button
              type="button"
              onClick={() => setExpanded((current) => (current === entry.id ? null : entry.id))}
              className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05]"
            >
              <span>More about this package</span>
              {expanded === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expanded === entry.id ? (
              <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                {entry.details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="storytime-section p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected plan</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">{selectedPlan.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{selectedPlan.description}</p>
            </div>
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-orange-200/80">Monthly price</p>
              <p className="mt-1 text-3xl font-bold text-white">R{selectedPlan.price}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            {selectedPlan.benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="storytime-section p-6">
          <p className="text-sm font-medium text-slate-300">Company listing</p>
          <p className="mt-2 text-sm text-slate-400">
            Your company profile will appear in creator dashboards so filmmakers can find and contact you.
            Choose Standard for essential visibility or Featured for stronger placement in discovery surfaces.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Reach creators looking for trusted partners
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Present your company inside the same premium product experience
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Upgrade visibility as your demand grows
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        Pay & continue
      </button>

    </div>
  );
}
