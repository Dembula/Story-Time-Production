"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { StoryTimeMark } from "@/components/brand/story-time-mark";
import { ArrowLeft, Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { OAuthSignInButtons } from "@/components/auth/oauth-sign-in-buttons";

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
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-md relative z-10">
        <Link href="/" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center" aria-label="Story Time">
          <StoryTimeMark size={56} priority />
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

              <OAuthSignInButtons callbackUrl="/onboarding/package" dividerLabel="Or" onError={setError} />

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
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SignUpPageInner />
    </Suspense>
  );
}
