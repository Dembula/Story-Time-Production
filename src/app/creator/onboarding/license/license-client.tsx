"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

export function LicenseClient() {
  const router = useRouter();
  const [type, setType] = useState<"YEARLY_R89" | "PER_UPLOAD_R10">("YEARLY_R89");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/creator/distribution-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        router.push("/creator/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4 mb-6">
        <p className="text-sm font-medium text-slate-300">Distribution license</p>
        <p className="text-slate-400 text-sm mt-1">
          Your content will be distributed on Story Time to viewers in our supported territories. You keep ownership and control; the license grants us the right to stream and monetise. Choose yearly (unlimited uploads) or pay per title.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setType("YEARLY_R89")}
        className={`w-full p-6 rounded-2xl border text-left transition ${type === "YEARLY_R89" ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-800/30"}`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Yearly license</h3>
            <p className="text-slate-400 text-sm mt-1">Unlimited uploads for 1 year. Distribute as many titles as you want on Story Time.</p>
            <p className="text-2xl font-bold text-orange-500 mt-2">R89</p>
          </div>
          {type === "YEARLY_R89" && <Check className="w-6 h-6 text-orange-500" />}
        </div>
      </button>
      <button
        type="button"
        onClick={() => setType("PER_UPLOAD_R10")}
        className={`w-full p-6 rounded-2xl border text-left transition ${type === "PER_UPLOAD_R10" ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-800/30"}`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">Pay per upload</h3>
            <p className="text-slate-400 text-sm mt-1">R10 per title. Best if you only plan to publish a few titles.</p>
            <p className="text-2xl font-bold text-orange-500 mt-2">R10 / upload</p>
          </div>
          {type === "PER_UPLOAD_R10" && <Check className="w-6 h-6 text-orange-500" />}
        </div>
      </button>
      <button onClick={submit} disabled={loading} className="w-full py-4 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
        Pay & continue
      </button>
    </div>
  );
}
