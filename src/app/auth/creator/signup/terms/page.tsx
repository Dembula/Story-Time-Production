"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function CreatorSignupTermsPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  function continueToSignup() {
    if (!accepted) return;
    router.push("/auth/creator/signup?termsAccepted=1");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_32%),linear-gradient(135deg,rgba(255,214,153,0.18),transparent_42%),linear-gradient(180deg,#020617_0%,#111827_55%,#1f2937_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-amber-100/12 to-transparent" />
      <div className="w-full max-w-2xl relative z-10">
        <Link href="/auth/creator/signup" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to creator signup
        </Link>

        <div className="rounded-[28px] border border-white/15 bg-gradient-to-br from-white via-stone-50 to-amber-50 p-8 text-slate-950 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          <h1 className="mb-2 font-display text-2xl font-semibold text-slate-950">Creator Terms Acknowledgement</h1>
          <p className="mb-6 text-sm text-slate-600">
            Before creating a creator account, acknowledge the platform&apos;s legal, monetization, and payment conditions.
          </p>
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="mb-3">By continuing, you confirm review and acceptance of:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-600">
              <li>Terms of Service, Content Policy, and Acceptable Use Policy</li>
              <li>Privacy, Cookie, and Security policies</li>
              <li>Payment Policy, Subscription Terms, and Refund Policy</li>
              <li>Creator monetization and payout conditions</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/legal/terms" className="text-amber-700 hover:text-amber-800">Terms</Link>
              <Link href="/legal/content-policy" className="text-amber-700 hover:text-amber-800">Content Policy</Link>
              <Link href="/legal/payment-policy" className="text-amber-700 hover:text-amber-800">Payment Policy</Link>
              <Link href="/legal/refund-policy" className="text-amber-700 hover:text-amber-800">Refund Policy</Link>
            </div>
          </div>
          <label className="mb-4 flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>I acknowledge and agree to the creator onboarding, legal, privacy, payment, and usage terms.</span>
          </label>
          <button
            type="button"
            onClick={continueToSignup}
            disabled={!accepted}
            className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
          >
            I Acknowledge and Continue
          </button>
        </div>
      </div>
    </div>
  );
}
