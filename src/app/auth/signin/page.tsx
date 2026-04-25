"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";

export default function SignInPage() {
  const hasGoogleProvider = Boolean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true");
  const hasGitHubProvider = Boolean(process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "true");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials-viewer", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      window.location.href = "/profiles";
    } else {
      setError("Invalid viewer credentials or this account belongs to the creator portal.");
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
          <h1 className="mb-2 font-display text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mb-6 text-sm leading-6 text-slate-300/78">Sign in to watch unlimited content from independent creators</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                Email address
              </label>
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
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>
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
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="relative my-6">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/8" />
            </span>
            <span className="relative flex justify-center bg-transparent px-3 text-xs text-slate-500">Or continue with</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!hasGoogleProvider}
              onClick={async () => {
                try {
                  await signIn("google", { callbackUrl: "/profiles" });
                } catch {
                  setError("Google sign-in is currently unavailable. Use email/password.");
                }
              }}
              className="storytime-panel flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
            >
              Google
            </button>
            <button
              type="button"
              disabled={!hasGitHubProvider}
              onClick={async () => {
                try {
                  await signIn("github", { callbackUrl: "/profiles" });
                } catch {
                  setError("GitHub sign-in is currently unavailable. Use email/password.");
                }
              }}
              className="storytime-panel flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]"
            >
              GitHub
            </button>
          </div>
          {(!hasGoogleProvider || !hasGitHubProvider) && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Some social sign-in providers are disabled in this environment.
            </p>
          )}

          <div className="mt-4 flex items-center gap-2 justify-center text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Protected with account and session controls</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup/terms" className="font-medium text-orange-300 hover:text-orange-200">
            Sign up
          </Link>
          {" · "}
          <Link href="/auth/creator/signin" className="text-slate-400 hover:text-slate-300">
            Creator sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
