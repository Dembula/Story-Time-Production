"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";

export default function SignUpPage() {
  const [consentReady, setConsentReady] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const viewerConsentKey = "storytime_viewer_signup_ack_v1";

  useEffect(() => {
    const alreadyAccepted = window.localStorage.getItem(viewerConsentKey) === "true";
    setConsentReady(alreadyAccepted);
  }, []);

  function handleConsentContinue() {
    if (!consentAccepted) return;
    window.localStorage.setItem(viewerConsentKey, "true");
    setConsentReady(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() || undefined }),
      });
      const data = (await signupRes.json().catch(() => ({}))) as { error?: string };

      if (!signupRes.ok) {
        setError(data?.error || "Registration failed. Try a different email or sign in if you already have an account.");
        setLoading(false);
        return;
      }

      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      setLoading(false);
      if (res?.ok) {
        window.location.href = "/onboarding/package";
      } else {
        setError("Account created. Please sign in with your email and password.");
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.08),transparent_60%)]" />
      <div className="w-full max-w-md relative z-10">
        <Link href="/" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={52} height={52} className="rounded-xl shadow-glow" />
          <span className="text-2xl font-semibold tracking-[0.14em] text-white">STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>

        <div className="storytime-section p-8">
          {!consentReady ? (
            <div>
              <h1 className="mb-2 font-display text-2xl font-semibold text-white">Terms Acknowledgement</h1>
              <p className="mb-6 text-sm leading-6 text-slate-300/78">
                Before creating your account, you must acknowledge the legal and payment terms that apply to Story Time.
              </p>
              <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                <p className="mb-3">By continuing, you confirm that you have reviewed and accepted:</p>
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
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                />
                <span>I acknowledge and agree to the applicable terms, privacy, payment, refund, and usage conditions.</span>
              </label>
              <button
                type="button"
                onClick={handleConsentContinue}
                disabled={!consentAccepted}
                className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
              >
                I Acknowledge and Continue
              </button>
            </div>
          ) : (
            <>
              <h1 className="mb-2 font-display text-2xl font-semibold text-white">Create an account</h1>
              <p className="mb-6 text-sm leading-6 text-slate-300/78">Subscribe to watch unlimited content from independent creators worldwide</p>

              <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-300">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="storytime-input px-4 py-3"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="storytime-input px-4 py-3"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="storytime-input px-4 py-3"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
              </form>

              <div className="relative my-6">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/8" />
            </span>
            <span className="relative flex justify-center bg-transparent px-3 text-xs text-slate-500">Or</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/profiles" })}
              className="storytime-panel flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/profiles" })}
              className="storytime-panel flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
            >
              GitHub
            </button>
              </div>

              <div className="mt-4 flex items-center gap-2 justify-center text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5" />
                <span>Your account is protected by platform access controls</span>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/auth/signin" className="font-medium text-orange-300 hover:text-orange-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
