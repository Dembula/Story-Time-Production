"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

export function CompanySubscriptionClient({ dashboardUrl }: { dashboardUrl: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<"STANDARD_R29" | "PROMOTED_R49">("STANDARD_R29");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/company-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        router.push(dashboardUrl);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Payment failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4 mb-6">
        <p className="text-sm font-medium text-slate-300">Company listing</p>
        <p className="text-slate-400 text-sm mt-1">Your company profile will appear in creator dashboards so filmmakers can find and contact you. Choose Standard for basic visibility or Promoted for featured placement.</p>
      </div>
      <button
        type="button"
        onClick={() => setPlan("STANDARD_R29")}
        className={`w-full p-6 rounded-2xl border text-left transition ${plan === "STANDARD_R29" ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-800/30"}`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Standard listing</h3>
            <p className="text-slate-400 text-sm mt-1">Visible in creator dashboards. One listing, discoverable by all creators.</p>
            <p className="text-2xl font-bold text-orange-500 mt-2">R29/month</p>
          </div>
          {plan === "STANDARD_R29" && <Check className="w-6 h-6 text-orange-500" />}
        </div>
      </button>
      <button
        type="button"
        onClick={() => setPlan("PROMOTED_R49")}
        className={`w-full p-6 rounded-2xl border text-left transition ${plan === "PROMOTED_R49" ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-800/30"}`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Promoted listing</h3>
            <p className="text-slate-400 text-sm mt-1">Featured placement and higher visibility in creator dashboards. Best for reaching more projects.</p>
            <p className="text-2xl font-bold text-orange-500 mt-2">R49/month</p>
          </div>
          {plan === "PROMOTED_R49" && <Check className="w-6 h-6 text-orange-500" />}
        </div>
      </button>
      <button
        onClick={submit}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        Pay & continue
      </button>
    </div>
  );
}
