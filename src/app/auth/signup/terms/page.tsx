"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ViewerSignupTermsPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  function continueToSignup() {
    if (!accepted) return;
    router.push("/auth/signup?termsAccepted=1");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.08),transparent_60%)]" />
      <div className="w-full max-w-2xl relative z-10">
        <Link href="/auth/signup" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to sign up
        </Link>

        <div className="storytime-section p-8">
          <h1 className="mb-2 font-display text-2xl font-semibold text-white">Terms Acknowledgement</h1>
          <p className="mb-6 text-sm leading-6 text-slate-300/78">
            Before creating your viewer account, acknowledge the legal and payment terms that apply to Story Time.
          </p>
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            <p className="mb-3">By continuing, you confirm that you reviewed and accepted:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>Terms of Service and Acceptable Use standards</li>
              <li>Privacy Policy and Cookie Policy</li>
              <li>Payment Policy, Subscription Terms, and Refund Policy</li>
              <li>Platform disclosure, pricing, and onboarding consent flow</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/legal/terms" className="text-orange-300 hover:text-orange-200">Terms</Link>
              <Link href="/legal/privacy" className="text-orange-300 hover:text-orange-200">Privacy</Link>
              <Link href="/legal/payment-policy" className="text-orange-300 hover:text-orange-200">Payments</Link>
              <Link href="/legal/refund-policy" className="text-orange-300 hover:text-orange-200">Refunds</Link>
            </div>
          </div>
          <label className="mb-4 flex items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
            />
            <span>I acknowledge and agree to the applicable terms, privacy, payment, refund, and usage conditions.</span>
          </label>
          <button
            type="button"
            onClick={continueToSignup}
            disabled={!accepted}
            className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
          >
            I Acknowledge and Continue
          </button>
        </div>
      </div>
    </div>
  );
}
