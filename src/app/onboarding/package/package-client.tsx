"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Check, Loader2 } from "lucide-react";

const PLANS = [
  { id: "BASE_1", name: "Base", price: 39, devices: 1, description: "1 device", benefits: ["Watch on 1 device", "Full catalogue access", "HD streaming"] },
  { id: "STANDARD_3", name: "Standard", price: 79, devices: 3, description: "3 devices", benefits: ["Watch on 3 devices", "Full catalogue access", "HD streaming", "Share with family"] },
  { id: "FAMILY_5", name: "Family", price: 99, devices: 5, description: "5+ devices", benefits: ["Watch on 5+ devices", "Full catalogue access", "HD streaming", "Best for households"] },
];

export function PackageClient() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("BASE_1");
  const [startTrial, setStartTrial] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected, startTrial }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      router.push("/profiles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <p className="text-slate-400 text-sm">Step 1 of 1 — Choose your plan. You can change or cancel anytime.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelected(plan.id)}
            className={`p-6 rounded-2xl border text-left transition ${
              selected === plan.id
                ? "border-orange-500 bg-orange-500/10"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Smartphone className="w-4 h-4" /> {plan.description}
            </div>
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
            <p className="text-2xl font-bold text-orange-500 mt-1">R{plan.price}<span className="text-sm font-normal text-slate-400">/mo</span></p>
            <ul className="mt-3 space-y-1 text-sm text-slate-400">
              {plan.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {b}
                </li>
              ))}
            </ul>
            {selected === plan.id && <Check className="w-5 h-5 text-orange-500 mt-3" />}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
        <p className="text-sm font-medium text-slate-300">What you get</p>
        <p className="text-slate-400 text-sm mt-1">Access to all films, series, shows, podcasts, and music. Start with a 3-day free trial — no charge until it ends. Cancel anytime.</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={startTrial}
            onChange={(e) => setStartTrial(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-white font-medium">Start 3-day free trial</span>
        </label>
        <p className="text-slate-400 text-sm mt-2 ml-7">You won&apos;t be charged until the trial ends. Cancel anytime.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        {startTrial ? "Start free trial" : "Pay now"}
      </button>
    </form>
  );
}
