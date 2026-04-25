"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";

function SignUpPageInner() {
  const [consentReady, setConsentReady] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    setConsentReady(searchParams.get("termsAccepted") === "1");
  }, [searchParams]);

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

      const res = await signIn("credentials-viewer", {
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
                Continue to the dedicated terms screen to acknowledge legal and payment terms before creating your account.
              </p>
              <Link
                href="/auth/signup/terms"
                className="inline-flex w-full items-center justify-center rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400"
              >
                Review terms and continue
              </Link>
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

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SignUpPageInner />
    </Suspense>
  );
}
